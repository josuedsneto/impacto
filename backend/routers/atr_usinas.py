"""ATR por usina: usinas do usuário, simulação com IC 90%, histórico compartilhável (ATR-02 a ATR-04)."""

import logging
from typing import Annotated, Optional
from uuid import UUID
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import get_current_user
from market_cache import supa_client
from atr import calibrate_atr, predict_atr
from postgrest.exceptions import APIError
from limiter import limiter
from fastapi import APIRouter


router = APIRouter()

logger = logging.getLogger(__name__)


class AtrSimulateBody(BaseModel):
    usina_id: str
    chuva_mm: float = Field(gt=0)
    impureza_pct: float = Field(gt=0, lt=100)
    volume_moagem: Optional[float] = Field(None, gt=0)


class AtrShareBody(BaseModel):
    compartilhado: bool


# ── ATR (Açúcar Total Recuperável) ────────────────────────────────────────────

@router.get("/api/atr/usinas")
@limiter.limit("30/minute")
def atr_usinas_list(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-02: Lista usinas associadas ao usuário autenticado."""
    supa = supa_client()
    rows = (
        supa.table("user_usinas")
        .select("usina_id, usinas(id, nome)")
        .eq("user_id", user["id"])
        .execute()
    ).data
    return {"usinas": [{"id": r["usinas"]["id"], "nome": r["usinas"]["nome"]} for r in rows]}


def _medicoes_para_calibracao(supa, usina_id: str) -> list[dict]:
    """Medições reais da usina (atr_medicoes). Tabela ainda não criada (atr-dados-reais) = sem medições."""
    try:
        rows = (
            supa.table("atr_medicoes")
            .select("mes_ref, atr_kg_t, impureza_vegetal_pct, impureza_mineral_pct, precipitacao_mm")
            .eq("usina_id", usina_id)
            .order("mes_ref", desc=True)
            .limit(120)
            .execute()
        ).data
    except APIError as exc:
        if exc.code in ("PGRST205", "42P01"):
            logger.warning("atr_medicoes ausente; calibração usa coeficientes do setor")
            return []
        raise
    return [
        {
            "chuva_mm": r["precipitacao_mm"],
            "impureza_pct": (
                None
                if r["impureza_vegetal_pct"] is None or r["impureza_mineral_pct"] is None
                else r["impureza_vegetal_pct"] + r["impureza_mineral_pct"]
            ),
            "atr_real": r["atr_kg_t"],
        }
        for r in rows
    ]


@router.post("/api/atr/simulate")
@limiter.limit("20/minute")
def atr_simulate(request: Request, body: AtrSimulateBody, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-03: Simula ATR com IC 90% e persiste no Supabase."""
    supa = supa_client()
    # Verificar que usuário pertence à usina
    assoc = supa.table("user_usinas").select("usina_id").eq("user_id", user["id"]).eq("usina_id", body.usina_id).execute()
    if not assoc.data:
        raise HTTPException(status_code=403, detail="Usuário não associado a esta usina.")
    history = _medicoes_para_calibracao(supa, body.usina_id)
    params = calibrate_atr(history)
    result = predict_atr(body.chuva_mm, body.impureza_pct, params, body.volume_moagem)
    result.update({"calibracao": params["calibracao"], "meses_usados": params["meses_usados"], "aviso": params["aviso"]})
    # Persistir
    supa.table("atr_simulacoes").insert({
        "user_id": user["id"],
        "usina_id": body.usina_id,
        "chuva_mm": body.chuva_mm,
        "impureza_pct": body.impureza_pct,
        "atr_min": result["atr_min"],
        "atr_esperado": result["atr_esperado"],
        "atr_max": result["atr_max"],
        "producao_total": result.get("producao_total"),
        "compartilhado": False,
    }).execute()
    return result


@router.get("/api/atr/historico")
@limiter.limit("30/minute")
def atr_historico(request: Request, usina_id: str, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-04: Histórico de simulações do usuário para uma usina (próprias + compartilhadas da usina)."""
    supa = supa_client()
    # Verificar que o usuário está associado à usina
    user_assoc = supa.table("user_usinas").select("usina_id").eq("user_id", user["id"]).execute().data
    user_usina_ids = {r["usina_id"] for r in user_assoc}
    if usina_id not in user_usina_ids:
        raise HTTPException(status_code=403, detail="Não autorizado para esta usina.")
    uid = str(UUID(str(user["id"])))
    # Filtro na query (antes do limit): próprias ou compartilhadas. user_id não sai na resposta.
    rows = (
        supa.table("atr_simulacoes")
        .select("id, user_id, chuva_mm, impureza_pct, atr_min, atr_esperado, atr_max, producao_total, compartilhado, created_at")
        .eq("usina_id", usina_id)
        .or_(f"user_id.eq.{uid},compartilhado.is.true")
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    ).data
    visible = [{**{k: v for k, v in r.items() if k != "user_id"}, "minha": r["user_id"] == uid} for r in rows]
    return {"historico": visible}


@router.patch("/api/atr/simulacoes/{sim_id}/compartilhar")
@limiter.limit("20/minute")
def atr_compartilhar(request: Request, sim_id: str, body: AtrShareBody, user: Annotated[dict, Depends(get_current_user)]):
    """Publica ou despublica uma simulação ATR para outros membros da mesma usina."""
    supa = supa_client()
    result = supa.table("atr_simulacoes").update({"compartilhado": body.compartilhado}).eq("id", sim_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Simulação não encontrada.")
    return {"ok": True}
