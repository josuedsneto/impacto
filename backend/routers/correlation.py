import logging
import time as _time
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from auth import get_current_user
from routers.shared import limiter, validate_ticker, make_yf_session

logger = logging.getLogger(__name__)
router = APIRouter()

_yf_session = make_yf_session()
_corr_cache: dict = {}
_CORR_TTL = 3600  # 1 hour


@router.get("/api/correlation")
@limiter.limit("10/minute")
async def get_correlation(
    request: Request,
    tickers: str = "SB=F,USDBRL=X,CL=F",
    period: str = "1y",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute Pearson correlation matrix of daily log-returns for the given tickers.
    Results are cached for 1 hour per ticker+period combination.
    """
    import asyncio
    import numpy as np
    import pandas as pd
    import yfinance as yf

    ticker_list = [validate_ticker(t.strip()) for t in tickers.split(",") if t.strip()][:6]
    if len(ticker_list) < 2:
        raise HTTPException(status_code=400, detail="At least 2 tickers required")
    if period not in ("3mo", "6mo", "1y", "2y"):
        raise HTTPException(status_code=400, detail="period must be 3mo, 6mo, 1y or 2y")

    cache_key = f"{','.join(sorted(ticker_list))}_{period}"
    now = _time.time()
    if cache_key in _corr_cache and now - _corr_cache[cache_key]["ts"] < _CORR_TTL:
        return _corr_cache[cache_key]["data"]

    def _fetch():
        data = yf.download(ticker_list, period=period, progress=False, auto_adjust=True, session=_yf_session)
        if isinstance(data.columns, pd.MultiIndex):
            closes = data["Close"]
        else:
            closes = data[["Close"]]
            closes.columns = ticker_list
        closes = closes.dropna()
        log_returns = np.log(closes / closes.shift(1)).dropna()
        return log_returns.corr(), len(log_returns)

    loop = asyncio.get_running_loop()
    try:
        corr, n_obs = await loop.run_in_executor(None, _fetch)
    except Exception as exc:
        logger.error("Correlation fetch failed: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to compute correlation matrix")

    tickers_in = list(corr.columns)
    matrix = [[round(float(corr.loc[r, c]), 4) for c in tickers_in] for r in tickers_in]

    result = {
        "tickers": tickers_in,
        "matrix": matrix,
        "period": period,
        "n_observations": n_obs,
    }
    _corr_cache[cache_key] = {"ts": now, "data": result}
    return result
