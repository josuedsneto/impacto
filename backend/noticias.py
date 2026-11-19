"""Manchetes de notícias do mercado (Google News RSS). Usada pela rota de notícias e pelo briefing de alertas."""
from urllib.parse import urlencode

import feedparser
import requests


def buscar_manchetes(limite: int = 10) -> list[dict]:
    """Lê o feed e devolve até `limite` itens. Levanta exceção se o feed falhar: quem chama decide o fallback."""
    url = "https://news.google.com/rss/search?" + urlencode(
        {"q": "açúcar NY futuros dólar real", "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"}
    )
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    feed = feedparser.parse(resp.content)
    items = []
    for entry in feed.entries[:limite]:
        published = entry.get("published", "")
        source = entry.get("source", {})
        source_title = source.get("title", "") if isinstance(source, dict) else str(source)
        items.append({
            "title": entry.get("title", ""),
            "link": entry.get("link", ""),
            "published": published,
            "source": source_title,
        })
    return items
