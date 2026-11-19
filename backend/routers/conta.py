"""Conta e saúde: /api/health (sem auth) e /api/me (identidade do usuário logado)."""

import logging
from typing import Annotated
from fastapi import Depends, Request
from fastapi.responses import JSONResponse
from auth import get_current_user
from market_cache import supa_client
from limiter import limiter
from fastapi import APIRouter


router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/api/health")
@limiter.limit("30/minute")
def health(request: Request, deep: bool = False):
    """Sem deep: só diz que o processo responde. Com deep=1: também consulta o Supabase."""
    if not deep:
        return {"status": "ok"}
    try:
        supa_client().table("market_coverage").select("ticker").limit(1).execute()
    except Exception:
        logger.exception("Health profundo: Supabase não respondeu")
        return JSONResponse(status_code=503, content={"status": "degradado", "supabase": "erro"})
    return {"status": "ok", "supabase": "ok"}


@router.get("/api/me")
@limiter.limit("60/minute")
def me(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """Returns current user info — verifies JWT is accepted for normal users."""
    return {"id": user["id"], "email": user["email"], "role": user["role"]}
