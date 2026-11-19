"""Manchetes do briefing (alertas-v2, DEC-25).

ponytail: a URL e o parse são os de main.get_news (Google News RSS). main.py não é tocado nesta rodada;
quando main.py for dividido, get_news deve passar a usar buscar_manchetes().
"""
from urllib.parse import urlencode

import feedparser
import requests

URL_RSS = "https://news.google.com/rss/search?" + urlencode(
    {"q": "açúcar NY futuros dólar real", "hl": "pt-BR", "gl": "BR", "ceid": "BR:pt-419"}
)


def buscar_manchetes(n: int = 3) -> list[dict] | None:
    """As n primeiras manchetes. None se a fonte falhar (o briefing segue sem essa seção)."""
    try:
        resp = requests.get(URL_RSS, timeout=10)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
    except Exception:
        return None
    itens = []
    for entry in feed.entries[:n]:
        source = entry.get("source", {})
        fonte = source.get("title", "") if isinstance(source, dict) else str(source)
        itens.append({"title": entry.get("title", ""), "link": entry.get("link", ""), "source": fonte})
    return itens
