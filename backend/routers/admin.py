"""Administração: sugestões de ativos, backfill, configuração (admin_config), usinas e usuários."""

import logging
import os
import re
from datetime import date
from typing import Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import require_admin
from market_cache import backfill_ticker, supa_client
from postgrest.exceptions import APIError
from validacao import validate_ticker, _validar_paginacao
from constantes import CONSTANTES_NEGOCIO, _valor_numerico
from limiter import limiter
from fastapi import APIRouter


router = APIRouter()

logger = logging.getLogger(__name__)


class AtrUsinaCreateBody(BaseModel):
    nome: str = Field(min_length=2, max_length=100)


@router.get("/api/admin/suggestions")
@limiter.limit("20/minute")
def admin_list_suggestions(
    request: Request,
    user: Annotated[dict, Depends(require_admin)],
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """ADM-01: Return ticker suggestions. Optionally filter by status=pending|approved|rejected."""
    _validar_paginacao(limit, offset)
    client = supa_client()
    query = client.table("tickers_catalog").select(
        "id,ticker,nome,tipo,status,backfill_status,review_note,adicionado_por,created_at"
    ).order("created_at", desc=False)
    if status:
        query = query.eq("status", status)
    query = query.range(offset, offset + limit - 1)
    result = query.execute()
    return {"suggestions": result.data}


class SuggestionReviewRequest(BaseModel):
    action: str          # "approve" | "reject"
    review_note: str = ""


@router.patch("/api/admin/suggestions/{suggestion_id}")
@limiter.limit("20/minute")
def admin_review_suggestion(
    request: Request,
    suggestion_id: UUID,
    body: SuggestionReviewRequest,
    user: Annotated[dict, Depends(require_admin)],
):
    """
    ADM-02: Approve or reject a ticker suggestion.
    ADM-03: On approve, calls backfill_ticker() synchronously and sets backfill_status='done'.
    ADM-04: On reject, stores review_note and sets status='rejected'.
    """
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Ação inválida: use 'approve' ou 'reject'.")

    client = supa_client()

    # Fetch the suggestion to get the ticker symbol
    existing = (
        client.table("tickers_catalog")
        .select("id,ticker,status")
        .eq("id", str(suggestion_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Sugestão não encontrada.")

    ticker = existing.data[0]["ticker"]

    if body.action == "approve":
        # ADM-03: trigger backfill synchronously — completes within the request
        backfill_ticker(ticker)
        update_payload = {
            "status": "approved",
            "backfill_status": "done",
            "review_note": body.review_note or None,
        }
    else:  # reject
        update_payload = {
            "status": "rejected",
            "review_note": body.review_note or None,
        }

    client.table("tickers_catalog").update(update_payload).eq("id", str(suggestion_id)).execute()

    return {"id": str(suggestion_id), "ticker": ticker, **update_payload}


@router.post("/api/admin/market/backfill/{ticker}")
@limiter.limit("5/minute")
def admin_backfill(
    request: Request,
    ticker: str,
    user: Annotated[dict, Depends(require_admin)],
):
    """
    MKT-04: Admin triggers full backfill for a ticker.
    Uses backfill_ticker() which handles tickers with history starting after 2013-01-01.
    Updates backfill_status in tickers_catalog on completion.
    """
    ticker = validate_ticker(ticker)
    result = backfill_ticker(ticker)

    # Update tickers_catalog backfill_status
    client = supa_client()
    client.table("tickers_catalog").update(
        {"backfill_status": "done"}
    ).eq("ticker", ticker.upper()).execute()

    return result


# ── Admin Config ───────────────────────────────────────────────────────────────

class AdminConfigUpdateRequest(BaseModel):
    value: str = Field(max_length=2000)
    description: str | None = Field(default=None, max_length=500)


@router.get("/api/admin/config")
@limiter.limit("20/minute")
def admin_get_config(
    request: Request,
    user: Annotated[dict, Depends(require_admin)],
):
    """Return all admin_config rows ordered by key."""
    client = supa_client()
    result = (
        client.table("admin_config")
        .select("key,value,description,updated_at")
        .order("key")
        .execute()
    )
    return {"config": result.data}


@router.put("/api/admin/config/{key}")
@limiter.limit("20/minute")
def admin_update_config(
    request: Request,
    key: str,
    body: AdminConfigUpdateRequest,
    user: Annotated[dict, Depends(require_admin)],
):
    """Upsert a key/value pair in admin_config. Constantes de negócio precisam ser numéricas (HARD-04)."""
    if not re.fullmatch(r"[a-z0-9_]{1,64}", key):
        raise HTTPException(status_code=422, detail="Chave inválida: use letras minúsculas, números e '_' (até 64 caracteres).")
    valor = body.value
    if key in CONSTANTES_NEGOCIO:
        try:
            _valor_numerico(body.value)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"O valor de {key} precisa ser numérico.")
        # Grava o texto normalizado (ponto decimal, sem notação científica) para a leitura bater
        valor = body.value.strip().replace(",", ".")
    client = supa_client()
    payload = {
        "key": key,
        "value": valor,
        "updated_at": date.today().isoformat(),
    }
    if body.description is not None:
        payload["description"] = body.description
    client.table("admin_config").upsert(payload, on_conflict="key").execute()
    return {"key": key, "value": valor, "saved": True}


# ── Admin — Usinas ──────────────────────────────────────────────────────────────

@router.get("/api/admin/usinas")
@limiter.limit("20/minute")
def admin_usinas_list(request: Request, _: Annotated[dict, Depends(require_admin)]):
    """Admin: lista todas as usinas cadastradas."""
    supa = supa_client()
    rows = supa.table("usinas").select("id, nome, created_at").order("nome").execute().data
    return {"usinas": rows}


@router.post("/api/admin/usinas")
@limiter.limit("10/minute")
def admin_usinas_create(request: Request, body: AtrUsinaCreateBody, _: Annotated[dict, Depends(require_admin)]):
    """Admin: cria uma nova usina."""
    supa = supa_client()
    try:
        row = supa.table("usinas").insert({"nome": body.nome}).execute().data[0]
    except APIError as exc:
        if exc.code == "23505":
            raise HTTPException(status_code=409, detail="Usina com este nome já existe.")
        raise
    return {"id": row["id"], "nome": row["nome"]}


@router.delete("/api/admin/usinas/{usina_id}")
@limiter.limit("10/minute")
def admin_usinas_delete(request: Request, usina_id: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: deleta uma usina pelo ID."""
    supa = supa_client()
    supa.table("usinas").delete().eq("id", usina_id).execute()
    return {"ok": True}


@router.post("/api/admin/usinas/{usina_id}/usuarios/{user_id_target}")
@limiter.limit("10/minute")
def admin_usinas_add_user(request: Request, usina_id: str, user_id_target: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: associa um usuário a uma usina."""
    supa = supa_client()
    try:
        supa.table("user_usinas").insert({"usina_id": usina_id, "user_id": user_id_target}).execute()
    except APIError as exc:
        if exc.code == "23505":
            raise HTTPException(status_code=409, detail="Associação já existe.")
        raise
    return {"ok": True}


@router.delete("/api/admin/usinas/{usina_id}/usuarios/{user_id_target}")
@limiter.limit("10/minute")
def admin_usinas_remove_user(request: Request, usina_id: str, user_id_target: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: remove associação de usuário com usina."""
    supa = supa_client()
    supa.table("user_usinas").delete().eq("usina_id", usina_id).eq("user_id", user_id_target).execute()
    return {"ok": True}


TAMANHO_PAGINA_USUARIOS = 1000


MAX_PAGINAS_USUARIOS = 50


def _todos_usuarios(supa) -> list:
    """HARD-03: percorre todas as páginas do Supabase Auth, ordenadas por e-mail."""
    usuarios: list = []
    for pagina in range(1, MAX_PAGINAS_USUARIOS + 1):
        lote = supa.auth.admin.list_users(page=pagina, per_page=TAMANHO_PAGINA_USUARIOS)
        if not lote:  # não confia no tamanho da página: o servidor pode limitar per_page
            break
        usuarios.extend(lote)
    else:
        logger.warning("Lista de usuários cortada em %d páginas.", MAX_PAGINAS_USUARIOS)
    return sorted(usuarios, key=lambda u: u.email or "")


@router.get("/api/admin/usuarios")
@limiter.limit("10/minute")
def admin_usuarios_list(request: Request, _: Annotated[dict, Depends(require_admin)]):
    """Admin: lista todos os usuários cadastrados no Supabase Auth."""
    users = _todos_usuarios(supa_client())
    return {"usuarios": [{"id": u.id, "email": u.email} for u in users]}


@router.get("/api/admin/usinas/{usina_id}/usuarios")
@limiter.limit("20/minute")
def admin_usinas_usuarios_list(request: Request, usina_id: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: lista IDs dos usuários associados a uma usina."""
    supa = supa_client()
    rows = supa.table("user_usinas").select("user_id").eq("usina_id", usina_id).execute().data
    return {"user_ids": [r["user_id"] for r in rows]}
