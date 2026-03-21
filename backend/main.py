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
from simulation import run_simulation

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

class SimulationRequest(BaseModel):
    ticker: str
    preco_inicial: float
    dias_simulados: int = 252
    num_simulacoes: int = 10_000
    pct_bound: float = 0.50
    label: str = ""


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


# ── Simulations ────────────────────────────────────────────────────────────────

@app.post("/api/simulations", status_code=201)
async def create_simulation(
    body: SimulationRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-01: Run MC simulation and persist results.
    Returns scalar metrics + percentiles_series for fan chart rendering.
    """
    result = run_simulation(
        ticker=body.ticker.strip().upper(),
        preco_inicial=body.preco_inicial,
        dias_simulados=body.dias_simulados,
        num_simulacoes=body.num_simulacoes,
        pct_bound=body.pct_bound,
    )

    # Persist to simulations table with user_id (SIM-04: user isolation)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    insert_payload = {
        "user_id": user["id"],
        "ticker": result["ticker"],
        "preco_inicial": result["preco_inicial"],
        "dias_simulados": result["dias_simulados"],
        "num_simulacoes": result["num_simulacoes"],
        "pct_bound": result["pct_bound"],
        "p5": result["p5"],
        "p20": result["p20"],
        "p25": result["p25"],
        "p50": result["p50"],
        "p75": result["p75"],
        "p80": result["p80"],
        "p95": result["p95"],
        "percentiles_series": result["percentiles_series"],
        "label": body.label or None,
    }
    saved = client.table("simulations").insert(insert_payload).execute()
    sim_id = saved.data[0]["id"]

    return {**result, "id": sim_id, "created_at": saved.data[0]["created_at"]}


@app.get("/api/simulations")
async def list_simulations(
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-02/SIM-04: List all simulations for the authenticated user only.
    Returns id, ticker, label, p50, created_at (no percentiles_series to keep payload small).
    """
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("simulations")
        .select("id,ticker,label,preco_inicial,dias_simulados,p5,p50,p95,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return {"simulations": result.data}


@app.get("/api/simulations/{sim_id}")
async def get_simulation(
    sim_id: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-03/SIM-04: Fetch a single simulation including percentiles_series.
    Returns 404 if sim_id does not exist OR belongs to a different user.
    """
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("simulations")
        .select("*")
        .eq("id", sim_id)
        .eq("user_id", user["id"])  # SIM-04: enforces user isolation at query level
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Simulation not found.")
    return result.data[0]
