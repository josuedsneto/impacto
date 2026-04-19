import logging
import os
import time as _time
from typing import Annotated
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import get_current_user
from market_cache import get_prices
from routers.shared import limiter, validate_ticker, make_yf_session

logger = logging.getLogger(__name__)
router = APIRouter()

_yf_session = make_yf_session()

# ARIMA pre-computation cache: key = f"{ticker}_{steps}", val = {ts, data}
_arima_cache: dict = {}
_ARIMA_TTL = 3600  # 1 hour

# Volatility cache: key = ticker
_vol_cache: dict = {}
_VOL_TTL = 300  # 5 minutes


@router.get("/api/arima/{ticker}")
@limiter.limit("10/minute")
async def get_arima(
    request: Request,
    ticker: str,
    steps: int = 30,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Fit ARIMA(1,1,1) on 2 years of daily closes and forecast `steps` periods ahead.
    Results are cached for 1 hour per ticker+steps combination.
    """
    import numpy as np
    from statsmodels.tsa.arima.model import ARIMA
    import pandas as pd
    import asyncio
    import yfinance as yf

    ticker = validate_ticker(ticker)
    if steps < 1 or steps > 365:
        raise HTTPException(status_code=400, detail="steps must be between 1 and 365")

    cache_key = f"{ticker}_{steps}"
    now = _time.time()
    if cache_key in _arima_cache and now - _arima_cache[cache_key]["ts"] < _ARIMA_TTL:
        return _arima_cache[cache_key]["data"]

    def _fetch():
        return yf.download(ticker, period="2y", progress=False, auto_adjust=True, session=_yf_session)

    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, _fetch)

    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].squeeze().dropna()

    def _fit():
        model = ARIMA(closes, order=(1, 1, 1))
        fit = model.fit()
        forecast_result = fit.get_forecast(steps=steps)
        return forecast_result.predicted_mean, forecast_result.conf_int(alpha=0.05)

    try:
        forecast_mean, conf_int = await loop.run_in_executor(None, _fit)
    except Exception as exc:
        logger.error("ARIMA fitting failed for '%s': %s", ticker, exc)
        raise HTTPException(status_code=400, detail="ARIMA model fitting failed. Try a different ticker or period.")

    last_date = closes.index[-1]
    forecast_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=steps, freq="B")

    history = closes.iloc[-90:]
    series = [
        {"date": dt.strftime("%Y-%m-%d"), "value": round(float(v), 4)}
        for dt, v in history.items()
    ]

    for i, dt in enumerate(forecast_dates):
        series.append({
            "date": dt.strftime("%Y-%m-%d"),
            "forecast": round(float(forecast_mean.iloc[i]), 4),
            "ci_lower": round(float(conf_int.iloc[i, 0]), 4),
            "ci_upper": round(float(conf_int.iloc[i, 1]), 4),
        })

    result = {"ticker": ticker, "steps": steps, "series": series}
    _arima_cache[cache_key] = {"ts": now, "data": result}
    return result


@router.get("/api/volatility")
@limiter.limit("10/minute")
async def get_volatility(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    import numpy as np
    import pandas as pd
    import asyncio
    import yfinance as yf

    ticker = validate_ticker(ticker)

    now = _time.time()
    if ticker in _vol_cache and now - _vol_cache[ticker]["ts"] < _VOL_TTL:
        return _vol_cache[ticker]["data"]

    def _fetch():
        return yf.download(ticker, period="1y", progress=False, auto_adjust=True, session=_yf_session)

    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, _fetch)

    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].squeeze().dropna()
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

    rolling_30d_list = [{"date": h["date"], "vol": h["vol_30d_rolling"]} for h in history]

    result = {
        "ticker": ticker,
        "vol_30d": round(vol_30d, 6) if vol_30d is not None else None,
        "vol_90d": round(vol_90d, 6) if vol_90d is not None else None,
        "vol_1y": round(vol_1y, 6),
        "last_price": round(last_price, 4),
        "rolling_30d": rolling_30d_list,
    }
    _vol_cache[ticker] = {"ts": now, "data": result}
    return result


@router.get("/api/metas")
@limiter.limit("20/minute")
async def get_metas(
    request: Request,
    meta: float = 2600,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    FATOR = 22.0462 * 1.04
    end = date.today()
    start = date(2013, 1, 1)

    sugar_rows = get_prices("SB=F", start, end)
    fx_rows = get_prices("USDBRL=X", start, end)

    if len(sugar_rows) < 10 or len(fx_rows) < 10:
        raise HTTPException(status_code=503, detail="Dados insuficientes.")

    sugar_map = {r["date"]: r["close"] for r in sugar_rows if r["close"]}
    fx_map = {r["date"]: r["close"] for r in fx_rows if r["close"]}
    common_dates = sorted(set(sugar_map) & set(fx_map))

    mtm_series = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "mtm": round(FATOR * sugar_map[d] * fx_map[d], 2),
            "meta": meta,
        }
        for d in common_dates
    ]

    acucares = [round(24 - 0.5 * i, 2) for i in range(11)]
    dolares = [round(4.8 + 0.05 * i, 2) for i in range(10)]
    heatmap = [[round(FATOR * a * d - meta, 2) for d in dolares] for a in acucares]

    return {
        "meta": meta,
        "mtm_series": mtm_series,
        "heatmap": heatmap,
        "acucares": acucares,
        "dolares": dolares,
    }


class JumpDiffusionRequest(BaseModel):
    ticker: str = "SB=F"
    sigma: float | None = None
    lambda_jumps: float = Field(default=0.1, ge=0, le=5)
    mu_jump: float = Field(default=-0.02, ge=-1, le=1)
    sigma_jump: float = Field(default=0.05, ge=0, le=1)
    steps: int = Field(default=252, ge=10, le=1260)


@router.post("/api/jump-diffusion")
@limiter.limit("15/minute")
async def jump_diffusion(
    request: Request,
    body: JumpDiffusionRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    import numpy as np

    ticker = validate_ticker(body.ticker)
    end = date.today()
    start = end - timedelta(days=3 * 365)
    rows = get_prices(ticker, start, end)

    if len(rows) < 20:
        raise HTTPException(status_code=400, detail="Dados históricos insuficientes.")

    closes = np.array([r["close"] for r in rows if r["close"]], dtype=float)
    log_returns = np.diff(np.log(closes))
    mu = float(np.mean(log_returns))
    sigma = float(body.sigma) if body.sigma is not None else float(np.std(log_returns, ddof=1))
    s0 = float(closes[-1])

    dt = 1.0 / body.steps
    rng = np.random.default_rng()
    prices = [s0]
    for _ in range(body.steps):
        n_jumps = int(rng.poisson(body.lambda_jumps * dt))
        jump_mag = float(np.sum(rng.normal(body.mu_jump, body.sigma_jump, n_jumps))) if n_jumps > 0 else 0.0
        diffusion = (mu - 0.5 * sigma ** 2) * dt + sigma * float(rng.normal()) * (dt ** 0.5)
        prices.append(prices[-1] * float(np.exp(diffusion + jump_mag)))

    return {
        "ticker": ticker,
        "s0": round(s0, 4),
        "sigma": round(sigma, 6),
        "mu": round(mu, 6),
        "prices": [{"step": i, "price": round(p, 4)} for i, p in enumerate(prices)],
        "mean": round(float(np.mean(prices)), 4),
    }
