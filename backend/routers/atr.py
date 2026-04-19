import logging
import os
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from supabase import create_client
from auth import get_current_user
from atr import calibrate_atr, predict_atr
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


class AtrSimulateBody(BaseModel):
    usina_id: str
    chuva_mm: float = Field(gt=0)
    impureza_pct: float = Field(gt=0, lt=100)
    volume_moagem: Optional[float] = Field(None, gt=0)


class AtrShareBody(BaseModel):
    compartilhado: bool


@router.get("/api/atr/usinas")
@limiter.limit("30/minute")
async def atr_usinas_list(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-02: Lista usinas associadas ao usuário autenticado."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = (
        supa.table("user_usinas")
        .select("usina_id, usinas(id, nome)")
        .eq("user_id", user["id"])
        .execute()
    ).data
    return {"usinas": [{"id": r["usinas"]["id"], "nome": r["usinas"]["nome"]} for r in rows]}


@router.post("/api/atr/simulate")
@limiter.limit("20/minute")
async def atr_simulate(request: Request, body: AtrSimulateBody, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-03: Simula ATR com IC 90% e persiste no Supabase."""
    import asyncio
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    assoc = supa.table("user_usinas").select("usina_id").eq("user_id", user["id"]).eq("usina_id", body.usina_id).execute()
    if not assoc.data:
        raise HTTPException(status_code=403, detail="Usuário não associado a esta usina.")
    hist_rows = (
        supa.table("atr_simulacoes")
        .select("chuva_mm, impureza_pct, atr_esperado")
        .eq("usina_id", body.usina_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    ).data
    history = [{"chuva_mm": r["chuva_mm"], "impureza_pct": r["impureza_pct"], "atr_real": r["atr_esperado"]} for r in hist_rows]
    loop = asyncio.get_running_loop()
    params = await loop.run_in_executor(None, calibrate_atr, history)
    result = await loop.run_in_executor(None, lambda: predict_atr(body.chuva_mm, body.impureza_pct, params, body.volume_moagem))
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
async def atr_historico(request: Request, usina_id: str, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-04: Histórico de simulações do usuário para uma usina."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    user_assoc = supa.table("user_usinas").select("usina_id").eq("user_id", user["id"]).execute().data
    user_usina_ids = {r["usina_id"] for r in user_assoc}
    if usina_id not in user_usina_ids:
        raise HTTPException(status_code=403, detail="Não autorizado para esta usina.")
    rows = (
        supa.table("atr_simulacoes")
        .select("id, user_id, chuva_mm, impureza_pct, atr_min, atr_esperado, atr_max, producao_total, compartilhado, created_at")
        .eq("usina_id", usina_id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    ).data
    visible = [r for r in rows if r["user_id"] == user["id"] or r["compartilhado"]]
    return {"historico": visible}


@router.patch("/api/atr/simulacoes/{sim_id}/compartilhar")
@limiter.limit("20/minute")
async def atr_compartilhar(request: Request, sim_id: str, body: AtrShareBody, user: Annotated[dict, Depends(get_current_user)]):
    """Publica ou despublica uma simulação ATR."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = supa.table("atr_simulacoes").update({"compartilhado": body.compartilhado}).eq("id", sim_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Simulação não encontrada.")
    return {"ok": True}
