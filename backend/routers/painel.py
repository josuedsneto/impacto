"""Painel "Hoje": o que é do usuário e o que olhar (painel-hoje).

Cada seção é independente: erro vira {"dados": null, "motivo": "..."} e as outras seguem (PNL-02).
Só entra o que é do usuário ou caro: Focus, cotações e pregão já vêm do layout com cache (D-1).
Reaproveita as funções das outras rotas; não duplica a lógica delas.
Todas as consultas ao Supabase filtram por user_id do JWT (a service role ignora RLS).
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated, Any, Callable
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request

import cambio
import market_cache
from auth import get_current_user
from limiter import limiter
from politica_hedge import situacao
from routers.analises import COLUNAS as COLUNAS_ANALISES
from routers.cambio import CAMINHOS, JANELA, serie_fx
from routers.posicoes import _ultimo_fechamento, resumo_safra

router = APIRouter()
logger = logging.getLogger(__name__)

BRT = ZoneInfo("America/Sao_Paulo")
HORIZONTE_DOLAR = 21  # dias úteis, faixa de 90% (A-5)
AVISO_PRECO = "Resultado a mercado indisponível agora: sem preço do açúcar ou do dólar."
MSG_GENERICA = "Não foi possível carregar esta seção agora. Tente novamente em alguns minutos."


def _motivo(exc: Exception) -> str:
    # HTTPException carrega texto em português pensado para o usuário; o resto vira texto fixo.
    return str(exc.detail) if isinstance(exc, HTTPException) else MSG_GENERICA


def _secao(nome: str, fn: Callable[..., Any], *args: Any) -> dict:
    try:
        return {"dados": fn(*args), "motivo": None}
    except Exception as exc:
        logger.exception("painel/hoje: seção %s falhou", nome)
        return {"dados": None, "motivo": _motivo(exc)}


def _safra_atual(hoje: date) -> str:
    """Safra começa em abril: 19/11/2026 é 2026/27 (A-1). `hoje` já vem na data de Brasília."""
    ano = hoje.year if hoje.month >= 4 else hoje.year - 1
    return f"{ano}/{str(ano + 1)[-2:]}"


def _ultimo_dia_util(agora: datetime) -> date:
    """Último dia de segunda a sexta antes de hoje, no fuso de Brasília (A-3: feriados ficam de fora)."""
    d = agora.astimezone(BRT).date() - timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


# ── Câmbio ──────────────────────────────────────────────────────────────────────

def secao_faixa_dolar(hoje: date) -> dict:
    closes, datas = serie_fx(hoje)
    seed = int(str(datas[-1]).replace("-", ""))  # mesmo seed de /api/cambio/previsao (data do último dado)
    caminhos = cambio.simular(closes[-JANELA:], HORIZONTE_DOLAR, CAMINHOS, seed=seed)
    b = cambio.bandas(caminhos)
    return {
        "horizonte": HORIZONTE_DOLAR,
        "spot": round(float(closes[-1]), 4),
        "p5": round(float(b["p5"][-1]), 4),
        "p50": round(float(b["p50"][-1]), 4),
        "p95": round(float(b["p95"][-1]), 4),
        "data_dado": str(datas[-1]),
    }


# ── Alertas, posições, análises ─────────────────────────────────────────────────

def secao_alertas(user: dict, agora: datetime) -> dict:
    db = market_cache.supa_client()
    dia = _ultimo_dia_util(agora)
    # Desde 00:00 de Brasília do último dia útil (03:00 UTC), até agora.
    inicio = datetime.combine(dia, time(0), tzinfo=BRT).astimezone(timezone.utc)
    disparados = (
        db.table("alert_events")
        .select("id,rule_id,mensagem,created_at")
        .eq("user_id", user["id"])
        .gte("created_at", inicio.isoformat())
        .order("created_at", desc=True)
        .execute()
        .data
    ) or []
    ativos = db.table("alert_rules").select("id").eq("user_id", user["id"]).eq("ativo", True).execute().data or []
    return {"dia_referencia": dia.isoformat(), "disparados": disparados, "ativos": len(ativos)}


def secao_posicoes(user: dict, hoje: date) -> list[dict]:
    """Uma linha por usina do usuário. Preço indisponível não tira o % fixado nem o status (só o MTM)."""
    db = market_cache.supa_client()
    assoc = db.table("user_usinas").select("usina_id, usinas(id, nome)").eq("user_id", user["id"]).execute().data or []
    if not assoc:
        return []
    safra = _safra_atual(hoje)
    ids = [a["usina_id"] for a in assoc]
    posicoes = (
        db.table("posicoes").select("*").in_("usina_id", ids).eq("safra", safra).order("created_at").execute()
    ).data or []
    politicas = (db.table("politica_hedge").select("*").in_("usina_id", ids).eq("safra", safra).execute()).data or []

    # Preço é o mesmo para todas as usinas: busca uma vez, e só se houver posição (R11).
    sb = fx = None
    aviso = None
    if posicoes:
        try:
            # Tupla inteira avaliada antes de atribuir: se o dólar falhar, sb também fica None.
            (sb, _), (fx, _) = _ultimo_fechamento("SB=F"), _ultimo_fechamento("USDBRL=X")
        except HTTPException:
            logger.exception("painel/hoje: preço indisponível para posições")
            aviso = AVISO_PRECO

    saida = []
    for a in assoc:
        uid = a["usina_id"]
        nome = (a.get("usinas") or {}).get("nome")
        n = sum(1 for p in posicoes if p["usina_id"] == uid)
        base = {"usina_id": uid, "usina_nome": nome, "safra": safra, "n_posicoes": n, "aviso": None, "motivo": None}
        try:
            do_usina = [p for p in posicoes if p["usina_id"] == uid]
            pol = next((p for p in politicas if p["usina_id"] == uid), None)
            if do_usina and sb is not None:
                r = resumo_safra(do_usina, pol, sb, fx)
            else:
                r = situacao(do_usina, pol)  # sem preço: status e % fixado continuam, MTM não
            saida.append({**base, "status": r["status"], "pct_fixado": r["pct_fixado"],
                          "minimo_pct": r["minimo_pct"], "maximo_pct": r["maximo_pct"],
                          "mtm_total_rs": r.get("mtm_total_rs"),
                          "aviso": aviso if do_usina and sb is None else None})
        except Exception as exc:
            logger.exception("painel/hoje: posição da usina %s falhou", uid)
            saida.append({**base, "status": None, "pct_fixado": None, "minimo_pct": None,
                          "maximo_pct": None, "mtm_total_rs": None, "motivo": _motivo(exc)})
    return saida


def secao_analises(user: dict) -> list[dict]:
    db = market_cache.supa_client()
    return (
        db.table("analises")
        .select(COLUNAS_ANALISES)
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .limit(3)
        .execute()
        .data
    ) or []


# ── Endpoint ────────────────────────────────────────────────────────────────────

@router.get("/api/painel/hoje")
@limiter.limit("30/minute")
def painel_hoje(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    agora = datetime.now(timezone.utc)
    hoje = agora.astimezone(BRT).date()
    # Seções em paralelo: _secao nunca levanta, então .result() é seguro.
    with ThreadPoolExecutor(max_workers=4) as pool:
        faixa = pool.submit(_secao, "faixa_dolar", secao_faixa_dolar, hoje)
        alertas = pool.submit(_secao, "alertas", secao_alertas, user, agora)
        posicoes = pool.submit(_secao, "posicoes", secao_posicoes, user, hoje)
        analises = pool.submit(_secao, "analises", secao_analises, user)
        return {
            "gerado_em": agora.isoformat(),
            "faixa_dolar": faixa.result(),
            "alertas": alertas.result(),
            "posicoes": posicoes.result(),
            "analises": analises.result(),
        }
