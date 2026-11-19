"""Vínculo do Telegram por código (alertas-v2, ALE-09, DEC-23).

Usuário gera código na tela e manda `/start CODIGO` ao bot. O webhook valida o secret do header,
consome o código numa única operação e grava o chat_id.
"""
import hmac
import logging
import os
import re
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response

import market_cache
import telegram_bot
from auth import get_current_user
from limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

START_RE = re.compile(r"^/start(?:@\w+)?\s+([A-Za-z0-9]{8})$")


def _responder(chat_id: int, texto: str) -> None:
    """Resposta ao chat. Falha de envio não derruba o webhook (Telegram reenviaria a mensagem)."""
    try:
        telegram_bot.enviar_mensagem(chat_id, texto)
    except Exception:
        logger.warning("Não foi possível responder ao chat do Telegram")


@router.get("/status")
def status(user: Annotated[dict, Depends(get_current_user)]):
    db = market_cache.supa_client()
    vinc = db.table("telegram_vinculos").select("chat_id").eq("user_id", user["id"]).execute().data or []
    return {"disponivel": telegram_bot.disponivel(), "vinculado": bool(vinc and vinc[0]["chat_id"])}


@router.post("/codigo")
@limiter.limit("5/minute")
def gerar_codigo(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    if not telegram_bot.disponivel():
        raise HTTPException(503, "Telegram indisponível: o bot ainda não está configurado.")
    codigo, expira = telegram_bot.novo_codigo()
    db = market_cache.supa_client()
    db.table("telegram_vinculos").upsert(
        {"user_id": user["id"], "codigo": codigo, "codigo_expira": expira.isoformat()},
        on_conflict="user_id",
    ).execute()
    return {"codigo": codigo, "expira_em": expira.isoformat()}


@router.delete("/vinculo", status_code=204)
def desvincular(user: Annotated[dict, Depends(get_current_user)]):
    db = market_cache.supa_client()
    db.table("telegram_vinculos").delete().eq("user_id", user["id"]).execute()
    return Response(status_code=204)


@router.post("/webhook")
def webhook(
    update: dict,
    x_telegram_bot_api_secret_token: Optional[str] = Header(None),
):
    """Falha fechada: sem TELEGRAM_WEBHOOK_SECRET nada é processado. Responde 200 às mensagens válidas."""
    esperado = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
    if not esperado:
        raise HTTPException(503, "Webhook indisponível: TELEGRAM_WEBHOOK_SECRET não configurado.")
    if not x_telegram_bot_api_secret_token or not hmac.compare_digest(
        x_telegram_bot_api_secret_token.encode(), esperado.encode()
    ):
        raise HTTPException(401, "Segredo do webhook inválido.")

    mensagem = update.get("message") or {}
    chat = mensagem.get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return {"ok": True}
    if chat.get("type") != "private":
        _responder(chat_id, "Use o bot em conversa privada para vincular os alertas.")
        return {"ok": True}

    m = START_RE.match((mensagem.get("text") or "").strip())
    if not m:
        return {"ok": True}  # outras mensagens são ignoradas
    codigo = m.group(1).upper()

    db = market_cache.supa_client()
    agora = datetime.now(timezone.utc).isoformat()
    dono = (
        db.table("telegram_vinculos").select("user_id")
        .eq("codigo", codigo).gt("codigo_expira", agora).execute().data or []
    )
    if not dono:
        _responder(chat_id, "Código inválido ou expirado. Gere outro na tela de alertas.")
        return {"ok": True}

    outro = (
        db.table("telegram_vinculos").select("user_id")
        .eq("chat_id", chat_id).neq("user_id", dono[0]["user_id"]).execute().data or []
    )
    if outro:
        _responder(chat_id, "Este Telegram já está vinculado a outra conta.")
        return {"ok": True}

    # Consumo atômico: só grava se o código ainda existe e não expirou.
    try:
        usado = (
            db.table("telegram_vinculos")
            .update({"chat_id": chat_id, "codigo": None, "codigo_expira": None})
            .eq("codigo", codigo).gt("codigo_expira", agora).execute().data or []
        )
    except Exception:  # corrida: outro webhook gravou o mesmo chat_id (UNIQUE)
        _responder(chat_id, "Este Telegram já está vinculado a outra conta.")
        return {"ok": True}
    if usado:
        _responder(chat_id, "Pronto. Alertas por Telegram ativados.")
    else:
        _responder(chat_id, "Código inválido ou expirado. Gere outro na tela de alertas.")
    return {"ok": True}
