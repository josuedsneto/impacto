import logging
import time as _time
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from auth import get_current_user
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

_news_cache: dict = {"ts": 0.0, "items": []}
_NEWS_TTL = 1800  # 30 minutes


@router.get("/api/news")
@limiter.limit("20/minute")
async def get_news(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Fetch top 10 financial news items from Google News RSS feed.
    Results are cached for 30 minutes.
    """
    import feedparser

    now = _time.time()
    if now - _news_cache["ts"] < _NEWS_TTL and _news_cache["items"]:
        return {"items": _news_cache["items"], "cached": True}

    url = "https://news.google.com/rss/search?q=açúcar+NY+futuros+dólar+real&hl=pt-BR&gl=BR&ceid=BR:pt-419"
    try:
        feed = feedparser.parse(url)
        items = []
        for entry in feed.entries[:10]:
            published = entry.get("published", "")
            source = entry.get("source", {})
            source_title = source.get("title", "") if isinstance(source, dict) else str(source)
            items.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": published,
                "source": source_title,
            })
        _news_cache["ts"] = now
        _news_cache["items"] = items
    except Exception as exc:
        logger.error("Failed to fetch news: %s", exc)
        if _news_cache["items"]:
            return {"items": _news_cache["items"], "cached": True, "warning": "News fetch failed, showing cached data"}
        raise HTTPException(status_code=503, detail="Failed to fetch news")

    return {"items": items, "cached": False}
