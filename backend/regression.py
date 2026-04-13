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
import yfinance as yf
from sklearn.metrics import mean_squared_error

logger = logging.getLogger(__name__)

# BCB SGS series codes
_BCB_SERIES = {
    "selic": 432,          # Selic meta rate (% a.a.)
    "m2_bcb": 1837,        # M2 monetary aggregate (R$ bi)
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

    # BCB latest values
    try:
        from bcb import SGS  # lazy import inside try so ImportError is caught
        sgs = SGS()
        today = date.today()
        start = today - timedelta(days=120)  # last 4 months to ensure monthly series have a value
        data = sgs.get(list(_BCB_SERIES.values()), start=start, end=today)
        for key, code in _BCB_SERIES.items():
            try:
                col = data[code].dropna()
                result[key] = float(col.iloc[-1]) if not col.empty else None
            except Exception:
                result[key] = None
    except Exception as exc:
        logger.warning("BCB defaults fetch failed: %s", exc)
        for key in _BCB_SERIES:
            result[key] = None

    # FRED latest values
    for key, sid in _FRED_SERIES.items():
        result[key] = _fetch_fred_latest(sid)

    return result


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

    # ── BCB monthly data ──────────────────────────────────────────────────────
    bcb_df = pd.DataFrame()
    try:
        from bcb import SGS  # lazy import inside try so ImportError is caught
        sgs = SGS()
        raw = sgs.get(list(_BCB_SERIES.values()), start=start, end=today)
        # Resample to month-end and forward-fill (some series are daily)
        for key, code in _BCB_SERIES.items():
            if code in raw.columns:
                series = raw[code].dropna().resample("ME").last()
                series.index = series.index.strftime("%Y-%m")
                bcb_df[key] = series
    except Exception as exc:
        logger.error("BCB history fetch failed: %s", exc)

    # ── FRED monthly data ─────────────────────────────────────────────────────
    fred_df = pd.DataFrame()
    for key, sid in _FRED_SERIES.items():
        s = _fetch_fred_history(sid, start_str)
        if not s.empty:
            fred_df[key] = s

    # ── USD/BRL monthly closes from yfinance ─────────────────────────────────
    usdbrl_df = pd.DataFrame()
    try:
        raw_usdbrl = yf.download(
            "USDBRL=X",
            start=start_str,
            end=today.strftime("%Y-%m-%d"),
            interval="1mo",
            progress=False,
            auto_adjust=True,
        )
        if not raw_usdbrl.empty:
            close = raw_usdbrl["Close"].dropna()
            close.index = pd.DatetimeIndex(close.index).strftime("%Y-%m")
            usdbrl_df["taxa_dolar"] = close
    except Exception as exc:
        logger.error("yfinance USDBRL=X fetch failed: %s", exc)

    # ── Merge on period (YYYY-MM) index ──────────────────────────────────────
    merged = usdbrl_df.copy()
    for df in [bcb_df, fred_df]:
        if not df.empty:
            merged = merged.join(df, how="left")

    merged = merged.dropna()

    if len(merged) < 24:
        raise ValueError(
            f"Dados insuficientes: menos de 24 meses após merge (obtidos: {len(merged)})"
        )

    return merged


def run_dolar_regression(inputs: dict) -> dict:
    """
    Train OLS on historical BCB+FRED data and predict taxa_dolar for given inputs.

    Args:
        inputs: dict with keys selic, m2_bcb, prod_industrial, fed_funds, m2_fred, indpro

    Returns:
        dict with taxa_prevista, r2, rmse, coeficientes, correlacao
    """
    feature_cols = ["selic", "m2_bcb", "prod_industrial", "fed_funds", "m2_fred", "indpro"]

    df = fetch_dolar_history(months=72)

    y = df["taxa_dolar"].values
    X = df[feature_cols].values

    X_with_const = sm.add_constant(X, has_constant="add")
    fitted = sm.OLS(endog=y, exog=X_with_const).fit()

    rmse = float(np.sqrt(mean_squared_error(y, fitted.fittedvalues)))

    # Predict using user inputs
    input_row = pd.DataFrame([{col: inputs[col] for col in feature_cols}])
    input_with_const = sm.add_constant(input_row, has_constant="add")
    taxa_prevista = float(fitted.predict(input_with_const)[0])

    # Correlation matrix on features + target
    corr_df = df[["taxa_dolar"] + feature_cols]
    correlacao = corr_df.corr().round(4).to_dict()

    # Coefficient dict — rename const to intercept for clarity
    coef_dict = fitted.params.to_dict()
    params_names = ["const"] + feature_cols
    named_coefs = {
        params_names[i] if i < len(params_names) else f"x{i}": float(v)
        for i, v in enumerate(fitted.params)
    }

    return {
        "taxa_prevista": round(taxa_prevista, 4),
        "r2": round(float(fitted.rsquared), 4),
        "rmse": round(rmse, 4),
        "coeficientes": named_coefs,
        "correlacao": correlacao,
    }


# ── Sugar (Açúcar) regression ────────────────────────────────────────────────

_USDA_DEFAULTS = {
    "estoque_inicial": 48.5,     # million metric tons (MMT) — estoque_final de 2025
    "producao": 190.0,           # MMT — projeção safra 2025/26
    "demanda": 182.0,            # MMT
    "estoque_final": 48.5,       # MMT
    "estoque_uso_pct": 26.6,     # estoque_final / demanda * 100 ≈ 26.6
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
        try:
            data = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=True)
            if data.empty:
                result[key] = None
            else:
                close = data["Close"].dropna()
                if close.empty:
                    result[key] = None
                else:
                    last = close.iloc[-1]
                    result[key] = float(last.iloc[0]) if hasattr(last, "iloc") else float(last)
        except Exception as exc:
            logger.warning("yfinance fetch failed for %s (%s): %s", key, ticker, exc)
            result[key] = None

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

    for key, ticker in tickers.items():
        try:
            raw = yf.download(
                ticker,
                start="2014-01-01",
                interval="1y",
                progress=False,
                auto_adjust=True,
            )
            if raw.empty:
                logger.warning("Empty yfinance response for %s", ticker)
                price_data[key] = pd.Series(dtype=float)
                continue
            close = raw["Close"].dropna()
            # Extract year from index
            close.index = pd.DatetimeIndex(close.index).year
            # Keep only one value per year (last in case of duplicates)
            close = close.groupby(close.index).last()
            price_data[key] = close
        except Exception as exc:
            logger.error("yfinance annual fetch failed for %s: %s", ticker, exc)
            price_data[key] = pd.Series(dtype=float)

    # Merge price series into a DataFrame indexed by year
    price_df = pd.DataFrame(price_data)

    # Build USDA DataFrame
    usda_df = pd.DataFrame(_USDA_ANNUAL).set_index("year")
    usda_df["estoque_uso_pct"] = (
        usda_df["estoque_final"] / usda_df["demanda"] * 100
    )

    # Merge on year index
    merged = price_df.join(usda_df, how="inner").dropna()

    if len(merged) < 6:
        raise ValueError(
            f"Dados insuficientes: menos de 6 anos após merge (obtidos: {len(merged)})"
        )

    return merged


def run_acucar_regression(inputs: dict, model_type: str = "ridge") -> dict:
    """
    Train Ridge or XGBoost model on annual yfinance+USDA data and predict
    SB=F price for given inputs.

    Args:
        inputs: dict with keys estoque_inicial, producao, demanda, estoque_final,
                estoque_uso_pct, usdbrl, cl_f
        model_type: "ridge" (default) or "xgboost"

    Returns:
        dict with sb_f_previsto, sb_f_min, sb_f_max, r2, rmse, historico
    """
    from sklearn.linear_model import RidgeCV
    from sklearn.metrics import r2_score, mean_squared_error as skl_mse

    feature_cols = [
        "estoque_inicial", "producao", "demanda", "estoque_final",
        "estoque_uso_pct", "usdbrl", "cl_f",
    ]

    df = fetch_acucar_history()

    y = df["sb_f"].values
    X = df[feature_cols].values
    years = df.index.tolist()

    if model_type == "xgboost":
        import xgboost as xgb
        model = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.1,
            random_state=42,
            n_jobs=1,
        )
    else:
        model = RidgeCV(alphas=[0.1, 1.0, 10.0, 100.0])

    model.fit(X, y)

    y_pred_train = model.predict(X)
    residuals = y - y_pred_train
    std_residuals = float(np.std(residuals))

    input_array = np.array([[inputs[col] for col in feature_cols]])
    sb_f_previsto = float(model.predict(input_array)[0])
    sb_f_min = sb_f_previsto - 1.96 * std_residuals
    sb_f_max = sb_f_previsto + 1.96 * std_residuals

    r2 = float(r2_score(y, y_pred_train))
    try:
        rmse = float(skl_mse(y, y_pred_train, squared=False))
    except TypeError:
        # sklearn >= 1.4 removed squared parameter
        rmse = float(np.sqrt(skl_mse(y, y_pred_train)))

    historico = [
        {
            "year": int(year),
            "sb_f_real": round(float(real), 4),
            "sb_f_previsto": round(float(pred), 4),
        }
        for year, real, pred in zip(years, y, y_pred_train)
    ]

    return {
        "sb_f_previsto": round(sb_f_previsto, 4),
        "sb_f_min": round(sb_f_min, 4),
        "sb_f_max": round(sb_f_max, 4),
        "r2": round(r2, 4),
        "rmse": round(rmse, 4),
        "historico": historico,
    }
