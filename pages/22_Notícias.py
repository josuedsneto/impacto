import xml.etree.ElementTree as ET
from datetime import datetime

import requests
import streamlit as st

from utils import require_login, show_logo

st.set_page_config(page_title="Notícias do Mercado", page_icon="📰", layout="wide")

require_login()
show_logo()

st.title("Notícias do Mercado")
st.caption("Atualizado a cada 30 minutos. Fontes: Google News RSS.")

# ---------------------------------------------------------------------------
# RSS feed definitions
# ---------------------------------------------------------------------------

FEEDS = [
    {
        "label": "Açúcar — Internacional",
        "url": "https://news.google.com/rss/search?q=sugar+market+futures+price&hl=en-US&gl=US&ceid=US:en",
        "icon": "🌎",
    },
    {
        "label": "Açúcar — Brasil",
        "url": "https://news.google.com/rss/search?q=a%C3%A7%C3%BAcar+mercado+futuro&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "icon": "🇧🇷",
    },
    {
        "label": "Etanol — Brasil",
        "url": "https://news.google.com/rss/search?q=etanol+preco+mercado+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "icon": "⛽",
    },
    {
        "label": "Dólar / Câmbio",
        "url": "https://news.google.com/rss/search?q=d%C3%B3lar+real+c%C3%A2mbio+BRL&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "icon": "💵",
    },
    {
        "label": "Agronegócio Brasil",
        "url": "https://news.google.com/rss/search?q=agroneg%C3%B3cio+cana-de-a%C3%A7%C3%BAcar+safra&hl=pt-BR&gl=BR&ceid=BR:pt-419",
        "icon": "🌱",
    },
    {
        "label": "Commodities Globais",
        "url": "https://news.google.com/rss/search?q=commodities+agricultural+market&hl=en-US&gl=US&ceid=US:en",
        "icon": "📊",
    },
]

MAX_ITEMS = 8  # articles per feed


# ---------------------------------------------------------------------------
# Fetcher
# ---------------------------------------------------------------------------

@st.cache_data(ttl=1800)
def buscar_noticias(url: str) -> list[dict]:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ImpactoApp/1.0)"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
    except Exception:
        return []

    try:
        root = ET.fromstring(resp.content)
    except ET.ParseError:
        return []

    items = []
    for item in root.iter("item"):
        title = item.findtext("title") or ""
        link  = item.findtext("link")  or "#"
        pub   = item.findtext("pubDate") or ""
        source_el = item.find("source")
        source = source_el.text if source_el is not None else ""

        # Parse and reformat publication date
        pub_fmt = pub
        for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S GMT"):
            try:
                pub_fmt = datetime.strptime(pub.strip(), fmt).strftime("%d/%m/%Y %H:%M")
                break
            except ValueError:
                pass

        items.append({"title": title, "link": link, "pub": pub_fmt, "source": source})
        if len(items) >= MAX_ITEMS:
            break

    return items


# ---------------------------------------------------------------------------
# Refresh button
# ---------------------------------------------------------------------------

if st.button("🔄 Atualizar notícias"):
    buscar_noticias.clear()
    st.rerun()

st.divider()

# ---------------------------------------------------------------------------
# Render feeds in a 2-column grid
# ---------------------------------------------------------------------------

cols = st.columns(2)

for idx, feed in enumerate(FEEDS):
    col = cols[idx % 2]
    with col:
        st.subheader(f"{feed['icon']} {feed['label']}")
        noticias = buscar_noticias(feed["url"])

        if not noticias:
            st.info("Não foi possível carregar as notícias desta fonte no momento.")
        else:
            for n in noticias:
                title   = n["title"]
                link    = n["link"]
                pub     = n["pub"]
                source  = n["source"]

                subtitle_parts = []
                if source:
                    subtitle_parts.append(source)
                if pub:
                    subtitle_parts.append(pub)
                subtitle = " · ".join(subtitle_parts)

                st.markdown(f"**[{title}]({link})**")
                if subtitle:
                    st.caption(subtitle)
                st.write("")

        st.divider()
