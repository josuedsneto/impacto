"""
Team invite flow.
POST /api/admin/usinas/{usina_id}/invite  — send invite email
POST /api/invites/accept                  — accept via token
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from db import get_supabase

from auth import get_current_user
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

_RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
_RESEND_FROM    = os.getenv("RESEND_FROM", "convites@sugarcane.app")
_FRONTEND_URL   = os.getenv("FRONTEND_URL", "http://localhost:3000")


def _db():
    return get_supabase()


def _send_invite_email(to: str, usina_nome: str, token: str):
    link = f"{_FRONTEND_URL}/aceitar-convite?token={token}"
    html = f"""
<html><body style="font-family:sans-serif;background:#f4f4f4;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;border:1px solid #e5e7eb">
    <div style="background:#052e16;padding:20px 28px">
      <h1 style="color:#4ade80;font-size:18px;margin:0">Convite Sugarcane</h1>
    </div>
    <div style="padding:28px">
      <p style="font-size:15px;color:#111">Você foi convidado para a usina <strong>{usina_nome}</strong> na plataforma Sugarcane.</p>
      <a href="{link}" style="display:inline-block;margin:20px 0;background:#16a34a;color:#fff;padding:12px 28px;border-radius:7px;text-decoration:none;font-weight:700;font-size:14px">Aceitar convite →</a>
      <p style="font-size:12px;color:#9ca3af">O convite expira em 7 dias. Se não solicitou, ignore este email.</p>
    </div>
  </div>
</body></html>"""
    if not _RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping invite email to %s", to)
        return
    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {_RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": _RESEND_FROM, "to": [to], "subject": f"Convite para {usina_nome} no Sugarcane", "html": html},
            timeout=10,
        ).raise_for_status()
    except Exception as exc:
        logger.error("Failed to send invite to %s: %s", to, exc)


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "operator"  # viewer | operator | admin


class AcceptRequest(BaseModel):
    token: str


@router.post("/api/admin/usinas/{usina_id}/invite", status_code=201)
@limiter.limit("10/minute")
async def send_invite(
    request: Request,
    usina_id: str,
    body: InviteRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    db = _db()

    # Caller must be admin of the usina
    membership = (
        db.table("user_usinas")
        .select("role")
        .eq("user_id", user["id"])
        .eq("usina_id", usina_id)
        .maybe_single()
        .execute()
    )
    if not membership.data or membership.data.get("role") not in ("admin",):
        raise HTTPException(403, "Apenas administradores podem convidar membros.")

    usina = db.table("usinas").select("nome").eq("id", usina_id).maybe_single().execute()
    if not usina.data:
        raise HTTPException(404, "Usina não encontrada.")

    token = secrets.token_urlsafe(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    db.table("invites").insert({
        "usina_id": usina_id,
        "invited_by": user["id"],
        "invited_email": body.email,
        "role": body.role,
        "token": token,
        "expires_at": expires,
    }).execute()

    _send_invite_email(body.email, usina.data["nome"], token)
    return {"ok": True, "expires_at": expires}


@router.post("/api/invites/accept")
@limiter.limit("10/minute")
async def accept_invite(
    request: Request,
    body: AcceptRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    db = _db()
    now = datetime.now(timezone.utc).isoformat()

    invite = (
        db.table("invites")
        .select("*")
        .eq("token", body.token)
        .is_("accepted_at", "null")
        .gt("expires_at", now)
        .maybe_single()
        .execute()
    )
    if not invite.data:
        raise HTTPException(400, "Convite inválido ou expirado.")

    inv = invite.data
    # Add user to usina
    db.table("user_usinas").upsert(
        {"user_id": user["id"], "usina_id": inv["usina_id"], "role": inv.get("role", "operator")},
        on_conflict="user_id,usina_id",
    ).execute()

    # Mark accepted
    db.table("invites").update({"accepted_at": now}).eq("id", inv["id"]).execute()

    usina = db.table("usinas").select("nome").eq("id", inv["usina_id"]).maybe_single().execute()
    return {"ok": True, "usina": usina.data.get("nome") if usina.data else ""}


@router.get("/api/invites/validate")
@limiter.limit("20/minute")
async def validate_invite(request: Request, token: str):
    """Public endpoint — check if a token is still valid (for the accept page)."""
    db = _db()
    now = datetime.now(timezone.utc).isoformat()
    invite = (
        db.table("invites")
        .select("invited_email,usina_id,expires_at")
        .eq("token", token)
        .is_("accepted_at", "null")
        .gt("expires_at", now)
        .maybe_single()
        .execute()
    )
    if not invite.data:
        raise HTTPException(400, "Convite inválido ou expirado.")
    usina = db.table("usinas").select("nome").eq("id", invite.data["usina_id"]).maybe_single().execute()
    return {
        "valid": True,
        "invited_email": invite.data["invited_email"],
        "usina_nome": usina.data.get("nome") if usina.data else "",
    }
