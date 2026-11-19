"""Alertas de mercado (.specs/features/alertas).

Parte pura: schemas por tipo e avaliar(). Parte com efeito: disparo, envio e job diário.
Preços sempre pelo cache (market_cache.get_prices); o acesso às tabelas usa o cliente único do cache.
"""
from __future__ import annotations

import hashlib
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
import pandas as pd
from pydantic import BaseModel, Field, model_validator

import cambio
import market_cache
from analysis import IndicatorConfig, compute_analysis
import politica_hedge
import telegram_bot
from pregao import FERIADOS_ICE

logger = logging.getLogger(__name__)

BRT = ZoneInfo("America/Sao_Paulo")
TICKER_RE = re.compile(r"^[A-Z0-9=.]{1,20}$")
MAX_REGRAS_POR_USUARIO = 20
JANELA_DIAS = 400          # DEC-14: cobre 30 retornos e a variação do dia
DIAS_DADO_VELHO = 4        # DEC-15: barra mais antiga que isso = ticker pulado
TICKER_POSICAO = "POSICAO" # DEC-22: regra de posição não tem ticker de mercado
MIN_FECHAMENTOS_PROB = 60  # DEC-20
N_CAMINHOS_PROB = 5000     # DEC-20
MIN_FECHAMENTOS_SINAL = 60  # rodada 3: SMA 50 e MACD precisam de barras para aquecer
TIPOS_DISPONIVEIS = ("preco_cruza", "variacao_diaria", "vol_acima", "prob_cruzar", "posicao_limite", "sinal_tecnico")
NOME_ATIVO = {"USDBRL=X": "dólar", "SB=F": "açúcar"}  # rodada 3: texto do bloqueio (DEC-30)
NOME_SINAL = {"rsi": "RSI", "bollinger": "Bollinger", "macd": "MACD", "stoch": "estocástico",
              "cci": "CCI", "sma": "cruzamento de médias simples", "ema": "cruzamento de médias exponenciais"}
TIPOS = TIPOS_DISPONIVEIS


class DadosInsuficientes(Exception):
    """Série de preços curta ou sem fechamento válido para o tipo de alerta."""


class EmailNaoConfigurado(Exception):
    pass


# ── Schemas por tipo (DEC: Pydantic por tipo de alerta) ───────────────────────

class PrecoCruzaParams(BaseModel):
    nivel: float = Field(gt=0)
    direcao: Literal["acima", "abaixo"]
    margem_pct: float = Field(default=0, ge=0, le=20)  # rodada 3, DEC-29: rearme exige preço além do nível por essa margem


class VariacaoDiariaParams(BaseModel):
    pct: float = Field(gt=0, le=100)


class VolAcimaParams(BaseModel):
    pct: float = Field(gt=0, le=500)


class ProbCruzarParams(BaseModel):
    nivel: float = Field(gt=0, le=1e6)
    direcao: Literal["acima", "abaixo"]
    horizonte: int = Field(ge=1, le=252)  # dias úteis
    prob: float = Field(gt=0, le=1)       # limiar, fração (0,30 = 30%)
    margem: float | None = Field(default=None, ge=0, le=0.2)  # rodada 3, DEC-28: rearme abaixo de prob − margem

    @model_validator(mode="after")
    def _margem_menor_que_prob(self):
        if self.margem is None:
            self.margem = min(0.05, self.prob / 2)
        if self.margem >= self.prob:
            raise ValueError("A margem tem de ser menor que a probabilidade.")
        return self


class PosicaoLimiteParams(BaseModel):
    usina_id: str = Field(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    safra: str = Field(pattern=r"^\d{4}/\d{2}$")


class SinalTecnicoParams(BaseModel):
    indicador: Literal["rsi", "bollinger", "macd", "stoch", "cci", "sma", "ema"]
    sentido: Literal["compra", "venda"]


PARAMS_POR_TIPO = {
    "preco_cruza": PrecoCruzaParams,
    "variacao_diaria": VariacaoDiariaParams,
    "vol_acima": VolAcimaParams,
    "prob_cruzar": ProbCruzarParams,
    "posicao_limite": PosicaoLimiteParams,
    "sinal_tecnico": SinalTecnicoParams,
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


def semente_prob(rule_id: str, dia: date) -> int:
    """DEC-21: semente estável por regra e dia (hash() do Python muda entre processos)."""
    return int(hashlib.sha256(f"{rule_id}|{dia.isoformat()}".encode()).hexdigest()[:8], 16)


def probabilidade_cruzar(closes: np.ndarray, nivel: float, direcao: str, horizonte: int, seed: int) -> float:
    """DEC-20: fração de caminhos que tocam o nível no fechamento diário em até `horizonte` dias úteis."""
    caminhos = cambio.simular(closes, horizonte, N_CAMINHOS_PROB, seed=seed)
    if direcao == "acima":
        return float(np.mean(caminhos.max(axis=1) >= nivel))
    return float(np.mean(caminhos.min(axis=1) <= nivel))


def avaliar(regra: dict, serie: list[dict], dia: date | None = None) -> tuple[bool, float | None, str]:
    """Função pura: (condicao, valor, mensagem). serie = linhas do get_prices, ordem crescente.
    `dia` (Brasília) entra na semente do prob_cruzar; se faltar, usa a data do último dado."""
    tipo, p, ticker = regra["tipo"], regra["params"], regra["ticker"]
    fech = _fechamentos(serie)

    if tipo == "prob_cruzar":
        if len(fech) < MIN_FECHAMENTOS_PROB:
            raise DadosInsuficientes
        closes, _ = cambio.limpar(
            np.array([c for _, c in fech], dtype=float), np.array([d for d, _ in fech])
        )
        if len(closes) < MIN_FECHAMENTOS_PROB:
            raise DadosInsuficientes
        nivel, h, limite = float(p["nivel"]), int(p["horizonte"]), float(p["prob"])
        dia_ref = dia or date.fromisoformat(fech[-1][0])
        pr = probabilidade_cruzar(closes, nivel, p["direcao"], h, semente_prob(str(regra["id"]), dia_ref))
        cond = pr >= limite
        lado = "acima" if p["direcao"] == "acima" else "abaixo"
        msg = (
            f"{ticker}: chance de tocar {_num(nivel, 4)} ({lado}) em até {h} dias úteis: {_num(pr * 100, 1)}%. "
            f"Limite: {_num(limite * 100, 1)}%."
        )
        return cond, pr, msg

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

    if tipo == "sinal_tecnico":
        return _avaliar_sinal(regra, serie)

    raise ValueError(f"Tipo sem avaliador: {tipo}")


def _avaliar_sinal(regra: dict, serie: list[dict]) -> tuple[bool, float | None, str]:
    """DEC-31: sinal do analysis.compute_analysis na data do último pregão. Só barras com close, high e low."""
    linhas = [r for r in serie if all(r.get(c) is not None for c in ("close", "high", "low"))]
    if len(linhas) < MIN_FECHAMENTOS_SINAL:
        raise DadosInsuficientes
    df = pd.DataFrame(linhas)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    for c in ("open", "high", "low", "close", "volume"):
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    p = regra["params"]
    cfg = IndicatorConfig(indicators=[p["indicador"]], sma_periods=[20, 50], ema_periods=[9, 21])
    _, sinais = compute_analysis(df, cfg)
    ultima = df.index[-1].date().isoformat()
    tipo_sinal = "buy" if p["sentido"] == "compra" else "sell"
    cond = any(s["indicator"] == p["indicador"] and s["type"] == tipo_sinal and s["date"] == ultima for s in sinais)
    fechamento = float(df["close"].iloc[-1])
    msg = (
        f"{regra['ticker']}: sinal técnico de {NOME_SINAL[p['indicador']]} de {p['sentido']} "
        f"em {_data_br(ultima)} (fechamento {_num(fechamento, 4)}). "
        f"Sinal técnico, não uma recomendação."
    )
    return cond, fechamento, msg


def ja_cruzado(ticker: str, direcao: str, nivel: float, hoje: date) -> str | None:
    """DEC-30: mensagem de bloqueio se o último fechamento já está do lado da direção. None se ok ou sem preço."""
    try:
        linhas = market_cache.get_prices(ticker, hoje - timedelta(days=JANELA_DIAS), hoje)
    except Exception:
        logger.warning("Sem preço de %s para checar nível já cruzado; regra aceita", ticker)
        return None
    fech = _fechamentos(linhas)
    if not fech or (hoje - date.fromisoformat(fech[-1][0])).days > DIAS_DADO_VELHO:
        logger.warning("Dado velho ou ausente para %s; nível já cruzado não checado", ticker)
        return None
    data, ultimo = fech[-1]
    if not ((direcao == "acima" and ultimo >= nivel) or (direcao == "abaixo" and ultimo <= nivel)):
        return None
    return (
        f"O {NOME_ATIVO.get(ticker, ticker)} já está {direcao} de {_num(nivel, 2)} "
        f"({_num(ultimo, 2)} em {_data_br(data)[:5]}). Escolha um nível {direcao} do preço atual."
    )


def avaliar_posicao(regra: dict, posicoes: list[dict], politica: dict | None) -> tuple[bool, float | None, str]:
    """DEC-22: posicao_limite. Pura; usa a mesma faixa de GET /api/posicoes/resumo, sem preço de mercado."""
    sit = politica_hedge.situacao(posicoes, politica)
    if sit["status"] in ("sem_politica", "sem_producao"):
        raise DadosInsuficientes
    pct = sit["pct_fixado"]
    lo = sit["minimo_pct"] or 0
    hi = 100 if sit["maximo_pct"] is None else sit["maximo_pct"]
    cond = sit["status"] in ("abaixo", "acima")
    msg = (
        f"Safra {regra['params']['safra']}: {_num(pct, 1)}% fixado, "
        f"{'abaixo' if sit['status'] == 'abaixo' else 'acima' if sit['status'] == 'acima' else 'dentro'} "
        f"da faixa da política ({_num(lo, 1)}% a {_num(hi, 1)}%)."
    )
    return cond, pct, msg


# ── Transição e cooldown (ALE-03) ──────────────────────────────────────────────

def _margem_prob(p: dict) -> float:
    """DEC-28: regra antiga sem `margem` usa 0,05, limitado a metade do limiar para não travar."""
    return float(p["margem"]) if "margem" in p else min(0.05, float(p["prob"]) / 2)


def proximo_estado(regra: dict, condicao: bool, valor: float | None) -> bool:
    """DEC-28/29: estado gravado em ultimo_estado (true = ligado). Sem histerese, é a própria condição.
    Estado nulo (DEC-04) grava a condição sem disparar."""
    prev = regra.get("ultimo_estado")
    if condicao or prev is not True:  # armado (False) ou nulo: a faixa de margem não liga nada
        return condicao
    p, tipo = regra["params"], regra["tipo"]
    if tipo == "prob_cruzar":
        return not (valor < float(p["prob"]) - _margem_prob(p))
    if tipo == "preco_cruza":
        m = float(p.get("margem_pct", 0)) / 100
        nivel = float(p["nivel"])
        rearmou = valor < nivel * (1 - m) if p["direcao"] == "acima" else valor > nivel * (1 + m)
        return not rearmou
    return condicao


def decidir(regra: dict, condicao: bool, valor: float | None, agora: datetime) -> tuple[bool, bool]:
    """Pura: (disparar, novo_estado) para uma avaliação."""
    return deve_disparar(regra, condicao, agora), proximo_estado(regra, condicao, valor)


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

def enviar_email(destino: str, assunto: str, texto: str, html: str | None = None) -> None:
    chave = os.getenv("RESEND_API_KEY")
    remetente = os.getenv("ALERTAS_FROM")
    if not chave or not remetente:
        raise EmailNaoConfigurado("E-mail não configurado (RESEND_API_KEY ou ALERTAS_FROM ausente).")
    corpo = {"from": remetente, "to": [destino], "subject": assunto, "text": texto}
    if html:
        corpo["html"] = html
    r = requests.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {chave}"},
        json=corpo,
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


def _chat_telegram(db, user_id: str) -> int | None:
    linhas = db.table("telegram_vinculos").select("chat_id").eq("user_id", user_id).execute().data or []
    return linhas[0]["chat_id"] if linhas and linhas[0]["chat_id"] else None


def _enviar(db, regra: dict, texto: str, emails: dict) -> None:
    """Canal da regra. Erro do Telegram é mensagem fixa: a URL da Bot API contém o token (DEC-23)."""
    if regra.get("canal") == "telegram":
        chat = _chat_telegram(db, regra["user_id"])
        if not chat:
            # Vínculo desfeito depois de criar a regra: o alerta cai no e-mail em vez de se perder.
            logger.info("Regra %s sem Telegram vinculado; enviando por e-mail", regra["id"])
            regra = {**regra, "canal": "email"}
            return _enviar(db, regra, texto, emails)
        try:
            telegram_bot.enviar_mensagem(chat, texto)
        except telegram_bot.TelegramNaoConfigurado as exc:
            raise RuntimeError(str(exc))
        except Exception as exc:  # sem traceback: a URL da Bot API leva o token nos logs
            logger.warning("Falha no envio pelo Telegram da regra %s: %s", regra["id"], type(exc).__name__)
            raise RuntimeError("Falha no envio pelo Telegram")
        return
    destino = _email_do_usuario(db, emails, regra["user_id"])
    if not destino:
        raise RuntimeError("Usuário sem e-mail cadastrado.")
    assunto = f"Alerta: safra {regra['params']['safra']}" if regra["tipo"] == "posicao_limite" else f"Alerta: {regra['ticker']}"
    enviar_email(destino, assunto, texto)


# ── Disparo (DEC-06: evento primeiro, estado, envio, confirmação) ──────────────

def _disparar(db, regra: dict, estado: bool, valor, msg: str, agora: datetime, emails: dict) -> bool:
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
        db.table("alert_rules").update({"ultimo_estado": estado}).eq("id", regra["id"]).eq("user_id", regra["user_id"]).execute()
        return False
    evento_id = ins.data[0]["id"]
    db.table("alert_rules").update(
        {"ultimo_estado": estado, "ultimo_disparo": agora.isoformat()}
    ).eq("id", regra["id"]).execute()

    erro, enviado = None, False
    try:
        _enviar(db, regra, texto, emails)
        enviado = True
    except Exception as exc:
        erro = str(exc)
        logger.warning("Alerta %s não enviado: %s", regra["id"], erro)
    db.table("alert_events").update({"enviado": enviado, "erro": erro}).eq("id", evento_id).execute()
    return True


# ── Dados por tipo (DEC-22: posicao_limite não busca preço) ────────────────────

class PermissaoPerdida(Exception):
    """DEC-22: criador de posicao_limite não é mais membro da usina; regra pulada."""


def _membro(db, user_id: str, usina_id: str) -> bool:
    return bool(db.table("user_usinas").select("usina_id").eq("user_id", user_id).eq("usina_id", usina_id).execute().data)


def _avaliar_posicao_regra(db, regra: dict) -> tuple[bool, float | None, str]:
    """Lê posições e política da safra e avalia. Lança PermissaoPerdida se o criador saiu da usina."""
    p = regra["params"]
    if not _membro(db, regra["user_id"], p["usina_id"]):
        raise PermissaoPerdida
    posicoes = db.table("posicoes").select("*").eq("usina_id", p["usina_id"]).eq("safra", p["safra"]).execute().data or []
    pol = db.table("politica_hedge").select("*").eq("usina_id", p["usina_id"]).eq("safra", p["safra"]).execute().data or []
    return avaliar_posicao(regra, posicoes, pol[0] if pol else None)


# ── Job diário ─────────────────────────────────────────────────────────────────

def rodar_avaliacoes(agora: datetime | None = None, tipos: list[str] | None = None) -> dict:
    """Avalia as regras ativas (filtradas por `tipos`, se dado). Um get_prices por ticker. Retorna o resumo."""
    agora = agora or datetime.now(timezone.utc)
    hoje = agora.astimezone(BRT).date()
    if hoje in FERIADOS_ICE:
        # Sem pregão, sem avaliação: o briefing também pula o feriado, então nada sai repetido nem perdido.
        return {"avaliadas": 0, "disparadas": 0, "puladas": 0, "erros": 0, "feriado": True}
    db = market_cache.supa_client()
    consulta = db.table("alert_rules").select("*").eq("ativo", True)
    if tipos:
        consulta = consulta.in_("tipo", tipos)
    regras = consulta.execute().data or []

    resumo = {"avaliadas": 0, "disparadas": 0, "puladas": 0, "erros": 0}
    emails: dict = {}

    def processar(regra: dict, condicao: bool, valor, msg: str) -> None:
        resumo["avaliadas"] += 1
        disparar, estado = decidir(regra, condicao, valor, agora)
        if disparar:
            if _disparar(db, regra, estado, valor, msg, agora, emails):
                resumo["disparadas"] += 1
        else:
            db.table("alert_rules").update({"ultimo_estado": estado}).eq("id", regra["id"]).eq("user_id", regra["user_id"]).execute()

    for regra in (r for r in regras if r["tipo"] == "posicao_limite"):
        try:
            condicao, valor, msg = _avaliar_posicao_regra(db, regra)
        except (DadosInsuficientes, PermissaoPerdida):
            resumo["puladas"] += 1
            continue
        except Exception:
            logger.exception("Erro ao avaliar posição %s", regra["id"])
            resumo["erros"] += 1
            continue
        try:
            processar(regra, condicao, valor, msg)
        except Exception:
            logger.exception("Falha ao processar regra %s", regra["id"])
            resumo["erros"] += 1

    por_ticker: dict[str, list[dict]] = defaultdict(list)
    for r in regras:
        if r["tipo"] != "posicao_limite":
            por_ticker[r["ticker"]].append(r)

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
                condicao, valor, msg = avaliar(regra, linhas, hoje)
            except DadosInsuficientes:
                resumo["puladas"] += 1
                continue
            except Exception:
                logger.exception("Erro ao avaliar regra %s", regra["id"])
                resumo["erros"] += 1
                continue
            try:
                processar(regra, condicao, valor, msg)
            except Exception:  # FK de regra apagada no meio da rodada etc.: isola a regra
                logger.exception("Falha ao processar regra %s", regra["id"])
                resumo["erros"] += 1
    return resumo


def inicializar_estado(db, regra: dict) -> None:
    """DEC-04: ao criar ou reativar, grava ultimo_estado sem disparar. Se faltam dados, deixa nulo."""
    hoje = datetime.now(BRT).date()
    try:
        if regra["tipo"] == "posicao_limite":
            condicao, _, _ = _avaliar_posicao_regra(db, regra)
        else:
            linhas = market_cache.get_prices(regra["ticker"], hoje - timedelta(days=JANELA_DIAS), hoje)
            condicao, _, _ = avaliar(regra, linhas, hoje)
    except Exception:
        return
    db.table("alert_rules").update({"ultimo_estado": condicao}).eq("id", regra["id"]).eq("user_id", regra["user_id"]).execute()
