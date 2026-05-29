"""
Public share links — read-only snapshots of a user's position or consolidado.
POST /api/share          — create a share link (auth required)
GET  /api/share/{token}  — return read-only data (public, no auth)
"""
import logging
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from db import get_supabase

from auth import get_current_user
from market_cache import get_prices
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


def _db():
    return get_supabase()


def _get_price(ticker: str) -> float | None:
    today = date.today()
    rows = get_prices(ticker, today - timedelta(days=7), today)
    return float(rows[-1]["close"]) if rows else None


def _assemble_posicao(user_id: str) -> dict:
    db = _db()
    fixacoes = (
        db.table("fixacoes_cobertura")
        .select("ticker,volume,preco,data_fixacao,label")
        .eq("user_id", user_id)
        .order("data_fixacao", desc=False)
        .execute()
    ).data

    preco_atual = _get_price("SB=F")
    result: dict = {"fixacoes": fixacoes, "preco_atual": preco_atual, "generated_at": datetime.now(timezone.utc).isoformat()}

    if fixacoes:
        sugar = [f for f in fixacoes if f["ticker"] == "SB=F"]
        if sugar:
            vol = sum(f["volume"] for f in sugar)
            avg = sum(f["volume"] * f["preco"] for f in sugar) / vol
            result["volume_total"] = round(vol, 2)
            result["preco_medio"] = round(avg, 4)
            result["pl_unitario"] = round((avg - preco_atual) if preco_atual else 0, 4)

    return result


class ShareCreateRequest(BaseModel):
    type: str = "posicao"      # "posicao" | "consolidado"
    expires_days: int = 30


@router.post("/api/share", status_code=201)
@limiter.limit("10/minute")
async def create_share(
    request: Request,
    body: ShareCreateRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    if body.type not in ("posicao", "consolidado"):
        raise HTTPException(400, "type must be 'posicao' or 'consolidado'")

    token = secrets.token_urlsafe(24)
    expires = (datetime.now(timezone.utc) + timedelta(days=max(1, min(body.expires_days, 90)))).isoformat()

    _db().table("share_links").insert({
        "user_id": user["id"],
        "type": body.type,
        "token": token,
        "expires_at": expires,
    }).execute()

    frontend = os.getenv("FRONTEND_URL", "http://localhost:3000")
    return {"token": token, "url": f"{frontend}/share/{token}", "expires_at": expires}


@router.get("/api/share/{token}")
@limiter.limit("60/minute")
async def get_share(request: Request, token: str):
    """Public — no auth required. Returns read-only snapshot."""
    db = _db()
    now = datetime.now(timezone.utc).isoformat()

    row = (
        db.table("share_links")
        .select("*")
        .eq("token", token)
        .gt("expires_at", now)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(404, "Link inválido ou expirado.")

    link = row.data
    if link["type"] == "posicao":
        data = _assemble_posicao(link["user_id"])
    else:
        data = _assemble_posicao(link["user_id"])  # same snapshot for now

    return {"type": link["type"], "expires_at": link["expires_at"], "data": data}


@router.delete("/api/share/{token}")
@limiter.limit("20/minute")
async def delete_share(
    request: Request,
    token: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    result = (
        _db().table("share_links")
        .delete()
        .eq("token", token)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Link não encontrado.")
    return {"deleted": True}
