"""Alertas de mercado (.specs/features/alertas).

Parte pura: schemas por tipo e avaliar(). Parte com efeito: disparo, envio e job diário.
Preços sempre pelo cache (market_cache.get_prices); o acesso às tabelas usa o cliente único do cache.
"""
from __future__ import annotations

import logging
import math
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from zoneinfo import ZoneInfo

import numpy as np
import requests
from pydantic import BaseModel, Field

import market_cache

logger = logging.getLogger(__name__)

BRT = ZoneInfo("America/Sao_Paulo")
TICKER_RE = re.compile(r"^[A-Z0-9=.]{1,20}$")
MAX_REGRAS_POR_USUARIO = 20
JANELA_DIAS = 400          # DEC-14: cobre 30 retornos e a variação do dia
DIAS_DADO_VELHO = 4        # DEC-15: barra mais antiga que isso = ticker pulado
TIPOS_DISPONIVEIS = ("preco_cruza", "variacao_diaria", "vol_acima")
TIPOS = TIPOS_DISPONIVEIS + ("prob_cruzar",)  # prob_cruzar: schema e check prontos, avaliador pendente (cambio.py)


class DadosInsuficientes(Exception):
    """Série de preços curta ou sem fechamento válido para o tipo de alerta."""


class EmailNaoConfigurado(Exception):
    pass


# ── Schemas por tipo (DEC: Pydantic por tipo de alerta) ───────────────────────

class PrecoCruzaParams(BaseModel):
    nivel: float = Field(gt=0)
    direcao: Literal["acima", "abaixo"]


class VariacaoDiariaParams(BaseModel):
    pct: float = Field(gt=0, le=100)


class VolAcimaParams(BaseModel):
    pct: float = Field(gt=0, le=500)


class ProbCruzarParams(BaseModel):
    strike: float = Field(gt=0)
    direcao: Literal["acima", "abaixo"]
    horizonte_dias: int = Field(ge=1, le=252)
    prob_min: float = Field(gt=0, le=100)


PARAMS_POR_TIPO = {
    "preco_cruza": PrecoCruzaParams,
    "variacao_diaria": VariacaoDiariaParams,
    "vol_acima": VolAcimaParams,
    "prob_cruzar": ProbCruzarParams,
}


def validar_params(tipo: str, params: dict) -> dict:
    """Valida params pelo schema do tipo. Lança pydantic.ValidationError se inválido."""
    return PARAMS_POR_TIPO[tipo].model_validate(params).model_dump()


# ── Formatação ─────────────────────────────────────────────────────────────────

def _num(x: float, casas: int = 2) -> str:
    s = f"{x:,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _data_br(iso: str) -> str:
    return date.fromisoformat(iso).strftime("%d/%m/%Y")


# ── Volatilidade (DEC-13): mesma conta de /api/volatility em main.py ───────────

def vol_30d_pct(closes: list[float]) -> float | None:
    """Vol anualizada dos últimos 30 log-retornos, em %. None se faltam retornos."""
    arr = np.asarray(closes, dtype=float)
    if len(arr) < 2:
        return None
    retornos = np.diff(np.log(arr))
    if len(retornos) < 30:
        return None
    return float(retornos[-30:].std(ddof=1) * math.sqrt(252) * 100)


# ── Avaliação pura ─────────────────────────────────────────────────────────────

def _fechamentos(serie: list[dict]) -> list[tuple[str, float]]:
    """Linhas com close válido, em ordem de data. Fechamento None é descartado, como em main.py."""
    return [(r["date"], float(r["close"])) for r in serie if r.get("close") is not None]


def avaliar(regra: dict, serie: list[dict]) -> tuple[bool, float | None, str]:
    """Função pura: (condicao, valor, mensagem). serie = linhas do get_prices, ordem crescente."""
    tipo, p, ticker = regra["tipo"], regra["params"], regra["ticker"]
    fech = _fechamentos(serie)

    if tipo == "preco_cruza":
        if not fech:
            raise DadosInsuficientes
        data, ultimo = fech[-1]
        nivel = float(p["nivel"])
        cond = ultimo >= nivel if p["direcao"] == "acima" else ultimo <= nivel
        msg = (
            f"{ticker} fechou em {_num(ultimo, 4)} em {_data_br(data)}. "
            f"Nível {'acima' if p['direcao'] == 'acima' else 'abaixo'} de {_num(nivel, 4)}: "
            f"{'atingido' if cond else 'não atingido'}."
        )
        return cond, ultimo, msg

    if tipo == "variacao_diaria":
        if len(fech) < 2:
            raise DadosInsuficientes
        (_, anterior), (data, ultimo) = fech[-2], fech[-1]
        var = (ultimo / anterior - 1) * 100
        cond = abs(var) >= float(p["pct"])
        msg = (
            f"{ticker} variou {var:+.2f}% em {_data_br(data)} (fechou em {_num(ultimo, 4)}). "
            f"Limite: ±{_num(float(p['pct']))}%."
        )
        return cond, var, msg

    if tipo == "vol_acima":
        vol = vol_30d_pct([c for _, c in fech])
        if vol is None:
            raise DadosInsuficientes
        data = fech[-1][0]
        cond = vol >= float(p["pct"])
        msg = (
            f"{ticker}: volatilidade de 30 dias de {_num(vol)}% em {_data_br(data)}. "
            f"Limite: {_num(float(p['pct']))}%."
        )
        return cond, vol, msg

    raise ValueError(f"Tipo sem avaliador: {tipo}")


# ── Transição e cooldown (ALE-03) ──────────────────────────────────────────────

def deve_disparar(regra: dict, condicao: bool, agora: datetime) -> bool:
    """Dispara só na transição falso→verdadeiro, fora do cooldown (DEC-04: estado nulo não dispara)."""
    if not condicao or regra.get("ultimo_estado") is not False:
        return False
    ultimo = regra.get("ultimo_disparo")
    if ultimo:
        ultimo_dt = datetime.fromisoformat(ultimo) if isinstance(ultimo, str) else ultimo
        if agora - ultimo_dt < timedelta(hours=int(regra["cooldown_horas"]) - 1):  # folga de 1h: cron tem precisão de hora
            return False
    return True


# ── Envio (DEC-07) ─────────────────────────────────────────────────────────────

def enviar_email(destino: str, assunto: str, texto: str) -> None:
    chave = os.getenv("RESEND_API_KEY")
    remetente = os.getenv("ALERTAS_FROM")
    if not chave or not remetente:
        raise EmailNaoConfigurado("E-mail não configurado (RESEND_API_KEY ou ALERTAS_FROM ausente).")
    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {chave}"},
        json={"from": remetente, "to": [destino], "subject": assunto, "text": texto},
        timeout=15,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"Resend respondeu {r.status_code}")


def _email_do_usuario(db, cache: dict, user_id: str) -> str | None:
    """DEC-17: e-mail via auth admin, uma consulta por usuário por rodada."""
    if user_id not in cache:
        try:
            cache[user_id] = db.auth.admin.get_user_by_id(user_id).user.email
        except Exception:
            logger.exception("Falha ao buscar e-mail do usuário %s", user_id)
            cache[user_id] = None
    return cache[user_id]


# ── Disparo (DEC-06: evento primeiro, estado, envio, confirmação) ──────────────

def _disparar(db, regra: dict, condicao: bool, valor, msg: str, agora: datetime, emails: dict) -> bool:
    dia = agora.astimezone(BRT).date()
    hora = agora.astimezone(BRT).strftime("%H:%M")
    texto = f"{msg} Avaliado às {hora} (Brasília)."
    ins = (
        db.table("alert_events")
        .upsert(
            {"rule_id": regra["id"], "user_id": regra["user_id"], "dia": dia.isoformat(),
             "valor": valor, "mensagem": texto, "enviado": False},
            on_conflict="rule_id,dia", ignore_duplicates=True,
        )
        .execute()
    )
    if not ins.data:  # já há evento da regra hoje: não envia de novo
        db.table("alert_rules").update({"ultimo_estado": condicao}).eq("id", regra["id"]).eq("user_id", regra["user_id"]).execute()
        return False
    evento_id = ins.data[0]["id"]
    db.table("alert_rules").update(
        {"ultimo_estado": True, "ultimo_disparo": agora.isoformat()}
    ).eq("id", regra["id"]).execute()

    erro, enviado = None, False
    destino = _email_do_usuario(db, emails, regra["user_id"])
    try:
        if not destino:
            raise RuntimeError("Usuário sem e-mail cadastrado.")
        enviar_email(destino, f"Alerta: {regra['ticker']}", texto)
        enviado = True
    except Exception as exc:
        erro = str(exc)
        logger.warning("Alerta %s não enviado: %s", regra["id"], erro)
    db.table("alert_events").update({"enviado": enviado, "erro": erro}).eq("id", evento_id).execute()
    return True


# ── Job diário ─────────────────────────────────────────────────────────────────

def rodar_avaliacoes(agora: datetime | None = None, tipos: list[str] | None = None) -> dict:
    """Avalia as regras ativas (filtradas por `tipos`, se dado). Um get_prices por ticker. Retorna o resumo."""
    agora = agora or datetime.now(timezone.utc)
    hoje = agora.astimezone(BRT).date()
    db = market_cache.supa_client()
    consulta = db.table("alert_rules").select("*").eq("ativo", True)
    if tipos:
        consulta = consulta.in_("tipo", tipos)
    regras = consulta.execute().data or []

    por_ticker: dict[str, list[dict]] = defaultdict(list)
    for r in regras:
        por_ticker[r["ticker"]].append(r)

    resumo = {"avaliadas": 0, "disparadas": 0, "puladas": 0, "erros": 0}
    emails: dict = {}
    for ticker, lista in por_ticker.items():
        try:
            linhas = market_cache.get_prices(ticker, hoje - timedelta(days=JANELA_DIAS), hoje)
        except Exception:
            logger.exception("get_prices falhou para %s", ticker)
            resumo["puladas"] += len(lista)
            continue
        if not linhas or (hoje - date.fromisoformat(linhas[-1]["date"])).days > DIAS_DADO_VELHO:
            logger.warning("Dado velho ou ausente para %s; regras puladas", ticker)
            resumo["puladas"] += len(lista)
            continue

        for regra in lista:
            try:
                condicao, valor, msg = avaliar(regra, linhas)
            except DadosInsuficientes:
                resumo["puladas"] += 1
                continue
            except Exception:
                logger.exception("Erro ao avaliar regra %s", regra["id"])
                resumo["erros"] += 1
                continue
            resumo["avaliadas"] += 1
            try:
                if deve_disparar(regra, condicao, agora):
                    if _disparar(db, regra, condicao, valor, msg, agora, emails):
                        resumo["disparadas"] += 1
                else:
                    db.table("alert_rules").update({"ultimo_estado": condicao}).eq("id", regra["id"]).eq("user_id", regra["user_id"]).execute()
            except Exception:  # FK de regra apagada no meio da rodada etc.: isola a regra
                logger.exception("Falha ao processar regra %s", regra["id"])
                resumo["erros"] += 1
    return resumo


def inicializar_estado(db, regra: dict) -> None:
    """DEC-04: ao criar ou reativar, grava ultimo_estado sem disparar. Se faltam dados, deixa nulo."""
    hoje = datetime.now(BRT).date()
    try:
        linhas = market_cache.get_prices(regra["ticker"], hoje - timedelta(days=JANELA_DIAS), hoje)
        condicao, _, _ = avaliar(regra, linhas)
    except Exception:
        return
    db.table("alert_rules").update({"ultimo_estado": condicao}).eq("id", regra["id"]).eq("user_id", regra["user_id"]).execute()
