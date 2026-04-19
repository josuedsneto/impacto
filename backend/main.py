from dotenv import load_dotenv
load_dotenv()

import json
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from routers.shared import limiter
from routers import (
    health,
    market,
    simulation,
    options,
    params,
    admin,
    atr,
    risk,
    analytics,
    focus,
    news,
    alerts,
    alert_delivery,
    correlation,
    cobertura,
    billing,
    reports,
    invites,
    sharing,
)


# ── Structured JSON logging ────────────────────────────────────────────────────

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_record = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "timestamp": self.formatTime(record),
        }
        if record.exc_info:
            log_record["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(log_record, ensure_ascii=False)


_handler = logging.StreamHandler()
_handler.setFormatter(JsonFormatter())
logging.basicConfig(level=logging.INFO, handlers=[_handler], force=True)

logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Impacto API",
    version="2.1.0",
    docs_url=None if os.getenv("RAILWAY_ENVIRONMENT") else "/docs",
    redoc_url=None if os.getenv("RAILWAY_ENVIRONMENT") else "/redoc",
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again shortly."})


# ── Routers ────────────────────────────────────────────────────────────────────

for _router_module in [
    health, market, simulation, options, params, admin,
    atr, risk, analytics, focus, news, alerts, alert_delivery,
    correlation, cobertura, billing, reports, invites, sharing,
]:
    app.include_router(_router_module.router)

logger.info("Impacto API v2.1.0 started — %d routers loaded", 19)
