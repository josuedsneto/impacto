import re
import time as _time
import logging
from fastapi import HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address
import requests

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

ALLOWED_TICKER_RE = re.compile(r"^[A-Z0-9=.]{1,20}$")


def validate_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not ALLOWED_TICKER_RE.match(t):
        raise HTTPException(status_code=400, detail="Invalid ticker format")
    return t


# Oracle Cloud IPs are blocked by Yahoo Finance — use a browser User-Agent session.
def make_yf_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    })
    return session


def make_ttl_cache(ttl: float) -> dict:
    """Return a mutable dict used as a single-key TTL cache."""
    return {"ts": 0.0, "data": None}
