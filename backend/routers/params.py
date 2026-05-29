import logging
import os
from typing import Annotated
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from db import get_supabase
from auth import get_current_user
from routers.shared import limiter, validate_ticker

logger = logging.getLogger(__name__)
router = APIRouter()


class UserParamsRequest(BaseModel):
    volatilidade_custom: float | None = Field(default=None, ge=0, le=5)
    taxa_livre_risco: float | None = Field(default=None, ge=-0.5, le=1)
    pct_bound_preferido: float | None = Field(default=None, ge=0.05, le=2)


class WatchlistAddRequest(BaseModel):
    ticker: str


@router.get("/api/params/{ticker}")
@limiter.limit("60/minute")
async def get_params(
    request: Request,
    ticker: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-01: Return saved simulation params for a ticker, or 404 if not set."""
    client = get_supabase()
    result = (
        client.table("user_parameters")
        .select("*")
        .eq("user_id", user["id"])
        .eq("ticker", ticker.upper())
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Params not found for ticker")
    return result.data[0]


@router.put("/api/params/{ticker}")
@limiter.limit("30/minute")
async def upsert_params(
    request: Request,
    ticker: str,
    body: UserParamsRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-02: Upsert per-ticker simulation params for the authenticated user."""
    update_dict: dict = {}
    if body.volatilidade_custom is not None:
        update_dict["volatilidade_custom"] = body.volatilidade_custom
    if body.taxa_livre_risco is not None:
        update_dict["taxa_livre_risco"] = body.taxa_livre_risco
    if body.pct_bound_preferido is not None:
        update_dict["pct_bound_preferido"] = body.pct_bound_preferido

    if not update_dict:
        raise HTTPException(status_code=400, detail="No params provided")

    update_dict["updated_at"] = date.today().isoformat()

    client = get_supabase()
    client.table("user_parameters").upsert(
        {"user_id": user["id"], "ticker": ticker.upper(), **update_dict},
        on_conflict="user_id,ticker",
    ).execute()

    return {"ticker": ticker.upper(), "saved": True}


@router.get("/api/watchlist")
@limiter.limit("60/minute")
async def get_watchlist(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
    """PARAM-03: Return all tickers in the user's watchlist."""
    client = get_supabase()
    result = (
        client.table("watchlist")
        .select("ticker,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=False)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"tickers": [row["ticker"] for row in result.data]}


@router.post("/api/watchlist", status_code=201)
@limiter.limit("30/minute")
async def add_to_watchlist(
    request: Request,
    body: WatchlistAddRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-03: Add a ticker to the user's watchlist (idempotent)."""
    ticker = validate_ticker(body.ticker)
    client = get_supabase()
    client.table("watchlist").upsert(
        {"user_id": user["id"], "ticker": ticker},
        on_conflict="user_id,ticker",
        ignore_duplicates=True,
    ).execute()
    return {"ticker": ticker, "added": True}


@router.delete("/api/watchlist/{ticker}")
@limiter.limit("30/minute")
async def remove_from_watchlist(
    request: Request,
    ticker: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-03: Remove a ticker from the user's watchlist."""
    client = get_supabase()
    client.table("watchlist").delete().eq("user_id", user["id"]).eq("ticker", ticker.upper()).execute()
    return {"ticker": ticker.upper(), "removed": True}
