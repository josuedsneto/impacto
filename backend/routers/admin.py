import logging
import os
from typing import Annotated
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from db import get_supabase
from auth import get_current_user, require_admin
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


class AdminConfigUpdateRequest(BaseModel):
    value: str
    description: str | None = None


class AtrUsinaCreateBody(BaseModel):
    nome: str = Field(min_length=2, max_length=100)


@router.get("/api/admin/ping")
async def admin_ping(user: Annotated[dict, Depends(require_admin)]):
    """Admin-only route — verifies role enforcement."""
    return {"message": "admin ok", "user": user["email"]}


@router.get("/api/admin/config")
async def admin_get_config(user: Annotated[dict, Depends(require_admin)]):
    """Return all admin_config rows ordered by key."""
    client = get_supabase()
    result = (
        client.table("admin_config")
        .select("key,value,description,updated_at")
        .order("key")
        .execute()
    )
    return {"config": result.data}


@router.put("/api/admin/config/{key}")
async def admin_update_config(
    key: str,
    body: AdminConfigUpdateRequest,
    user: Annotated[dict, Depends(require_admin)],
):
    """Upsert a key/value pair in admin_config."""
    client = get_supabase()
    payload = {"key": key, "value": body.value, "updated_at": date.today().isoformat()}
    if body.description is not None:
        payload["description"] = body.description
    client.table("admin_config").upsert(payload, on_conflict="key").execute()
    return {"key": key, "value": body.value, "saved": True}


@router.get("/api/admin/usinas")
@limiter.limit("20/minute")
async def admin_usinas_list(request: Request, _: Annotated[dict, Depends(require_admin)]):
    supa = get_supabase()
    rows = supa.table("usinas").select("id, nome, created_at").order("nome").execute().data
    return {"usinas": rows}


@router.post("/api/admin/usinas")
@limiter.limit("10/minute")
async def admin_usinas_create(request: Request, body: AtrUsinaCreateBody, _: Annotated[dict, Depends(require_admin)]):
    supa = get_supabase()
    try:
        row = supa.table("usinas").insert({"nome": body.nome}).execute().data[0]
    except Exception:
        raise HTTPException(status_code=409, detail="Usina com este nome já existe.")
    return {"id": row["id"], "nome": row["nome"]}


@router.delete("/api/admin/usinas/{usina_id}")
@limiter.limit("10/minute")
async def admin_usinas_delete(request: Request, usina_id: str, _: Annotated[dict, Depends(require_admin)]):
    supa = get_supabase()
    supa.table("usinas").delete().eq("id", usina_id).execute()
    return {"ok": True}


@router.post("/api/admin/usinas/{usina_id}/usuarios/{user_id_target}")
@limiter.limit("10/minute")
async def admin_usinas_add_user(request: Request, usina_id: str, user_id_target: str, _: Annotated[dict, Depends(require_admin)]):
    supa = get_supabase()
    try:
        supa.table("user_usinas").insert({"usina_id": usina_id, "user_id": user_id_target}).execute()
    except Exception:
        raise HTTPException(status_code=409, detail="Associação já existe.")
    return {"ok": True}


@router.delete("/api/admin/usinas/{usina_id}/usuarios/{user_id_target}")
@limiter.limit("10/minute")
async def admin_usinas_remove_user(request: Request, usina_id: str, user_id_target: str, _: Annotated[dict, Depends(require_admin)]):
    supa = get_supabase()
    supa.table("user_usinas").delete().eq("usina_id", usina_id).eq("user_id", user_id_target).execute()
    return {"ok": True}


@router.get("/api/admin/usuarios")
@limiter.limit("10/minute")
async def admin_usuarios_list(request: Request, _: Annotated[dict, Depends(require_admin)]):
    supa = get_supabase()
    users = supa.auth.admin.list_users()
    return {"usuarios": [{"id": u.id, "email": u.email} for u in users]}


@router.get("/api/admin/usinas/{usina_id}/usuarios")
@limiter.limit("20/minute")
async def admin_usinas_usuarios_list(request: Request, usina_id: str, _: Annotated[dict, Depends(require_admin)]):
    supa = get_supabase()
    rows = supa.table("user_usinas").select("user_id").eq("usina_id", usina_id).execute().data
    return {"user_ids": [r["user_id"] for r in rows]}
