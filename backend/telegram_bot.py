"""Canal Telegram (alertas-v2, DEC-23): envio pela Bot API e geração de código de vínculo.

Sem TELEGRAM_BOT_TOKEN o canal fica indisponível: o envio levanta TelegramNaoConfigurado.
"""
import os
import secrets
from datetime import datetime, timedelta, timezone

import requests

ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sem 0/O/1/I, para ditar sem erro
VALIDADE_CODIGO = timedelta(minutes=15)


class TelegramNaoConfigurado(Exception):
    pass


def disponivel() -> bool:
    return bool(os.getenv("TELEGRAM_BOT_TOKEN"))


def novo_codigo() -> tuple[str, datetime]:
    """Código de 8 caracteres e o instante em que expira."""
    codigo = "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(8))
    return codigo, datetime.now(timezone.utc) + VALIDADE_CODIGO


def enviar_mensagem(chat_id: int, texto: str) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise TelegramNaoConfigurado("Telegram não configurado (TELEGRAM_BOT_TOKEN ausente).")
    r = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": texto},
        timeout=15,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"Telegram respondeu {r.status_code}")
