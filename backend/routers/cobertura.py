import logging
import os
from typing import Annotated
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from supabase import create_client
from auth import get_current_user
from market_cache import get_prices
from routers.shared import limiter, validate_ticker

logger = logging.getLogger(__name__)
router = APIRouter()


class CoberturaCreateRequest(BaseModel):
    ticker: str = "SB=F"
    volume: float = Field(gt=0, description="Volume em sacas ou contratos")
    preco: float = Field(gt=0, description="Preço fixado (¢/lb para SB=F)")
    data_fixacao: date
    label: str | None = None


@router.get("/api/cobertura")
@limiter.limit("30/minute")
async def list_cobertura(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """List all fixações for the authenticated user."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = (
        client.table("fixacoes_cobertura")
        .select("id,ticker,volume,preco,data_fixacao,label,created_at")
        .eq("user_id", user["id"])
        .order("data_fixacao", desc=True)
        .execute()
    )
    return {"fixacoes": rows.data}


@router.post("/api/cobertura", status_code=201)
@limiter.limit("20/minute")
async def create_cobertura(
    request: Request,
    body: CoberturaCreateRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Register a new fixação (hedged price)."""
    ticker = validate_ticker(body.ticker)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    row = client.table("fixacoes_cobertura").insert({
        "user_id": user["id"],
        "ticker": ticker,
        "volume": body.volume,
        "preco": body.preco,
        "data_fixacao": body.data_fixacao.isoformat(),
        "label": body.label or None,
    }).execute()
    return row.data[0]


@router.delete("/api/cobertura/{fixacao_id}")
@limiter.limit("20/minute")
async def delete_cobertura(
    request: Request,
    fixacao_id: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Delete a fixação entry."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("fixacoes_cobertura")
        .delete()
        .eq("id", fixacao_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Fixação não encontrada")
    return {"deleted": True}


@router.get("/api/cobertura/audit")
@limiter.limit("20/minute")
async def cobertura_audit(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """Return the 50 most recent audit log entries for the authenticated user's fixações."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = (
        client.table("cobertura_audit")
        .select("id,fixacao_id,action,snapshot,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"entries": rows.data}


@router.get("/api/cobertura/summary")
@limiter.limit("20/minute")
async def cobertura_summary(
    request: Request,
    ticker: str = "SB=F",
    producao_total: float = 0,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Returns coverage ratio and average fixed price vs current market price."""
    ticker = validate_ticker(ticker)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = (
        client.table("fixacoes_cobertura")
        .select("volume,preco")
        .eq("user_id", user["id"])
        .eq("ticker", ticker)
        .execute()
    ).data

    if not rows:
        return {
            "ticker": ticker,
            "volume_total": 0,
            "preco_medio": None,
            "preco_atual": None,
            "coverage_pct": None,
            "n_fixacoes": 0,
        }

    volume_total = sum(r["volume"] for r in rows)
    preco_medio = sum(r["volume"] * r["preco"] for r in rows) / volume_total

    today = date.today()
    price_rows = get_prices(ticker, today - timedelta(days=7), today)
    preco_atual = float(price_rows[-1]["close"]) if price_rows else None

    coverage_pct = round(volume_total / producao_total * 100, 2) if producao_total > 0 else None

    return {
        "ticker": ticker,
        "volume_total": round(volume_total, 2),
        "preco_medio": round(preco_medio, 4),
        "preco_atual": round(preco_atual, 4) if preco_atual else None,
        "coverage_pct": coverage_pct,
        "n_fixacoes": len(rows),
    }
