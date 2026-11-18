"""CRUD de alertas de mercado (.specs/features/alertas). Todas as consultas filtram user_id (DEC-11)."""
from datetime import datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, ValidationError
from slowapi import Limiter
from slowapi.util import get_remote_address

import alertas
import market_cache
from auth import get_current_user

router = APIRouter(prefix="/api/alertas", tags=["alertas"])
limiter = Limiter(key_func=get_remote_address)  # DEC-10: instância própria, sem importar main


class RegraIn(BaseModel):
    tipo: Literal["preco_cruza", "variacao_diaria", "vol_acima", "prob_cruzar"]
    ticker: str = Field(min_length=1, max_length=20)
    params: dict
    canal: Literal["email", "telegram"] = "email"
    cooldown_horas: int = Field(default=24, ge=24, le=720)


class RegraPatch(BaseModel):
    ativo: bool


def _validar_regra(body: RegraIn) -> tuple[str, dict]:
    if body.tipo not in alertas.TIPOS_DISPONIVEIS:
        raise HTTPException(422, "Disponível em breve.")
    if body.canal != "email":
        raise HTTPException(422, "Disponível em breve.")
    ticker = body.ticker.strip().upper()
    if not alertas.TICKER_RE.match(ticker):
        raise HTTPException(422, "Código de ativo inválido. Use letras, números, '=' ou '.' (ex.: SB=F).")
    try:
        params = alertas.validar_params(body.tipo, body.params)
    except ValidationError:
        raise HTTPException(422, "Parâmetros inválidos para este tipo de alerta.")
    return ticker, params


def _regra_do_usuario(db, rule_id: UUID, user: dict) -> dict:
    linhas = (
        db.table("alert_rules").select("*")
        .eq("id", str(rule_id)).eq("user_id", user["id"]).execute().data or []
    )
    if not linhas:
        raise HTTPException(404, "Alerta não encontrado.")
    return linhas[0]


@router.get("")
def listar(user: Annotated[dict, Depends(get_current_user)]):
    db = market_cache.supa_client()
    return db.table("alert_rules").select("*").eq("user_id", user["id"]).execute().data or []


@router.post("", status_code=201)
@limiter.limit("30/minute")
def criar(request: Request, body: RegraIn, user: Annotated[dict, Depends(get_current_user)]):
    ticker, params = _validar_regra(body)
    db = market_cache.supa_client()
    atuais = db.table("alert_rules").select("id").eq("user_id", user["id"]).execute().data or []
    if len(atuais) >= alertas.MAX_REGRAS_POR_USUARIO:
        raise HTTPException(400, "Limite de 20 alertas por conta atingido. Apague um alerta para criar outro.")
    criada = (
        db.table("alert_rules")
        .insert({"user_id": user["id"], "tipo": body.tipo, "ticker": ticker, "params": params,
                 "canal": body.canal, "cooldown_horas": body.cooldown_horas, "ativo": True})
        .execute().data[0]
    )
    alertas.inicializar_estado(db, criada)  # DEC-04
    return _regra_do_usuario(db, UUID(criada["id"]), user)


@router.patch("/{rule_id}")
def alterar(rule_id: UUID, body: RegraPatch, user: Annotated[dict, Depends(get_current_user)]):
    db = market_cache.supa_client()
    regra = _regra_do_usuario(db, rule_id, user)
    db.table("alert_rules").update({"ativo": body.ativo}).eq("id", regra["id"]).eq("user_id", user["id"]).execute()
    if body.ativo and not regra["ativo"]:
        db.table("alert_rules").update({"ultimo_estado": None}).eq("id", regra["id"]).eq("user_id", user["id"]).execute()
        alertas.inicializar_estado(db, {**regra, "ativo": True})  # DEC-04: reativar reavalia, sem disparar
    return _regra_do_usuario(db, rule_id, user)


@router.delete("/{rule_id}", status_code=204)
def apagar(rule_id: UUID, user: Annotated[dict, Depends(get_current_user)]):
    db = market_cache.supa_client()
    regra = _regra_do_usuario(db, rule_id, user)
    db.table("alert_rules").delete().eq("id", regra["id"]).eq("user_id", user["id"]).execute()
    return Response(status_code=204)


@router.get("/eventos")
def eventos(user: Annotated[dict, Depends(get_current_user)], rule_id: UUID | None = None):
    db = market_cache.supa_client()
    if rule_id:
        _regra_do_usuario(db, rule_id, user)
    consulta = db.table("alert_events").select("*").eq("user_id", user["id"])
    if rule_id:
        consulta = consulta.eq("rule_id", str(rule_id))
    return consulta.order("created_at", desc=True).limit(100).execute().data or []


@router.post("/{rule_id}/testar")
@limiter.limit("20/minute")
def testar(request: Request, rule_id: UUID, user: Annotated[dict, Depends(get_current_user)]):
    """DEC-08: avalia agora, sem gravar estado, evento nem e-mail."""
    db = market_cache.supa_client()
    regra = _regra_do_usuario(db, rule_id, user)
    hoje = datetime.now(alertas.BRT).date()
    try:
        linhas = market_cache.get_prices(regra["ticker"], hoje - timedelta(days=alertas.JANELA_DIAS), hoje)
    except Exception:
        raise HTTPException(503, f"Não foi possível obter os preços de {regra['ticker']} agora. Tente novamente em alguns minutos.")
    try:
        condicao, valor, msg = alertas.avaliar(regra, linhas)
    except alertas.DadosInsuficientes:
        raise HTTPException(400, f"Dados insuficientes para {regra['ticker']}.")
    return {"condicao": condicao, "valor": valor, "mensagem": msg, "ultimo_dado": linhas[-1]["date"]}
