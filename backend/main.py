from dotenv import load_dotenv
load_dotenv()

import json
import logging
import os
import re
import time as _time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time as Hora, timedelta, timezone
from typing import Annotated, Literal, Optional
from uuid import UUID

import requests
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator
from urllib.parse import urlencode
from zoneinfo import ZoneInfo
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware

from auth import get_current_user, require_admin
import market_cache
from market_cache import get_prices, backfill_ticker, supa_client, serie_fechamentos
from analysis import compute_analysis, IndicatorConfig
from simulation import run_simulation, DadosInsuficientesError
from options import compute_payoff, black76_price, mc_black76_price
from regression import run_dolar_regression, get_dolar_defaults, run_acucar_regression, get_acucar_defaults
from atr import calibrate_atr, predict_atr
from observabilidade import RequestIdMiddleware, configurar_logs
from postgrest.exceptions import APIError

from validacao import validate_ticker, _faixa, _validar_periodo, _validar_paginacao, _lista_periodos
from constantes import CONSTANTES_NEGOCIO, _valor_numerico, _ler_constantes
from pregao import estado_pregao
from fechamentos_cache import fechamentos, INICIO_ESTRESSE

configurar_logs()
logger = logging.getLogger(__name__)


# Documentação da API (Swagger, ReDoc e schema) só com ENABLE_DOCS=true.
_docs_on = os.getenv("ENABLE_DOCS", "").strip().lower() == "true"

app = FastAPI(
    title="Impacto API",
    version="2.0.0",
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)

from limiter import limiter  # módulo próprio: routers/cambio.py importa sem ciclo
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
# Por dentro do CORS: o erro 500 também sai com cabeçalhos CORS (HARD-02, HARD-10)
app.add_middleware(RequestIdMiddleware)
from routers import jobs as jobs_router  # noqa: E402
app.include_router(jobs_router.router)

# CORS — origins configured via env var; defaults to localhost for local dev
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

from routers.risco_conjunto import router as risco_conjunto_router  # noqa: E402
app.include_router(risco_conjunto_router)
from routers.alertas import router as alertas_router  # noqa: E402
app.include_router(alertas_router)


# ── Pydantic models ─────────────────────────────────────────────────────────────

OpcaoCenario = Literal["Moagem", "Câmbio", "NY", "Preço Etanol"]

MAX_JSON_BYTES = 64_000  # teto para JSON livre (inputs/results do Risco)


def _limitar_json(valor: dict) -> dict:
    if len(json.dumps(valor, ensure_ascii=False, default=str)) > MAX_JSON_BYTES:
        raise ValueError(f"Os dados enviados passam de {MAX_JSON_BYTES // 1000} KB.")
    return valor



class TickerSuggestRequest(BaseModel):
    ticker: str
    nome: str = ""        # human-readable name, optional
    tipo: Literal["commodity", "fx", "acao", "indice"] = "commodity"







from routers.analises import router as analises_router  # noqa: E402
app.include_router(analises_router)



@app.get("/api/focus")
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

@app.get("/api/market/prices")
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


@app.get("/api/market/analysis")
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




@app.get("/api/market/status")
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


@app.post("/api/market/suggest")
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

@app.get("/api/var")
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


# ── Breakeven ──────────────────────────────────────────────────────────────────

@app.get("/api/breakeven")
@limiter.limit("30/minute")
def get_breakeven(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Compute sugar breakeven in BRL/saca.

    breakeven_reais_saca = preco_acucar_cents * fator_conversao * preco_dolar

    fator_conversao is stored in admin_config and defaults to 1.12045 if not found.
    """
    fator_conversao = _ler_constantes("breakeven_fator_conversao")["breakeven_fator_conversao"]

    # Latest prices from the cache; fechamentos nulos não contam
    today = date.today()
    start = today - timedelta(days=7)
    sugar_rows = [r for r in get_prices("SB=F", start, today) if r["close"] is not None]
    usd_rows = [r for r in get_prices("USDBRL=X", start, today) if r["close"] is not None]

    if not sugar_rows or not usd_rows:
        raise HTTPException(status_code=503, detail="Não foi possível obter os preços atuais de açúcar e dólar. Tente novamente em alguns minutos.")

    preco_acucar_cents = float(sugar_rows[-1]["close"])
    preco_dolar = float(usd_rows[-1]["close"])
    breakeven_reais_saca = preco_acucar_cents * fator_conversao * preco_dolar

    return {
        "preco_acucar_cents_lb": round(preco_acucar_cents, 4),
        "preco_dolar_brl": round(preco_dolar, 4),
        "fator_conversao": fator_conversao,
        "breakeven_brl_saca": round(breakeven_reais_saca, 2),
    }


class BreakevenSaveRequest(BaseModel):
    preco_acucar_cents_lb: float = Field(gt=0)
    preco_dolar_brl: float = Field(gt=0)
    fator_conversao: float = Field(gt=0)
    label: str | None = None


@app.post("/api/breakeven/save", status_code=201)
@limiter.limit("30/minute")
def save_breakeven(
    request: Request,
    body: BreakevenSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Save a manual breakeven simulation for the authenticated user."""
    breakeven = round(body.preco_acucar_cents_lb * body.fator_conversao * body.preco_dolar_brl, 4)
    client = supa_client()
    saved = client.table("breakeven_simulations").insert({
        "user_id": user["id"],
        "preco_acucar_cents_lb": body.preco_acucar_cents_lb,
        "preco_dolar_brl": body.preco_dolar_brl,
        "fator_conversao": body.fator_conversao,
        "breakeven_brl_saca": breakeven,
        "label": body.label or None,
    }).execute()
    row = saved.data[0]
    return {**row, "breakeven_brl_saca": breakeven}


@app.get("/api/breakeven/history")
@limiter.limit("60/minute")
def list_breakeven_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
    """List saved breakeven simulations for the authenticated user."""
    _validar_paginacao(limit, offset)
    client = supa_client()
    result = (
        client.table("breakeven_simulations")
        .select("id,preco_acucar_cents_lb,preco_dolar_brl,fator_conversao,breakeven_brl_saca,label,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"simulations": result.data}


# ── Risco history ──────────────────────────────────────────────────────────────

class RiscoSaveRequest(BaseModel):
    inputs: dict
    fat_media: float
    custo_media: float
    ebitda_media: float
    results: dict
    label: str | None = None

    @field_validator("inputs", "results")
    @classmethod
    def _tamanho_json(cls, valor: dict) -> dict:
        return _limitar_json(valor)


@app.post("/api/risco/save", status_code=201)
@limiter.limit("30/minute")
def save_risco(
    request: Request,
    body: RiscoSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = supa_client()
    saved = client.table("risco_simulations").insert({
        "user_id": user["id"],
        "inputs": body.inputs,
        "fat_media": body.fat_media,
        "custo_media": body.custo_media,
        "ebitda_media": body.ebitda_media,
        "results": body.results,
        "label": body.label or None,
    }).execute()
    return saved.data[0]


@app.get("/api/risco/history")
@limiter.limit("60/minute")
def list_risco_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
):
    _validar_paginacao(limit, 0)
    client = supa_client()
    result = (
        client.table("risco_simulations")
        .select("id,fat_media,custo_media,ebitda_media,label,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(0, limit - 1)
        .execute()
    )
    return {"simulations": result.data}


# ── Cenários history ───────────────────────────────────────────────────────────

class CenariosSaveRequest(BaseModel):
    opcao: OpcaoCenario
    ny: float | None = None
    moagem: float | None = None
    cambio: float | None = None
    preco_etanol: float | None = None
    breakeven: float
    probabilidade_abaixo: float
    media: float
    std: float
    label: str | None = None


@app.post("/api/cenarios/save", status_code=201)
@limiter.limit("30/minute")
def save_cenario(
    request: Request,
    body: CenariosSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = supa_client()
    saved = client.table("cenarios_simulations").insert({
        "user_id": user["id"],
        **body.model_dump(exclude={"label"}),
        "label": body.label or None,
    }).execute()
    return saved.data[0]


@app.get("/api/cenarios/history")
@limiter.limit("60/minute")
def list_cenarios_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
):
    _validar_paginacao(limit, 0)
    client = supa_client()
    result = (
        client.table("cenarios_simulations")
        .select("id,opcao,breakeven,probabilidade_abaixo,media,label,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(0, limit - 1)
        .execute()
    )
    return {"simulations": result.data}


# ── ARIMA ──────────────────────────────────────────────────────────────────────

@app.get("/api/arima/{ticker}")
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

@app.get("/api/stress")
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


@app.get("/api/news")
@limiter.limit("20/minute")
def get_news(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Fetch top 10 financial news items from Google News RSS feed.

    Results are cached for 30 minutes to avoid hammering the RSS endpoint.
    """
    import feedparser

    now = _time.time()
    if now - _news_cache["ts"] < _NEWS_TTL and _news_cache["items"]:
        return {"items": _news_cache["items"], "cached": True}

    url = "https://news.google.com/rss/search?" + urlencode(
        {"q": "açúcar NY futuros dólar real", "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"}
    )
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
        items = []
        for entry in feed.entries[:10]:
            published = entry.get("published", "")
            source = entry.get("source", {})
            source_title = source.get("title", "") if isinstance(source, dict) else str(source)
            items.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": published,
                "source": source_title,
            })
        _news_cache["ts"] = now
        _news_cache["items"] = items
    except Exception as exc:
        logger.error("Failed to fetch news: %s", exc)
        if _news_cache["items"]:
            return {"items": _news_cache["items"], "cached": True, "warning": "News fetch failed, showing cached data"}
        raise HTTPException(status_code=503, detail="Não foi possível carregar as notícias agora. Tente novamente em alguns minutos.")

    return {"items": items, "cached": False}


# ── Volatility ─────────────────────────────────────────────────────────────────

@app.get("/api/volatility")
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


# ── Metas ──────────────────────────────────────────────────────────────────────

@app.get("/api/metas")
@limiter.limit("20/minute")
def get_metas(
    request: Request,
    meta: float = 2600,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """MTM history and heatmap data for sugar price targets."""
    fator = _ler_constantes("fator_conversao_mtm")["fator_conversao_mtm"]
    end = date.today()
    start = date(2013, 1, 1)

    # Fechamentos nulos não contam
    sugar_rows = [r for r in get_prices("SB=F", start, end) if r["close"] is not None]
    fx_rows = [r for r in get_prices("USDBRL=X", start, end) if r["close"] is not None]

    if len(sugar_rows) < 10 or len(fx_rows) < 10 or not any(r["close"] for r in fx_rows):
        raise HTTPException(status_code=503, detail="Dados insuficientes.")

    # HARD-05: o mapa é centrado no último fechamento de cada preço
    limite = (end - timedelta(days=7)).isoformat()
    if str(sugar_rows[-1]["date"])[:10] < limite or str(fx_rows[-1]["date"])[:10] < limite:
        raise HTTPException(status_code=503, detail="Sem preços recentes para montar o mapa de metas.")
    spot_acucar = float(sugar_rows[-1]["close"])
    spot_dolar = float(fx_rows[-1]["close"])

    sugar_map = {r["date"]: r["close"] for r in sugar_rows}
    fx_map = {r["date"]: r["close"] for r in fx_rows}
    common_dates = sorted(set(sugar_map) & set(fx_map))

    mtm_series = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "mtm": round(fator * sugar_map[d] * fx_map[d], 2),
            "meta": meta,
        }
        for d in common_dates
    ]

    # Açúcar: ±25% em passos de 5% (linhas, do maior para o menor).
    # Dólar: ±10% em passos de 2% (colunas, crescente). Centro = índice 5 nos dois eixos.
    acucares = [round(spot_acucar * (1 + 0.05 * k), 2) for k in range(5, -6, -1)]
    dolares = [round(spot_dolar * (1 + 0.02 * k), 2) for k in range(-5, 6)]
    heatmap = [[round(fator * a * d - meta, 2) for d in dolares] for a in acucares]

    return {
        "meta": meta,
        "mtm_series": mtm_series,
        "heatmap": heatmap,
        "acucares": acucares,
        "dolares": dolares,
    }




# ── Risco ──────────────────────────────────────────────────────────────────────

class VariavelRisco(BaseModel):
    media: float
    p15: float
    p85: float


class RiscoRequest(BaseModel):
    moagem: VariavelRisco = VariavelRisco(media=1300000, p15=1100000, p85=1500000)
    atr: VariavelRisco = VariavelRisco(media=125, p15=120, p85=130)
    vhp_total: VariavelRisco = VariavelRisco(media=97000, p15=94000, p85=100000)
    ny: VariavelRisco = VariavelRisco(media=21, p15=18, p85=24)
    cambio: VariavelRisco = VariavelRisco(media=5.1, p15=4.9, p85=5.3)
    preco_cbios: VariavelRisco = VariavelRisco(media=90, p15=75, p85=105)
    preco_etanol: VariavelRisco = VariavelRisco(media=3000, p15=2500, p85=3500)
    num_simulacoes: int = Field(default=10000, ge=1000, le=50000)


ROTULOS_RISCO = {
    "moagem": "Moagem", "atr": "ATR", "vhp_total": "VHP total", "ny": "NY",
    "cambio": "Câmbio", "preco_cbios": "Preço do CBIO", "preco_etanol": "Preço do etanol",
}


@app.post("/api/risco")
@limiter.limit("10/minute")
def simular_risco(
    request: Request,
    body: RiscoRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Monte Carlo simulation of revenue, cost and EBITDA."""
    import numpy as np
    from scipy.stats import norm as _norm

    for nome, v in [(k, getattr(body, k)) for k in ROTULOS_RISCO]:
        if not (v.p15 < v.media < v.p85):
            raise HTTPException(status_code=422, detail=f"{ROTULOS_RISCO[nome]}: é preciso P15 < média < P85.")

    cfg = _ler_constantes("fator_conversao_mtm", "risco_custo_fixo_1", "risco_custo_fixo_2")

    def _std(v: VariavelRisco) -> float:
        return (v.p85 - v.p15) / (2 * _norm.ppf(0.85))

    rng = np.random.default_rng()
    n = body.num_simulacoes

    def _s(v: VariavelRisco) -> np.ndarray:
        return rng.normal(v.media, _std(v), n)

    # NY não pode ser negativo (trunca em zero). Moagem e ATR não entram: na fórmula de custo
    # moagem × ATR × atr_mtm = 0,6 × (faturamento − CBIO), então se cancelam.
    ny = np.maximum(_s(body.ny), 0.0)
    vhp = _s(body.vhp_total)
    cambio = _s(body.cambio)
    cbios = _s(body.preco_cbios)
    etanol = _s(body.preco_etanol)

    fat = ((ny - 0.19) * cfg["fator_conversao_mtm"] * cambio) * vhp + 17283303 + etanol * 35524 + 24479549 + cbios * 31616
    custo = cfg["risco_custo_fixo_1"] + cfg["risco_custo_fixo_2"] + 0.6 * (fat - cbios)
    ebitda = fat - custo + 7219092

    pcts = [1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 99]

    def _summarize(arr: np.ndarray) -> dict:
        return {
            "media": round(float(np.mean(arr)), 2),
            "percentis": [{"p": p, "v": round(float(np.percentile(arr, p)), 2)} for p in pcts],
        }

    return {
        "faturamento": _summarize(fat),
        "custo": _summarize(custo),
        "ebitda": _summarize(ebitda),
    }


# ── Cenários ──────────────────────────────────────────────────────────────────

class CenariosRequest(BaseModel):
    opcao: OpcaoCenario
    ny: float = 20.0
    moagem: float = 1300000.0
    cambio: float = 5.25
    preco_etanol: float = 2768.90


@app.post("/api/cenarios")
@limiter.limit("20/minute")
def simular_cenarios(
    request: Request,
    body: CenariosRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Breakeven analysis + probability distribution for operational variables."""
    import numpy as np
    from scipy.stats import norm as _norm

    cfg = _ler_constantes(
        "fator_conversao_mtm", "cenarios_custo_fixo_1", "cenarios_custo_fixo_2", "cenarios_custo_fixo_3",
    )
    fator = cfg["fator_conversao_mtm"]
    custo_fixo = cfg["cenarios_custo_fixo_1"] + cfg["cenarios_custo_fixo_2"] + cfg["cenarios_custo_fixo_3"]

    def _ebitda(moagem: float, cambio: float, preco_etanol: float, ny: float) -> float:
        vhp = (89.45 * 0.8346 * moagem) / 1000
        eth = (0.1654 * 80.18 * moagem + 327.19 * 60075) / 1000
        fat = (
            (vhp - 4047) * (ny - 0.19) * fator * cambio
            + (eth - 1000) * (preco_etanol + 349.83) * 0.96
            + 3227430 + 22061958
            + 12000 * (ny + 1) * 22.0462 * 0.75 * cambio
        )
        custo = 0.6 * 0.93 * (
            (vhp - 4047) * (ny - 0.19) * fator * cambio
            + (eth - 1000) * (preco_etanol + 349.83) * 0.96
            + 12000 * (ny + 1) * 22.0462 * 0.75 * cambio
        ) + custo_fixo
        return fat - custo

    from scipy.optimize import brentq

    # EBITDA is increasing in every variable, so the breakeven is the unique root.
    # The old upward step-search returned the input itself whenever EBITDA was
    # already positive (true for the defaults), so it never found the real breakeven.
    base = {"moagem": body.moagem, "cambio": body.cambio, "preco_etanol": body.preco_etanol, "ny": body.ny}
    key = {"Moagem": "moagem", "Câmbio": "cambio", "NY": "ny", "Preço Etanol": "preco_etanol"}[body.opcao]

    def f(x: float) -> float:
        return _ebitda(**{**base, key: x})

    try:
        # O front envia 0 na variável analisada; a escala do intervalo vem do valor típico (default do modelo).
        escala = max(base[key], CenariosRequest.model_fields[key].default)
        breakeven = brentq(f, 1e-6, escala * 100)
    except ValueError:
        raise HTTPException(status_code=422, detail="Sem breakeven no intervalo para esses parâmetros.")

    dist_params: dict[str, dict] = {
        "Moagem":       {"media": 1300000.0, "p80": 1400000.0},
        "Câmbio":       {"media": 5.2504,    "p80": 5.4293},
        "NY":           {"media": 20.5572,   "p80": 22.3796},
        "Preço Etanol": {"media": 2768.90,   "p80": 3000.28},
    }
    dp = dist_params[body.opcao]
    std = (dp["p80"] - dp["media"]) / _norm.ppf(0.8)
    media = dp["media"]

    prob = float(_norm.cdf(breakeven, loc=media, scale=std))
    pcts = list(range(5, 100, 5))
    percentis = [{"p": p, "v": round(float(_norm.ppf(p / 100, loc=media, scale=std)), 4)} for p in pcts]
    x_vals = np.linspace(media - 3 * std, media + 3 * std, 200)
    distribuicao = [{"x": round(float(xi), 4), "y": round(float(_norm.pdf(xi, loc=media, scale=std)), 8)} for xi in x_vals]

    return {
        "opcao": body.opcao,
        "breakeven": round(breakeven, 4),
        "probabilidade_abaixo": round(prob, 4),
        "media": round(media, 4),
        "std": round(std, 4),
        "percentis": percentis,
        "distribuicao": distribuicao,
    }

# ── Posições da safra (routers/posicoes.py) ──
from routers import posicoes as _posicoes  # noqa: E402
app.include_router(_posicoes.router)
# Previsão do câmbio (faixa de possibilidades): routers/cambio.py
from routers.cambio import router as cambio_router  # noqa: E402
app.include_router(cambio_router)
# Hedge cambial: routers/hedge_cambial.py
from routers.hedge_cambial import router as hedge_cambial_router  # noqa: E402
app.include_router(hedge_cambial_router)

# Rotas de conta: routers/conta.py
from routers import conta as _conta  # noqa: E402
app.include_router(_conta.router)

# Rotas de opcoes: routers/opcoes.py
from routers import opcoes as _opcoes  # noqa: E402
app.include_router(_opcoes.router)

# Rotas de regressao: routers/regressao.py
from routers import regressao as _regressao  # noqa: E402
app.include_router(_regressao.router)

# Rotas de simulacoes: routers/simulacoes.py
from routers import simulacoes as _simulacoes  # noqa: E402
app.include_router(_simulacoes.router)

# Rotas de atr_usinas: routers/atr_usinas.py
from routers import atr_usinas as _atr_usinas  # noqa: E402
app.include_router(_atr_usinas.router)

# Rotas de admin: routers/admin.py
from routers import admin as _admin  # noqa: E402
app.include_router(_admin.router)
