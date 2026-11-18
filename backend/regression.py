"""
regression.py — OLS regression for USD/BRL prediction.

Uses BCB (python-bcb SGS) and FRED (requests) for historical data.
bcb is imported lazily inside functions to match the pattern used in main.py.
"""

from __future__ import annotations

import logging
import os
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import requests
import statsmodels.api as sm

from market_cache import get_prices

logger = logging.getLogger(__name__)


def _serie_cache(ticker: str, inicio: date, fim: date | None = None) -> pd.Series:
    """Fechamentos diários do cache de preços (índice de datas); vazia se não houver dados."""
    linhas = [r for r in get_prices(ticker, inicio, fim or date.today()) if r["close"] is not None]
    if not linhas:
        return pd.Series(dtype=float)
    return pd.Series([float(r["close"]) for r in linhas], index=pd.to_datetime([r["date"] for r in linhas]))

# BCB SGS series codes
_BCB_SERIES = {
    "selic": 432,          # Selic meta rate (% a.a.)
    "m2_bcb": 27839,       # M2 monetary aggregate — 27839 is the current active series
    "prod_industrial": 21859,  # Industrial Production index
}

# FRED series IDs
_FRED_SERIES = {
    "fed_funds": "FEDFUNDS",
    "m2_fred": "M2SL",
    "indpro": "INDPRO",
}

_FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"


def _fetch_fred_latest(series_id: str) -> Optional[float]:
    """Fetch the most recent observation for a FRED series. Returns None on failure."""
    api_key = os.getenv("FRED_API_KEY", "")
    if not api_key:
        logger.warning("FRED_API_KEY not set; skipping FRED fetch for %s", series_id)
        return None
    try:
        resp = requests.get(
            _FRED_BASE,
            params={
                "series_id": series_id,
                "api_key": api_key,
                "sort_order": "desc",
                "limit": 1,
                "file_type": "json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        obs = resp.json().get("observations", [])
        if not obs:
            return None
        val = obs[0].get("value", ".")
        return float(val) if val != "." else None
    except Exception as exc:
        logger.warning("FRED fetch failed for %s: %s", series_id, exc)
        return None


def _fetch_fred_history(series_id: str, observation_start: str) -> pd.Series:
    """
    Fetch all monthly observations for a FRED series since observation_start.
    Returns a pd.Series indexed by period (YYYY-MM).
    Returns empty Series on failure.
    """
    api_key = os.getenv("FRED_API_KEY", "")
    if not api_key:
        logger.warning("FRED_API_KEY not set; returning empty series for %s", series_id)
        return pd.Series(dtype=float)
    try:
        resp = requests.get(
            _FRED_BASE,
            params={
                "series_id": series_id,
                "api_key": api_key,
                "observation_start": observation_start,
                "frequency": "m",
                "file_type": "json",
            },
            timeout=15,
        )
        resp.raise_for_status()
        obs = resp.json().get("observations", [])
        if not obs:
            return pd.Series(dtype=float)
        records = []
        for o in obs:
            try:
                val = float(o["value"]) if o["value"] != "." else None
                if val is not None:
                    records.append({"period": o["date"][:7], "value": val})
            except (ValueError, KeyError):
                continue
        if not records:
            return pd.Series(dtype=float)
        df = pd.DataFrame(records).set_index("period")["value"]
        df.index = pd.PeriodIndex(df.index, freq="M").strftime("%Y-%m")
        return df
    except Exception as exc:
        logger.warning("FRED history fetch failed for %s: %s", series_id, exc)
        return pd.Series(dtype=float)


def get_dolar_defaults() -> dict:
    """
    Return latest BCB + FRED indicator values to pre-fill frontend inputs.
    Keys: selic, m2_bcb, prod_industrial, fed_funds, m2_fred, indpro
    Returns None for any key that fails to fetch — frontend tolerates nulls.
    """
    result: dict = {}

    # BCB latest values — fetch each series individually so one failure doesn't kill the rest
    try:
        from bcb import sgs  # lazy import inside try so ImportError is caught
        today = date.today()
        start = today - timedelta(days=120)  # last 4 months to ensure monthly series have a value
        for key, code in _BCB_SERIES.items():
            try:
                data = sgs.get(code, start=start, end=today)
                col = data.dropna() if isinstance(data, pd.Series) else data.iloc[:, 0].dropna()
                result[key] = float(col.iloc[-1]) if not col.empty else None
            except Exception as exc:
                logger.warning("BCB defaults fetch failed for %s (%s): %s", key, code, exc)
                result[key] = None
    except Exception as exc:
        logger.warning("BCB import failed: %s", exc)
        for key in _BCB_SERIES:
            result[key] = None

    # FRED latest values
    for key, sid in _FRED_SERIES.items():
        result[key] = _fetch_fred_latest(sid)

    return result


def _so_meses_fechados(mensal: pd.Series, hoje: date) -> pd.Series:
    """Remove o mês corrente (parcial): resample('ME') cria esse grupo mesmo com o mês incompleto."""
    return mensal[mensal.index < pd.Timestamp(hoje.replace(day=1))]


# Janela padrão: 72 meses (~6 anos) para capturar ciclos de juros BR e EUA
def fetch_dolar_history(months: int = 72) -> pd.DataFrame:
    """
    Fetch monthly BCB + FRED + USDBRL=X history for the past `months` months.

    Returns DataFrame with columns:
        taxa_dolar, selic, m2_bcb, prod_industrial, fed_funds, m2_fred, indpro

    Raises ValueError if fewer than 24 rows remain after merging all series.
    """
    today = date.today()
    start = today - timedelta(days=months * 31)
    start_str = start.strftime("%Y-%m-%d")

    # ── BCB monthly data — fetch each series individually ─────────────────────
    bcb_df = pd.DataFrame()
    try:
        from bcb import sgs  # lazy import inside try so ImportError is caught
        for key, code in _BCB_SERIES.items():
            try:
                raw = sgs.get(code, start=start, end=today)
                s = raw.dropna() if isinstance(raw, pd.Series) else raw.iloc[:, 0].dropna()
                series = _so_meses_fechados(s.resample("ME").last(), today)
                series.index = series.index.strftime("%Y-%m")
                bcb_df[key] = series
            except Exception as exc:
                logger.error("BCB history fetch failed for %s (%s): %s", key, code, exc)
    except Exception as exc:
        logger.error("BCB import failed: %s", exc)

    # ── FRED monthly data ─────────────────────────────────────────────────────
    fred_df = pd.DataFrame()
    for key, sid in _FRED_SERIES.items():
        s = _fetch_fred_history(sid, start_str)
        if not s.empty:
            fred_df[key] = s

    # ── USD/BRL: último fechamento de cada mês, a partir dos diários do cache ──
    usdbrl_df = pd.DataFrame()
    diario = _serie_cache("USDBRL=X", start, today)
    if not diario.empty:
        mensal = _so_meses_fechados(diario.resample("ME").last().dropna(), today)
        mensal.index = mensal.index.strftime("%Y-%m")
        usdbrl_df["taxa_dolar"] = mensal

    # ── Merge on period (YYYY-MM) index ──────────────────────────────────────
    merged = usdbrl_df.copy()
    for df in [bcb_df, fred_df]:
        if not df.empty:
            merged = merged.join(df, how="left")

    merged = merged.dropna().sort_index()

    if len(merged) < 24:
        raise ValueError(
            f"Dados insuficientes: menos de 24 meses após merge (obtidos: {len(merged)})"
        )

    merged.attrs["ultimo_dado"] = diario.index[-1].strftime("%Y-%m-%d") if not diario.empty else None
    return merged


def run_dolar_regression(inputs: dict) -> dict:
    """
    Train OLS on historical BCB+FRED data and predict taxa_dolar for given inputs.

    Args:
        inputs: dict with keys selic, m2_bcb, prod_industrial, fed_funds, m2_fred, indpro

    Returns:
        dict with taxa_prevista, r2, rmse, coeficientes, correlacao
    """
    all_feature_cols = ["selic", "m2_bcb", "prod_industrial", "fed_funds", "m2_fred", "indpro"]

    df = fetch_dolar_history(months=72)

    # Use only features that are actually present in the history DataFrame
    feature_cols = [c for c in all_feature_cols if c in df.columns]
    if len(feature_cols) < 2:
        raise ValueError(f"Dados insuficientes: apenas {len(feature_cols)} features disponíveis após merge")

    y = df["taxa_dolar"].values.astype(float)
    X = df[feature_cols].values.astype(float)

    fitted = _ajuste_ols(X, y)

    entrada = _vetor_entrada(inputs, feature_cols)
    taxa_prevista = float(fitted.predict(sm.add_constant(entrada, has_constant="add"))[0])

    avaliacao = avaliar_walk_forward(X, y)

    params_names = ["const"] + feature_cols
    named_coefs = {
        params_names[i] if i < len(params_names) else f"x{i}": float(v)
        for i, v in enumerate(fitted.params)
    }

    return {
        "taxa_prevista": round(taxa_prevista, 4),
        "taxa_atual": round(float(y[-1]), 4),
        "ultimo_dado": df.attrs.get("ultimo_dado"),
        **avaliacao,
        "coeficientes": named_coefs,
    }


def _ajuste_ols(X: np.ndarray, y: np.ndarray):
    return sm.OLS(endog=y, exog=sm.add_constant(X, has_constant="add")).fit()


def avaliar_walk_forward(X: np.ndarray, y: np.ndarray, inicio: int = 36) -> dict:
    """
    Previsão de um passo à frente, janela expansiva, a partir de `inicio` observações.
    Compara com o random walk (previsão = último nível observado), usando erro em log.
    O X do mês previsto é o realizado: a métrica mede o ajuste dado o cenário macro,
    não a previsão pura das variáveis macro.

    r2_fora_amostra = 1 − SSE_modelo / SSE_random_walk (em log). Positivo só se o modelo erra menos.
    """
    erros_modelo, erros_rw, erros_nivel = [], [], []
    for t in range(inicio, len(y)):
        ajuste = _ajuste_ols(X[:t], y[:t])
        prev = float(ajuste.predict(sm.add_constant(X[t:t + 1], has_constant="add"))[0])
        prev = max(prev, 1e-9)
        base, real = y[t - 1], y[t]
        erros_modelo.append(np.log(prev) - np.log(real))
        erros_rw.append(np.log(base) - np.log(real))
        erros_nivel.append(prev - real)

    n = len(erros_modelo)
    if n == 0 or np.sum(np.square(erros_rw)) == 0:
        return {"r2_fora_amostra": None, "rmse_fora_amostra": None, "supera_random_walk": False, "n_previsoes": n}

    r2 = 1 - np.sum(np.square(erros_modelo)) / np.sum(np.square(erros_rw))
    rmse = float(np.sqrt(np.mean(np.square(erros_nivel))))
    return {
        "r2_fora_amostra": round(float(r2), 4),
        "rmse_fora_amostra": round(rmse, 4),
        # Exige ao menos 24 previsões fora da amostra antes de dizer que supera
        "supera_random_walk": bool(n >= 24 and r2 > 0),
        "n_previsoes": n,
    }


# ── Sugar (Açúcar) regression ────────────────────────────────────────────────

_USDA_DEFAULTS = {
    "estoque_inicial": 48.5,     # million metric tons (MMT) — estoque_final de 2025
    "producao": 190.0,           # MMT — projeção safra 2025/26
    "demanda": 182.0,            # MMT
    "estoque_final": 48.5,       # MMT
}

_USDA_ANNUAL = {
    "year": [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    "estoque_inicial": [35.2, 38.1, 39.8, 47.5, 55.4, 53.5, 53.0, 48.4, 45.0, 44.7, 46.5, 47.0],
    "producao":        [178.4, 168.9, 172.6, 185.1, 185.5, 187.3, 176.8, 183.4, 183.8, 185.0, 186.0, 188.0],
    "demanda":         [166.5, 163.7, 165.4, 168.3, 171.4, 174.6, 172.9, 177.5, 179.5, 178.0, 178.5, 180.5],
    "estoque_final":   [38.1, 39.8, 47.5, 55.4, 53.5, 53.0, 48.4, 45.0, 44.7, 46.5, 47.0, 48.5],
    # Note: the inner join with yfinance annual data will naturally exclude year 2025
    # if yfinance does not yet have a full-year closing price for SB=F (expected behavior).
}


def get_acucar_defaults() -> dict:
    """
    Return latest yfinance prices for SB=F, USDBRL=X, CL=F plus USDA demand/supply defaults
    to pre-fill frontend inputs.
    Returns None for any ticker that fails to fetch.
    """
    result: dict = {}
    tickers = {"sb_f": "SB=F", "usdbrl": "USDBRL=X", "cl_f": "CL=F"}
    for key, ticker in tickers.items():
        serie = _serie_cache(ticker, date.today() - timedelta(days=10))
        result[key] = float(serie.iloc[-1]) if not serie.empty else None
        if key == "sb_f":
            result["ultimo_dado"] = serie.index[-1].strftime("%Y-%m-%d") if not serie.empty else None

    result.update(_USDA_DEFAULTS)
    return result


def fetch_acucar_history() -> pd.DataFrame:
    """
    Download annual closes for SB=F, USDBRL=X, and CL=F (2014-today) and merge
    with hardcoded USDA annual supply/demand data.

    Returns DataFrame indexed by year (int) with columns:
        sb_f, usdbrl, cl_f, estoque_inicial, producao, demanda, estoque_final, estoque_uso_pct

    Raises ValueError if fewer than 6 rows remain after merge.
    """
    tickers = {"sb_f": "SB=F", "usdbrl": "USDBRL=X", "cl_f": "CL=F"}
    price_data: dict[str, pd.Series] = {}

    ultimo_dado = None
    for key, ticker in tickers.items():
        diario = _serie_cache(ticker, date(2014, 1, 1))
        if diario.empty:
            logger.warning("Sem preços no cache para %s", ticker)
            price_data[key] = pd.Series(dtype=float)
            continue
        if key == "sb_f":
            ultimo_dado = diario.index[-1].strftime("%Y-%m-%d")
        # Último fechamento de cada ano, indexado pelo ano
        anual = diario.resample("YE").last().dropna()
        anual.index = anual.index.year
        price_data[key] = anual

    # Merge price series into a DataFrame indexed by year
    price_df = pd.DataFrame(price_data)

    # Merge on year index (USDA year Y = safra Y/Y+1; ver spec, alinhamento não feito)
    usda_df = pd.DataFrame(_USDA_ANNUAL).set_index("year")
    merged = price_df.join(usda_df, how="inner").dropna()

    if len(merged) < 6:
        raise ValueError("Histórico insuficiente para estimar o preço (mínimo de 6 anos).")

    merged.attrs["ultimo_dado"] = ultimo_dado
    return merged


# Colunas do modelo do açúcar. estoque_uso_pct saiu: é estoque_final / demanda (colinear).
_ACUCAR_FEATURES = ["estoque_inicial", "producao", "demanda", "estoque_final", "usdbrl", "cl_f"]

# Quantil ~90% (normal bicaudal): faixa = previsão ± Z90 × RMSE fora da amostra.
_Z90 = 1.645


def _fabrica_modelo(model_type: str):
    """Devolve uma função que cria um modelo novo, já com padronização das variáveis."""
    from sklearn.linear_model import RidgeCV
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    def criar():
        if model_type == "xgboost":
            import xgboost as xgb
            est = xgb.XGBRegressor(n_estimators=100, max_depth=3, learning_rate=0.1, random_state=42, n_jobs=1)
        else:
            est = RidgeCV(alphas=[0.1, 1.0, 10.0, 100.0])
        return make_pipeline(StandardScaler(), est)

    return criar


def _previsoes_loo(X: np.ndarray, y: np.ndarray, criar) -> np.ndarray:
    """Predição de cada ano por um modelo treinado sem aquele ano (leave-one-out)."""
    n = len(y)
    pred = np.empty(n)
    for i in range(n):
        treino = np.arange(n) != i
        modelo = criar()
        modelo.fit(X[treino], y[treino])
        pred[i] = modelo.predict(X[i:i + 1])[0]
    return pred


def _confianca(r2_loo: float, rmse_modelo: float, rmse_base: float) -> str:
    # Baixa também se o modelo não bate o chute "ano anterior" (preço é autocorrelacionado)
    if r2_loo < 0.3 or rmse_modelo >= rmse_base:
        return "Baixa"
    if r2_loo <= 0.6:
        return "Moderada"
    return "Boa"


def _vetor_entrada(inputs: dict, colunas: list[str]) -> np.ndarray:
    for col in colunas:
        if inputs.get(col) is None:
            raise ValueError(f"Campo obrigatório ausente: {col}.")
    return np.array([[float(inputs[col]) for col in colunas]])


def run_acucar_regression(inputs: dict, model_type: str = "ridge") -> dict:
    """
    Treina Ridge ou XGBoost (com padronização) nos dados anuais de preço+USDA e
    estima o preço do SB=F. A incerteza e as métricas vêm de leave-one-out:
    não são medidas nos próprios dados de treino.

    Args:
        inputs: dict com as chaves de _ACUCAR_FEATURES
        model_type: "ridge" (padrão) ou "xgboost"

    Returns:
        dict com sb_f_previsto, sb_f_min, sb_f_max, r2_loo, rmse_loo,
        rmse_ano_anterior, r2_treino, n_anos, confianca, historico, ultimo_dado
    """
    from sklearn.metrics import r2_score

    entrada = _vetor_entrada(inputs, _ACUCAR_FEATURES)
    df = fetch_acucar_history()
    y = df["sb_f"].values
    X = df[_ACUCAR_FEATURES].values
    years = df.index.tolist()
    n = len(y)
    criar = _fabrica_modelo(model_type)

    # Fora da amostra: r2 de LOO = 1 − PRESS / Σ(y − ȳ)²
    pred_loo = _previsoes_loo(X, y, criar)
    r2_loo = float(r2_score(y, pred_loo))
    rmse_loo = float(np.sqrt(np.mean((y - pred_loo) ** 2)))

    # Comparação com o chute "preço do ano = preço do ano anterior", nos mesmos anos (2º em diante)
    rmse_loo_comparavel = float(np.sqrt(np.mean((y[1:] - pred_loo[1:]) ** 2)))
    rmse_ano_anterior = float(np.sqrt(np.mean((y[1:] - y[:-1]) ** 2)))

    # Só para referência; não é a métrica mostrada
    modelo = criar()
    modelo.fit(X, y)
    r2_treino = float(r2_score(y, modelo.predict(X)))

    sb_f_previsto = float(modelo.predict(entrada)[0])
    sb_f_min = sb_f_previsto - _Z90 * rmse_loo
    sb_f_max = sb_f_previsto + _Z90 * rmse_loo

    historico = [
        {
            "year": int(year),
            "sb_f_real": round(float(real), 4),
            "sb_f_previsto_fora_amostra": round(float(pred), 4),
        }
        for year, real, pred in zip(years, y, pred_loo)
    ]

    return {
        "sb_f_previsto": round(sb_f_previsto, 4),
        "sb_f_min": round(sb_f_min, 4),
        "sb_f_max": round(sb_f_max, 4),
        "r2_loo": round(r2_loo, 4),
        "rmse_loo": round(rmse_loo, 4),
        "rmse_ano_anterior": round(rmse_ano_anterior, 4),
        "r2_treino": round(r2_treino, 4),
        "n_anos": n,
        "confianca": _confianca(r2_loo, rmse_loo_comparavel, rmse_ano_anterior),
        "historico": historico,
        "ultimo_dado": df.attrs.get("ultimo_dado"),
    }
