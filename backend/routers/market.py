import logging
import os
from typing import Annotated, Literal
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from supabase import create_client
from auth import get_current_user, require_admin
from market_cache import get_prices, backfill_ticker
from analysis import compute_analysis, IndicatorConfig
from routers.shared import limiter, validate_ticker

logger = logging.getLogger(__name__)
router = APIRouter()


class TickerSuggestRequest(BaseModel):
    ticker: str
    nome: str = ""
    tipo: Literal["commodity", "fx", "acao", "indice"] = "commodity"


class SuggestionReviewRequest(BaseModel):
    action: str  # "approve" | "reject"
    review_note: str = ""


@router.get("/api/market/prices")
@limiter.limit("30/minute")
async def market_prices(
    request: Request,
    ticker: str,
    start: date,
    end: date,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Return cached OHLCV rows for ticker in [start, end]."""
    ticker = validate_ticker(ticker)
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")
    rows = get_prices(ticker, start, end)
    return {"ticker": ticker, "start": start.isoformat(), "end": end.isoformat(), "rows": rows}


@router.get("/api/market/analysis")
@limiter.limit("20/minute")
async def market_analysis(
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
    import pandas as pd
    import json as _json

    ticker = validate_ticker(ticker)
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")

    selected = [i.strip().lower() for i in indicators.split(",") if i.strip()]
    sma_list = [int(p.strip()) for p in sma_periods.split(",") if p.strip().isdigit()]
    ema_list = [int(p.strip()) for p in ema_periods.split(",") if p.strip().isdigit()]

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
    rows = _json.loads(enriched.to_json(orient="records"))

    return {"ticker": ticker, "rows": rows, "signals": signals}


@router.get("/api/market/status")
@limiter.limit("30/minute")
async def market_status(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Return current market state for a ticker (REGULAR, PRE, POST, CLOSED)."""
    import asyncio
    import yfinance as yf

    ticker = validate_ticker(ticker)

    def _fetch():
        try:
            t = yf.Ticker(ticker)
            return getattr(t.fast_info, "market_state", None) or "CLOSED"
        except Exception:
            return "CLOSED"

    loop = asyncio.get_running_loop()
    state = await loop.run_in_executor(None, _fetch)
    return {"ticker": ticker, "state": state, "open": state == "REGULAR"}


@router.post("/api/market/suggest")
@limiter.limit("10/minute")
async def suggest_ticker(
    request: Request,
    body: TickerSuggestRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """User suggests a new ticker. Validates against yfinance before writing to DB."""
    import asyncio
    import yfinance as yf

    ticker = validate_ticker(body.ticker)

    def _probe():
        return yf.download(ticker, period="5d", progress=False, auto_adjust=True)

    loop = asyncio.get_running_loop()
    try:
        probe = await loop.run_in_executor(None, _probe)
    except Exception as exc:
        logger.error("yfinance error for '%s': %s", ticker, exc)
        raise HTTPException(status_code=400, detail="Failed to fetch market data")

    if probe.empty:
        raise HTTPException(
            status_code=400,
            detail=f"Ticker '{ticker}' not found on yfinance or has no recent data.",
        )

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    existing = client.table("tickers_catalog").select("ticker,status").eq("ticker", ticker).execute()
    if existing.data:
        return {
            "ticker": ticker,
            "status": existing.data[0]["status"],
            "message": f"Ticker '{ticker}' already exists with status '{existing.data[0]['status']}'.",
        }

    client.table("tickers_catalog").insert({
        "ticker": ticker,
        "nome": body.nome or ticker,
        "tipo": body.tipo,
        "status": "pending",
        "backfill_status": "pending",
        "adicionado_por": user["id"],
    }).execute()

    return {"ticker": ticker, "status": "pending", "message": f"Ticker '{ticker}' submitted for admin review."}


@router.get("/api/admin/suggestions")
async def admin_list_suggestions(
    user: Annotated[dict, Depends(require_admin)],
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    query = client.table("tickers_catalog").select(
        "id,ticker,nome,tipo,status,backfill_status,review_note,adicionado_por,created_at"
    ).order("created_at", desc=False)
    if status:
        query = query.eq("status", status)
    query = query.range(offset, offset + limit - 1)
    result = query.execute()
    return {"suggestions": result.data}


@router.patch("/api/admin/suggestions/{suggestion_id}")
async def admin_review_suggestion(
    suggestion_id: UUID,
    body: SuggestionReviewRequest,
    user: Annotated[dict, Depends(require_admin)],
):
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    existing = client.table("tickers_catalog").select("id,ticker,status").eq("id", str(suggestion_id)).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    ticker = existing.data[0]["ticker"]
    if body.action == "approve":
        backfill_ticker(ticker)
        update_payload = {"status": "approved", "backfill_status": "done", "review_note": body.review_note or None}
    else:
        update_payload = {"status": "rejected", "review_note": body.review_note or None}

    client.table("tickers_catalog").update(update_payload).eq("id", str(suggestion_id)).execute()
    return {"id": str(suggestion_id), "ticker": ticker, **update_payload}


@router.post("/api/admin/market/backfill/{ticker}")
async def admin_backfill(
    ticker: str,
    user: Annotated[dict, Depends(require_admin)],
):
    ticker = validate_ticker(ticker)
    result = backfill_ticker(ticker)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("tickers_catalog").update({"backfill_status": "done"}).eq("ticker", ticker.upper()).execute()
    return result
