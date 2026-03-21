from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated
from datetime import date as date_type
import os
import yfinance as yf
from supabase import create_client
from pydantic import BaseModel
from auth import get_current_user, require_admin
from market_cache import get_prices, backfill_ticker

app = FastAPI(title="Impacto API", version="2.0.0")

# CORS — origins configured via env var; defaults to localhost for local dev
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/me")
async def me(user: Annotated[dict, Depends(get_current_user)]):
    """Returns current user info — verifies JWT is accepted for normal users."""
    return {"id": user["id"], "email": user["email"], "role": user["role"]}


@app.get("/api/admin/ping")
async def admin_ping(user: Annotated[dict, Depends(require_admin)]):
    """Admin-only route — verifies role enforcement."""
    return {"message": "admin ok", "user": user["email"]}


# ── Pydantic models ─────────────────────────────────────────────────────────────

class TickerSuggestRequest(BaseModel):
    ticker: str
    nome: str = ""        # human-readable name, optional
    tipo: str = "equity"  # equity | futures | fx | etf | crypto


# ── Market data ─────────────────────────────────────────────────────────────────

@app.get("/api/market/prices")
async def market_prices(
    ticker: str,
    start: date_type,
    end: date_type,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Return cached OHLCV rows for ticker in [start, end].
    MKT-01: second call returns from DB without calling yfinance.
    MKT-02: only uncached dates are fetched from yfinance.
    """
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")
    rows = get_prices(ticker, start, end)
    return {"ticker": ticker, "start": start.isoformat(), "end": end.isoformat(), "rows": rows}


@app.post("/api/market/suggest")
async def suggest_ticker(
    body: TickerSuggestRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    MKT-03: User suggests a new ticker.
    Validates ticker against yfinance BEFORE writing to DB.
    Returns 400 with visible error if ticker is invalid or has no data.
    On success inserts row into tickers_catalog with status='pending'.
    """
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="ticker cannot be empty")

    # Validate: attempt a minimal yfinance download (last 5 days)
    try:
        probe = yf.download(ticker, period="5d", progress=False, auto_adjust=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"yfinance error for '{ticker}': {exc}")

    if probe.empty:
        raise HTTPException(
            status_code=400,
            detail=f"Ticker '{ticker}' not found on yfinance or has no recent data. "
                   "Check the symbol and try again.",
        )

    # Write to tickers_catalog only after validation passes
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
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
            "message": f"Ticker '{ticker}' already exists with status '{existing.data[0]['status']}'.",
        }

    client.table("tickers_catalog").insert({
        "ticker": ticker,
        "nome": body.nome or ticker,
        "tipo": body.tipo,
        "status": "pending",
        "backfill_status": "pending",
        "suggested_by": user["id"],
    }).execute()

    return {"ticker": ticker, "status": "pending", "message": f"Ticker '{ticker}' submitted for admin review."}


@app.post("/api/admin/market/backfill/{ticker}")
async def admin_backfill(
    ticker: str,
    user: Annotated[dict, Depends(require_admin)],
):
    """
    MKT-04: Admin triggers full backfill for a ticker.
    Uses backfill_ticker() which handles tickers with history starting after 2013-01-01.
    Updates backfill_status in tickers_catalog on completion.
    """
    result = backfill_ticker(ticker.upper())

    # Update tickers_catalog backfill_status
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("tickers_catalog").update(
        {"backfill_status": "done"}
    ).eq("ticker", ticker.upper()).execute()

    return result
