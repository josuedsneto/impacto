import re
import time as _time
import logging
from fastapi import HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)

ALLOWED_TICKER_RE = re.compile(r"^[A-Z0-9=.]{1,20}$")


def validate_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not ALLOWED_TICKER_RE.match(t):
        raise HTTPException(status_code=400, detail="Invalid ticker format")
    return t


def make_ttl_cache(ttl: float) -> dict:
    """Return a mutable dict used as a single-key TTL cache."""
    return {"ts": 0.0, "data": None}
