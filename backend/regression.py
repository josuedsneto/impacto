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
    from bcb import SGS  # lazy import — matches pattern in main.py

    result: dict = {}

    # BCB latest values
    try:
        sgs = SGS()
        today = date.today()
        start = today - timedelta(days=90)  # last 3 months to ensure we get a value
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


def fetch_dolar_history(months: int = 60) -> pd.DataFrame:
    """
    Fetch monthly BCB + FRED + USDBRL=X history for the past `months` months.

    Returns DataFrame with columns:
        taxa_dolar, selic, m2_bcb, prod_industrial, fed_funds, m2_fred, indpro

    Raises ValueError if fewer than 24 rows remain after merging all series.
    """
    from bcb import SGS  # lazy import

    today = date.today()
    start = today - timedelta(days=months * 31)
    start_str = start.strftime("%Y-%m-%d")

    # ── BCB monthly data ──────────────────────────────────────────────────────
    bcb_df = pd.DataFrame()
    try:
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

    df = fetch_dolar_history(months=60)

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
