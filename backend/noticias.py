"""Manchetes do mercado (Google News RSS): a rota de notícias e o briefing de alertas usam esta função.

Falha de fonte não derruba o chamador: devolve None e registra o erro no log.
"""
import logging
from urllib.parse import urlencode

import feedparser
import requests

logger = logging.getLogger(__name__)

URL_RSS = "https://news.google.com/rss/search?" + urlencode(
    {"q": "açúcar NY futuros dólar real", "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"}
)


def buscar_manchetes(n: int = 3) -> list[dict] | None:
    """As n primeiras manchetes (título, link, data, fonte). None se a fonte falhar."""
    try:
        resp = requests.get(URL_RSS, timeout=10)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
        itens = []
        for entry in feed.entries[:n]:
            source = entry.get("source", {})
            fonte = source.get("title", "") if isinstance(source, dict) else str(source)
            itens.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "source": fonte,
            })
        return itens
    except Exception as exc:
        logger.error("Failed to fetch news: %s", exc)
        return None
