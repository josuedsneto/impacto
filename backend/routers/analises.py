"""Análises salvas (VaR, Breakeven, Risco, Opções). Spec: .specs/features/minhas-analises."""
import json
from datetime import date
from typing import Annotated, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

from auth import get_current_user
from market_cache import supa_client

# ponytail: limiter próprio (main.py importaria este módulo, então não dá para importar dele).
from limiter import limiter
router = APIRouter()

Ferramenta = Literal["var", "breakeven", "risco", "opcoes"]
MAX_PARAMETROS = 4 * 1024
MAX_RESUMO = 8 * 1024
MAX_LEITURA = 500
COLUNAS = "id,ferramenta,titulo,parametros,resultado_resumo,data_referencia,created_at"


def _tamanho(obj) -> int:
    return len(json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8"))


def _titulo_limpo(v: str) -> str:
    # Checa o tamanho depois do strip: espaços nas pontas não contam.
    v = v.strip()
    if not v:
        raise ValueError("Dê um título para a análise.")
    if len(v) > 120:
        raise ValueError("O título pode ter até 120 caracteres.")
    return v


class AnaliseCreate(BaseModel):
    ferramenta: Ferramenta
    titulo: str
    parametros: dict
    resultado_resumo: dict
    data_referencia: date

    @field_validator("titulo")
    @classmethod
    def _checa_titulo(cls, v: str) -> str:
        return _titulo_limpo(v)


class AnaliseRename(BaseModel):
    titulo: str

    @field_validator("titulo")
    @classmethod
    def _checa_titulo(cls, v: str) -> str:
        return _titulo_limpo(v)


def _valida_tamanhos(parametros: dict, resumo: dict) -> dict:
    if _tamanho(parametros) > MAX_PARAMETROS:
        raise HTTPException(status_code=422, detail="Os dados desta análise são grandes demais para salvar.")
    leitura = resumo.get("leitura")
    if isinstance(leitura, str):
        resumo = {**resumo, "leitura": leitura[:MAX_LEITURA]}
    if _tamanho(resumo) > MAX_RESUMO:
        raise HTTPException(status_code=422, detail="Os dados desta análise são grandes demais para salvar.")
    return resumo


@router.get("/api/analises")
@limiter.limit("60/minute")
def listar_analises(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    ferramenta: Optional[Ferramenta] = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    client = supa_client()
    q = (
        client.table("analises")
        .select(COLUNAS)
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if ferramenta:
        q = q.eq("ferramenta", ferramenta)
    return {"analises": q.execute().data}


@router.get("/api/analises/{analise_id}")
@limiter.limit("60/minute")
def ler_analise(
    request: Request,
    analise_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = supa_client()
    res = (
        client.table("analises")
        .select(COLUNAS)
        .eq("id", str(analise_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return res.data[0]


@router.post("/api/analises", status_code=201)
@limiter.limit("30/minute")
def criar_analise(
    request: Request,
    body: AnaliseCreate,
    user: Annotated[dict, Depends(get_current_user)],
):
    resumo = _valida_tamanhos(body.parametros, body.resultado_resumo)
    client = supa_client()
    saved = client.table("analises").insert({
        "user_id": user["id"],
        "ferramenta": body.ferramenta,
        "titulo": body.titulo,
        "parametros": body.parametros,
        "resultado_resumo": resumo,
        "data_referencia": body.data_referencia.isoformat(),
    }).execute()
    return saved.data[0]


@router.patch("/api/analises/{analise_id}")
@limiter.limit("30/minute")
def renomear_analise(
    request: Request,
    analise_id: UUID,
    body: AnaliseRename,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = supa_client()
    res = (
        client.table("analises")
        .update({"titulo": body.titulo})
        .eq("id", str(analise_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return res.data[0]


@router.delete("/api/analises/{analise_id}")
@limiter.limit("30/minute")
def excluir_analise(
    request: Request,
    analise_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = supa_client()
    res = (
        client.table("analises")
        .delete()
        .eq("id", str(analise_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Análise não encontrada.")
    return {"ok": True}
