"""Briefing diário por e-mail (alertas-v2, BRF-01 a BRF-03, DEC-24 a DEC-26).

Só recebe quem optou (preferencias_usuario.briefing_email). Seções que falham saem como "indisponível".
"""
import html
import logging
import time
from datetime import date, datetime, timedelta, timezone

import alertas
import market_cache
from focus import fetch_indicator
from market_cache import get_prices
from noticias import buscar_manchetes
from pregao import FERIADOS_ICE

logger = logging.getLogger(__name__)

PAUSA_ENVIO = 0.6  # DEC-24: Resend aceita ~2 req/s no plano gratuito
INDISPONIVEL = "indisponível no momento"


def ultimo_dia_util_anterior(hoje: date) -> date:
    """DEC-26: segunda pega sexta. Pula fins de semana e feriados do pregão (pregao.FERIADOS_ICE)."""
    d = hoje - timedelta(days=1)
    while d.weekday() >= 5 or d in FERIADOS_ICE:
        d -= timedelta(days=1)
    return d


def _mercado(ticker: str, hoje: date) -> dict | None:
    try:
        linhas = [r for r in get_prices(ticker, hoje - timedelta(days=10), hoje) if r.get("close") is not None]
    except Exception:
        logger.exception("Briefing: falha ao obter %s", ticker)
        return None
    if len(linhas) < 2:
        return None
    (_, anterior), (data, ultimo) = [(r["date"], float(r["close"])) for r in linhas[-2:]]
    return {"spot": ultimo, "var": (ultimo / anterior - 1) * 100, "data": data}


def conteudo_comum(hoje: date) -> dict:
    """Seções iguais para todos os destinatários. Montado uma vez por rodada."""
    focus = {}
    for nome in ("Câmbio", "Selic"):
        try:
            focus[nome] = fetch_indicator(nome, str(hoje.year), hoje).get("value")
        except Exception:
            focus[nome] = None
    return {
        "acucar": _mercado("SB=F", hoje),
        "dolar": _mercado("USDBRL=X", hoje),
        "focus": focus,
        "manchetes": buscar_manchetes(3),
    }


def _linha_mercado(rotulo: str, m: dict | None) -> str:
    if not m:
        return f"{rotulo}: {INDISPONIVEL}"
    return f"{rotulo}: {alertas._num(m['spot'], 4)} ({m['var']:+.2f}%), fechamento de {alertas._data_br(m['data'])}"


def montar(comum: dict, eventos: list[dict], hoje: date, ontem: date) -> tuple[str, str]:
    """Texto simples e HTML simples, com as mesmas seções."""
    f = comum["focus"]
    focus_txt = (
        f"Focus (fim de {hoje.year}): câmbio {alertas._num(f['Câmbio'], 2) if f.get('Câmbio') is not None else INDISPONIVEL}, "
        f"Selic {alertas._num(f['Selic'], 2) + '%' if f.get('Selic') is not None else INDISPONIVEL}"
    )
    manch = comum["manchetes"]
    manch_txt = [f"- {m['title']} ({m['source']})" for m in manch] if manch else [f"Manchetes: {INDISPONIVEL}"]
    alert_txt = [f"- {e['mensagem']}" for e in eventos] or ["Nenhum alerta disparou no último pregão."]

    linhas = (
        [f"Briefing do mercado, {hoje.strftime('%d/%m/%Y')}", "",
         _linha_mercado("Açúcar (SB=F)", comum["acucar"]),
         _linha_mercado("Dólar (USDBRL=X)", comum["dolar"]),
         focus_txt, "", "Manchetes:", *manch_txt, "",
         f"Alertas de {ontem.strftime('%d/%m/%Y')}:", *alert_txt, "",
         "Faixa de possibilidades e notícias não são recomendação de operação."]
    )
    texto = "\n".join(linhas)

    def li(s: str) -> str:
        return f"<li>{html.escape(s)}</li>"

    html_corpo = (
        f"<h2>Briefing do mercado, {hoje.strftime('%d/%m/%Y')}</h2>"
        f"<p>{html.escape(_linha_mercado('Açúcar (SB=F)', comum['acucar']))}<br>"
        f"{html.escape(_linha_mercado('Dólar (USDBRL=X)', comum['dolar']))}<br>"
        f"{html.escape(focus_txt)}</p>"
        f"<h3>Manchetes</h3><ul>{''.join(li(m['title'] + ' (' + m['source'] + ')') for m in manch) if manch else li('Manchetes: ' + INDISPONIVEL)}</ul>"
        f"<h3>Alertas de {ontem.strftime('%d/%m/%Y')}</h3><ul>"
        f"{''.join(li(e['mensagem']) for e in eventos) or li('Nenhum alerta disparou no último pregão.')}</ul>"
        "<p><small>Faixa de possibilidades e notícias não são recomendação de operação.</small></p>"
    )
    return texto, html_corpo


def enviar_briefings(agora: datetime | None = None, pausa: float = PAUSA_ENVIO) -> dict:
    agora = agora or datetime.now(timezone.utc)
    hoje = agora.astimezone(alertas.BRT).date()
    ontem = ultimo_dia_util_anterior(hoje)
    db = market_cache.supa_client()
    prefs = db.table("preferencias_usuario").select("user_id").eq("briefing_email", True).execute().data or []
    resumo = {"destinatarios": len(prefs), "enviados": 0, "sem_email": 0, "erros": 0}
    if not prefs:
        return resumo

    comum = conteudo_comum(hoje)  # uma vez por rodada (DEC-24)
    emails: dict = {}
    for p in prefs:
        uid = p["user_id"]
        try:
            destino = alertas._email_do_usuario(db, emails, uid)
            if not destino:
                resumo["sem_email"] += 1
                continue
            eventos = (
                db.table("alert_events").select("mensagem").eq("user_id", uid)
                .eq("dia", ontem.isoformat()).execute().data or []
            )
            texto, corpo = montar(comum, eventos, hoje, ontem)
            alertas.enviar_email(destino, f"Briefing do mercado, {hoje.strftime('%d/%m/%Y')}", texto, corpo)
            resumo["enviados"] += 1
        except Exception:
            logger.exception("Briefing: falha para um destinatário")
            resumo["erros"] += 1
        time.sleep(pausa)
    return resumo
