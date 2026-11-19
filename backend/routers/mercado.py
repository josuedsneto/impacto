"""Mercado: preços e indicadores do cache, catálogo de ativos, VaR, ARIMA, stress, volatilidade, notícias e Focus."""

import json
import logging
import time as _time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from typing import Annotated, Literal
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from auth import get_current_user
import market_cache
from market_cache import get_prices, serie_fechamentos, supa_client
from analysis import compute_analysis, IndicatorConfig
from validacao import validate_ticker, _faixa, _validar_periodo, _lista_periodos
from pregao import estado_pregao
from limiter import limiter
from noticias import buscar_manchetes
from fastapi import APIRouter


router = APIRouter()


INICIO_ESTRESSE = date(2007, 1, 1)


def fechamentos(ticker: str, inicio: date, fim: date | None = None):
    """
    Série de fechamentos (pandas, índice de datas) e a data do último dado, lidas pelo cache.
    503 com mensagem em português quando não há nenhum preço (Yahoo fora e cache vazio).
    """
    serie = serie_fechamentos(ticker, inicio, fim)
    if serie.empty:
        raise HTTPException(
            status_code=503,
            detail=f"Não foi possível obter os preços de {ticker} agora. Tente novamente em alguns minutos.",
        )
    return serie, serie.index[-1].strftime("%Y-%m-%d")

logger = logging.getLogger(__name__)


class TickerSuggestRequest(BaseModel):
    ticker: str
    nome: str = ""        # human-readable name, optional
    tipo: Literal["commodity", "fx", "acao", "indice"] = "commodity"


@router.get("/api/focus")
@limiter.limit("20/minute")
def get_focus(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """
    Returns latest BCB Focus report medians for IPCA, Câmbio, Selic, PIB Total
    for the current calendar year, plus the delta vs the reading from ~7 days ago.
    Falls back to None values if the BCB API is unavailable.
    """
    from focus import fetch_indicator

    current_year = str(date.today().year)

    indicators = ["IPCA", "Câmbio", "Selic", "PIB Total"]
    result = {}

    with ThreadPoolExecutor(max_workers=len(indicators)) as pool:
        values = list(pool.map(lambda nome: fetch_indicator(nome, current_year), indicators))

    key_map = {"IPCA": "ipca", "Câmbio": "cambio", "Selic": "selic", "PIB Total": "pib"}
    for name, val in zip(indicators, values):
        result[key_map[name]] = val

    result["ano_referencia"] = current_year
    return result


# ── Market data ─────────────────────────────────────────────────────────────────

@router.get("/api/market/prices")
@limiter.limit("30/minute")
def market_prices(
    request: Request,
    ticker: str,
    start: date,
    end: date,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Return cached OHLCV rows for ticker in [start, end].
    MKT-01: second call returns from DB without calling yfinance.
    MKT-02: only uncached dates are fetched from yfinance.
    """
    ticker = validate_ticker(ticker)
    _validar_periodo(start, end)
    rows = get_prices(ticker, start, end)
    return {"ticker": ticker, "start": start.isoformat(), "end": end.isoformat(), "rows": rows}


@router.get("/api/market/analysis")
@limiter.limit("20/minute")
def market_analysis(
    request: Request,
    ticker: str,
    start: date,
    end: date,
    user: Annotated[dict, Depends(get_current_user)],
    indicators: str = "",
    rsi_period: int = 14,
    bb_window: int = 20,
    bb_std: float = 2.0,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    stoch_k: int = 14,
    stoch_d: int = 3,
    cci_period: int = 20,
    sma_periods: str = "",
    ema_periods: str = "",
):
    """
    Return OHLCV + computed technical indicators + buy/sell signals.
    Data is fetched via market_cache (Supabase-backed, no duplicate yfinance calls).
    """
    import pandas as pd

    ticker = validate_ticker(ticker)
    _validar_periodo(start, end)

    for nome, valor in [
        ("O período do RSI", rsi_period), ("A janela do Bollinger", bb_window),
        ("O MACD rápido", macd_fast), ("O MACD lento", macd_slow), ("O sinal do MACD", macd_signal),
        ("O %K do estocástico", stoch_k), ("O %D do estocástico", stoch_d), ("O período do CCI", cci_period),
    ]:
        _faixa(nome, valor, 2, 250)
    _faixa("O desvio do Bollinger", bb_std, 0.5, 5)
    if macd_fast >= macd_slow:
        raise HTTPException(status_code=422, detail="O MACD rápido deve ser menor que o lento.")

    selected = [i.strip().lower() for i in indicators.split(",") if i.strip()]
    sma_list = _lista_periodos("SMA", sma_periods)
    ema_list = _lista_periodos("EMA", ema_periods)

    cfg = IndicatorConfig(
        indicators=selected,
        rsi_period=rsi_period,
        bb_window=bb_window,
        bb_std=bb_std,
        macd_fast=macd_fast,
        macd_slow=macd_slow,
        macd_signal=macd_signal,
        stoch_k=stoch_k,
        stoch_d=stoch_d,
        cci_period=cci_period,
        sma_periods=sma_list,
        ema_periods=ema_list,
    )

    raw_rows = get_prices(ticker, start, end)
    if not raw_rows:
        return {"ticker": ticker, "rows": [], "signals": []}

    df = pd.DataFrame(raw_rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    enriched, signals = compute_analysis(df, cfg)

    enriched = enriched.reset_index()
    enriched["date"] = enriched["date"].dt.strftime("%Y-%m-%d")
    rows = json.loads(enriched.to_json(orient="records"))

    return {"ticker": ticker, "rows": rows, "signals": signals}


@router.get("/api/market/status")
@limiter.limit("30/minute")
def market_status(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Estado do pregão (REGULAR ou CLOSED); UNKNOWN se não der para calcular. Não consulta o Yahoo."""
    ticker = validate_ticker(ticker)
    try:
        state = estado_pregao(datetime.now(timezone.utc))
    except Exception:
        logger.exception("Falha ao calcular o estado do pregão")
        state = "UNKNOWN"
    return {"ticker": ticker, "state": state, "open": state == "REGULAR"}


STATUS_PT = {"pending": "aguardando revisão", "approved": "aprovado", "rejected": "rejeitado"}


@router.post("/api/market/suggest")
@limiter.limit("10/minute")
def suggest_ticker(
    request: Request,
    body: TickerSuggestRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    MKT-03: User suggests a new ticker.
    Validates ticker against yfinance BEFORE writing to DB.
    Returns 400 with visible error if ticker is invalid or has no data.
    On success inserts row into tickers_catalog with status='pending'.
    """
    ticker = validate_ticker(body.ticker)

    # Validate: a sonda consulta o Yahoo (é o objetivo), mas pelo módulo de cache, ponto único de acesso
    try:
        probe = market_cache._fetch_from_yfinance(ticker, date.today() - timedelta(days=7), date.today())
    except Exception as exc:
        logger.error("yfinance error for '%s': %s", ticker, exc)
        raise HTTPException(status_code=400, detail="Não foi possível consultar o mercado agora. Tente novamente em alguns minutos.")

    if probe.empty:
        raise HTTPException(
            status_code=400,
            detail=f"Ativo '{ticker}' não encontrado ou sem dados recentes. "
                   "Confira o código e tente de novo.",
        )

    # Write to tickers_catalog only after validation passes
    client = supa_client()
    existing = (
        client.table("tickers_catalog")
        .select("ticker,status")
        .eq("ticker", ticker)
        .execute()
    )
    if existing.data:
        return {
            "ticker": ticker,
            "status": existing.data[0]["status"],
            "message": f"O ativo {ticker} já está no catálogo ({STATUS_PT.get(existing.data[0]['status'], existing.data[0]['status'])}).",
        }

    client.table("tickers_catalog").insert({
        "ticker": ticker,
        "nome": body.nome or ticker,
        "tipo": body.tipo,
        "status": "pending",
        "backfill_status": "pending",
        "adicionado_por": user["id"],
    }).execute()

    return {"ticker": ticker, "status": "pending", "message": f"Ativo {ticker} enviado para revisão do administrador."}


# ── VaR ────────────────────────────────────────────────────────────────────────

@router.get("/api/var")
@limiter.limit("10/minute")
def get_var(
    request: Request,
    ticker: str = "SB=F",
    confidence: float = 0.95,
    horizon: int = 1,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute Historical and Parametric Value at Risk.

    Returns var_historico and var_parametrico in price units (not percent).
    Both figures represent the potential loss over `horizon` days at the
    given confidence level.
    """
    from scipy.stats import norm
    import numpy as np

    ticker = validate_ticker(ticker)
    _faixa("O nível de confiança", confidence, 0.5, 0.999)
    _faixa("O horizonte (dias úteis)", horizon, 1, 252)

    serie, ultimo_dado = fechamentos(ticker, date.today() - timedelta(days=365))
    if len(serie) < 10:
        raise HTTPException(status_code=400, detail=f"Dados insuficientes para {ticker}. Tente outro ativo ou período.")

    closes = serie.values
    returns = np.diff(closes) / closes[:-1]
    last_price = float(closes[-1])

    # Historical VaR
    var_historico = float(np.percentile(returns, (1 - confidence) * 100) * last_price * (horizon ** 0.5))

    # Parametric VaR
    mu = float(np.mean(returns))
    sigma = float(np.std(returns, ddof=1))
    var_parametrico = float(norm.ppf(1 - confidence) * sigma * last_price * (horizon ** 0.5))

    return {
        "ticker": ticker,
        "confidence": confidence,
        "horizon": horizon,
        "last_price": round(last_price, 4),
        "var_historico_abs": round(var_historico, 4),
        "var_historico_pct": round(var_historico / last_price, 6) if last_price else None,
        "var_parametrico_abs": round(var_parametrico, 4),
        "var_parametrico_pct": round(var_parametrico / last_price, 6) if last_price else None,
        "n_observations": len(returns),
        "ultimo_dado": ultimo_dado,
    }


# ── ARIMA ──────────────────────────────────────────────────────────────────────

@router.get("/api/arima/{ticker}")
@limiter.limit("10/minute")
def get_arima(
    request: Request,
    ticker: str,
    steps: int = 30,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Fit ARIMA(1,1,1) on 2 years of daily closes and forecast `steps` periods ahead.

    Returns forecast values with 95% confidence intervals.
    """
    import numpy as np
    from statsmodels.tsa.arima.model import ARIMA
    import pandas as pd

    ticker = validate_ticker(ticker)
    if steps < 1 or steps > 365:
        raise HTTPException(status_code=400, detail="O horizonte da previsão precisa estar entre 1 e 365 dias.")

    closes, ultimo_dado = fechamentos(ticker, date.today() - timedelta(days=2 * 365))
    if len(closes) < 30:
        raise HTTPException(status_code=400, detail=f"Dados insuficientes para {ticker}. Tente outro ativo ou período.")

    try:
        model = ARIMA(closes, order=(1, 1, 1))
        fit = model.fit()
        forecast_result = fit.get_forecast(steps=steps)
        forecast_mean = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=0.05)
    except Exception as exc:
        logger.error("ARIMA fitting failed for '%s': %s", ticker, exc)
        raise HTTPException(status_code=400, detail="O modelo ARIMA não convergiu para este ativo. Tente outro ativo ou horizonte.")

    last_date = closes.index[-1]
    forecast_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=steps, freq="B")

    # Historical points — last 90 days for chart context
    history = closes.iloc[-90:]
    series = [
        {"date": dt.strftime("%Y-%m-%d"), "value": round(float(v), 4)}
        for dt, v in history.items()
    ]

    # Forecast points
    for i, dt in enumerate(forecast_dates):
        date_str = dt.strftime("%Y-%m-%d")
        series.append({
            "date": date_str,
            "forecast": round(float(forecast_mean.iloc[i]), 4),
            "ci_lower": round(float(conf_int.iloc[i, 0]), 4),
            "ci_upper": round(float(conf_int.iloc[i, 1]), 4),
        })

    return {
        "ticker": ticker,
        "steps": steps,
        "series": series,
        "ultimo_dado": ultimo_dado,
    }


# ── Stress Test ────────────────────────────────────────────────────────────────

@router.get("/api/stress")
@limiter.limit("10/minute")
def get_stress(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute stress scenarios for the given ticker using full price history.

    Returns three scenarios:
    - worst_5pct: Worst 5% drawdown period from historical data
    - crisis_2008: Price performance during Aug 2008 – Mar 2009
    - covid_2020: Price performance during Feb 2020 – Apr 2020
    """
    import numpy as np
    import pandas as pd

    ticker = validate_ticker(ticker)
    # Desde 2007: cobre a crise de 2008 (o cache por padrão começa em 2013).
    closes, ultimo_dado = fechamentos(ticker, INICIO_ESTRESSE)
    if len(closes) < 30:
        raise HTTPException(status_code=400, detail=f"Dados insuficientes para {ticker}. Tente outro ativo ou período.")

    def compute_drawdown_window(series: "pd.Series") -> dict:
        """Return the worst drawdown window (start, end, drawdown_pct, price_after)."""
        if series.empty:
            return {"start": None, "end": None, "drawdown_pct": None, "last_price_after": None}
        roll_max = series.cummax()
        drawdown = (series - roll_max) / roll_max
        worst_idx = int(drawdown.argmin())
        worst_val = float(drawdown.iloc[worst_idx])
        # Find the peak before the trough
        peak_idx = int(series.iloc[: worst_idx + 1].argmax())
        start_date = series.index[peak_idx].strftime("%Y-%m-%d")
        end_date = series.index[worst_idx].strftime("%Y-%m-%d")
        return {
            "start": start_date,
            "end": end_date,
            "drawdown_pct": round(worst_val * 100, 2),
            "last_price_after": round(float(series.iloc[worst_idx]), 4),
        }

    # Scenario 1: worst drawdown in the period read (desde 2007)
    worst_dd = compute_drawdown_window(closes)
    # Scenarios 2 and 3: known crises (index is sorted, so label slicing is safe)
    crisis_2008 = compute_drawdown_window(closes.loc["2008-08-01":"2009-03-31"])
    covid = compute_drawdown_window(closes.loc["2020-02-01":"2020-04-30"])

    def to_scenario(d: dict, name: str) -> dict:
        return {
            "cenario": name,
            "periodo_inicio": d.get("start") or "N/A",
            "periodo_fim": d.get("end") or "N/A",
            "drawdown_pct": round((d.get("drawdown_pct") or 0) / 100, 4),
            "preco_final": d.get("last_price_after") or 0.0,
        }

    return {
        "cenarios": [
            to_scenario(worst_dd, "Pior queda desde 2007"),
            to_scenario(crisis_2008, "Crise 2008"),
            to_scenario(covid, "COVID 2020"),
        ],
        "ultimo_dado": ultimo_dado,
    }


# ── News ───────────────────────────────────────────────────────────────────────

_news_cache: dict = {"ts": 0.0, "items": []}


_NEWS_TTL = 1800  # 30 minutes


@router.get("/api/news")
@limiter.limit("20/minute")
def get_news(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Fetch top 10 financial news items from Google News RSS feed.

    Results are cached for 30 minutes to avoid hammering the RSS endpoint.
    """
    now = _time.time()
    if now - _news_cache["ts"] < _NEWS_TTL and _news_cache["items"]:
        return {"items": _news_cache["items"], "cached": True}

    try:
        items = buscar_manchetes()
        _news_cache["ts"] = now
        _news_cache["items"] = items
    except Exception as exc:
        logger.error("Failed to fetch news: %s", exc)
        if _news_cache["items"]:
            return {"items": _news_cache["items"], "cached": True, "warning": "News fetch failed, showing cached data"}
        raise HTTPException(status_code=503, detail="Não foi possível carregar as notícias agora. Tente novamente em alguns minutos.")

    return {"items": items, "cached": False}


@router.get("/api/volatility")
@limiter.limit("10/minute")
def get_volatility(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute realized volatility at 30d, 90d and 1y horizons (annualized).

    Also returns rolling 30d volatility history for chart rendering.
    """
    import numpy as np
    import pandas as pd

    ticker = validate_ticker(ticker)
    closes, ultimo_dado = fechamentos(ticker, date.today() - timedelta(days=365))
    if len(closes) < 30:
        raise HTTPException(status_code=400, detail=f"Dados insuficientes para {ticker}. Tente outro ativo ou período.")

    last_price = float(closes.iloc[-1])
    log_returns = np.log(closes / closes.shift(1)).dropna()

    ann = 252 ** 0.5

    vol_30d = float(log_returns.iloc[-30:].std(ddof=1) * ann) if len(log_returns) >= 30 else None
    vol_90d = float(log_returns.iloc[-90:].std(ddof=1) * ann) if len(log_returns) >= 90 else None
    vol_1y = float(log_returns.std(ddof=1) * ann)

    rolling_30d = log_returns.rolling(30).std() * ann
    history = []
    for dt, row_close, row_vol in zip(closes.index[1:], closes.iloc[1:], rolling_30d):
        if not np.isnan(row_vol):
            history.append({
                "date": dt.strftime("%Y-%m-%d"),
                "close": round(float(row_close), 4),
                "vol_30d_rolling": round(float(row_vol), 6),
            })

    rolling_30d_list = [
        {"date": h["date"], "vol": h["vol_30d_rolling"]}
        for h in history
    ]

    return {
        "ticker": ticker,
        "vol_30d": round(vol_30d, 6) if vol_30d is not None else None,
        "vol_90d": round(vol_90d, 6) if vol_90d is not None else None,
        "vol_1y": round(vol_1y, 6),
        "last_price": round(last_price, 4),
        "rolling_30d": rolling_30d_list,
        "ultimo_dado": ultimo_dado,
    }
