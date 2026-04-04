# Phase 13: Backend Error Handler + Security — Research

**Researched:** 2026-04-04
**Domain:** FastAPI exception handling, loguru structured logging, SlowAPI rate limiting, input validation, user isolation
**Confidence:** HIGH (based on direct codebase audit)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REL-01 | Backend returns structured JSON `{"error": "...", "code": "..."}` on all 500 responses — never raw tracebacks | `@app.exception_handler(Exception)` + `JSONResponse` pattern; existing `SlowAPIMiddleware` must be preserved |
| REL-02 | All backend errors are logged via loguru with request ID for correlation | `RequestIDMiddleware` injects UUID into `request.state.request_id`; loguru replaces `logging.getLogger()` |
| SEC-01 | All `/api/*` endpoints that return user data enforce `user_id` isolation at query level | Audit confirms all user-data routes use `.eq("user_id", user["id"])` — already implemented correctly |
| SEC-02 | Error responses never expose stack traces, SQL statements, or internal system details | Global handler catches `Exception` and returns sanitized JSON; `HTTPException` detail pass-through limited to safe messages |
| SEC-03 | All API input parameters are validated (no injection vectors in ticker names, simulation params, alert thresholds) | `validate_ticker()` + Pydantic `Field` constraints exist; `RiscoSaveRequest.inputs: dict` and `RiscoSaveRequest.results: dict` are unvalidated |
| SEC-04 | Rate limiting is applied to simulation and market data endpoints | Most CPU-heavy routes already limited; 10 endpoints missing `@limiter.limit` need coverage |
</phase_requirements>

---

## Summary

Phase 13 is a targeted hardening pass on `backend/main.py`. The codebase is in good structural shape from v2.0: user isolation is already enforced at the query level on all user-owned tables (`.eq("user_id", user["id"])`), ticker input validation exists via `ALLOWED_TICKER_RE`, and Pydantic `Field` constraints are applied to numeric simulation parameters.

Three specific gaps remain that this phase must close:

1. **No global exception handler.** FastAPI will return raw Python tracebacks (500 responses with `text/html` content type) when unhandled exceptions occur — e.g., a Supabase connection failure, a yfinance timeout, or a numpy overflow. A single `@app.exception_handler(Exception)` with a loguru-logged response and a `request_id` injected by middleware closes this entirely.

2. **No structured logging with correlation IDs.** The codebase uses `logging.getLogger(__name__)` at the top of `main.py`. Some routes call `logger.error(...)` correctly, but the logger has no formatter and no request context. Replacing with loguru and adding a `RequestIDMiddleware` enables correlation of logs to specific requests.

3. **10 endpoints missing rate limiting.** All CPU-bound simulation routes and market data routes are already limited. The gaps are lower-risk admin and options endpoints — but SEC-04 requires full coverage. These should be added with conservative limits.

**Primary recommendation:** Add `RequestIDMiddleware` first (it enables the correlation ID for all subsequent logging), then the global exception handler (it consumes `request.state.request_id`), then swap `logging` for `loguru`, then backfill missing rate limiters. The SlowAPI `RateLimitExceeded` handler must be registered explicitly to keep its JSON response shape intact.

---

## Current State Audit

### User Isolation (SEC-01) — ALREADY COMPLIANT

Every user-data endpoint enforces `.eq("user_id", user["id"])` at the query level in addition to RLS:

| Endpoint | Isolation Check | Notes |
|----------|----------------|-------|
| `POST /api/simulations` | `"user_id": user["id"]` in insert | Correct |
| `GET /api/simulations` | `.eq("user_id", user["id"])` | Correct |
| `GET /api/simulations/{id}` | `.eq("user_id", user["id"])` | Correct — returns 404 on cross-user |
| `GET/PUT /api/params/{ticker}` | `.eq("user_id", user["id"])` | Correct |
| `GET/POST/DELETE /api/watchlist` | `.eq("user_id", user["id"])` | Correct |
| `POST /api/breakeven/save` | `"user_id": user["id"]` in insert | Correct |
| `GET /api/breakeven/history` | `.eq("user_id", user["id"])` | Correct |
| `POST /api/risco/save` | `"user_id": user["id"]` in insert | Correct |
| `GET /api/risco/history` | `.eq("user_id", user["id"])` | Correct |
| `POST /api/cenarios/save` | `"user_id": user["id"]` in insert | Correct |
| `GET /api/cenarios/history` | `.eq("user_id", user["id"])` | Correct |

**Verdict:** SEC-01 is already implemented. No changes required.

### Error Exposure (REL-01, SEC-02) — GAP

- No `@app.exception_handler(Exception)` registered.
- No `@app.exception_handler(RateLimitExceeded)` registered (SlowAPI handles this internally but its default response is plain text `"429 Too Many Requests"`).
- Current stdlib `logger` has no formatter — tracebacks go to uvicorn stderr as unformatted text.
- When unhandled exceptions occur (e.g., Supabase timeout, numpy error), FastAPI returns a 500 with the full Python traceback in the response body.

### Logging (REL-02) — GAP

Current state:
```python
import logging
logger = logging.getLogger(__name__)
```

No JSON formatter, no request_id context, no sink configuration. Log lines are not parseable by PM2's log capture.

### Input Validation (SEC-03) — MOSTLY COMPLIANT, TWO GAPS

Already validated:
- All `ticker` params go through `validate_ticker()` — regex `^[A-Z0-9=.]{1,20}$`
- Simulation numerics: `dias_simulados`, `num_simulacoes`, `pct_bound` all have `Field(ge=..., le=...)`
- Options params: `S`, `K`, `T`, `r`, `sigma` all have Pydantic `Field` bounds
- `JumpDiffusionRequest`, `RiscoRequest`, `CenariosRequest` all have `Field` bounds

Two gaps found:
1. **`RiscoSaveRequest.inputs: dict`** — untyped dict; a client can POST arbitrary nested JSON with any key depth and size
2. **`RiscoSaveRequest.results: dict`** — same issue
3. **`/api/metas` `meta: float` query param** — no min/max validation; can accept `meta=-999999999.0`

### Rate Limiting (SEC-04) — PARTIAL GAP

10 endpoints missing `@limiter.limit`:

| Endpoint | Risk Level | Suggested Limit |
|----------|-----------|----------------|
| `GET /api/me` | LOW (DB auth check) | 60/minute |
| `GET /api/admin/ping` | LOW (admin-only) | 30/minute |
| `GET /api/admin/suggestions` | MEDIUM (DB query) | 30/minute |
| `PATCH /api/admin/suggestions/{id}` | HIGH (triggers backfill) | 10/minute |
| `POST /api/admin/market/backfill/{ticker}` | HIGH (triggers expensive yfinance) | 5/minute |
| `POST /api/options/payoff` | MEDIUM (CPU computation) | 30/minute |
| `POST /api/options/bs-price` | LOW (fast math) | 60/minute |
| `GET /api/admin/config` | LOW (DB read) | 30/minute |
| `PUT /api/admin/config/{key}` | LOW (DB write) | 20/minute |
| `GET /api/health` | NONE needed | Exempt (public health check) |

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastapi` | 0.115.6 | Web framework + exception handler API | Already in use |
| `slowapi` | >=0.1.9 | Rate limiting via `@limiter.limit` decorator | Already in use |
| `pydantic` | 2.10.3 | Input validation via `BaseModel` + `Field` | Already in use |

### New Dependency Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `loguru` | >=0.7.3 | Structured logging with JSON sink | Drop-in, no config files, structured output for PM2 capture |

**Installation:**
```bash
pip install loguru>=0.7.3
```

Add to `backend/requirements.txt`:
```
loguru>=0.7.3
```

---

## Architecture Patterns

### Pattern 1: RequestID Middleware

Add as the FIRST middleware (registered LAST, since Starlette processes middleware LIFO):

```python
# Source: Starlette middleware docs + FastAPI request lifecycle
import uuid
from starlette.middleware.base import BaseHTTPMiddleware

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

Register order in `main.py` (registration order is bottom-to-top for execution):
```python
app.add_middleware(SlowAPIMiddleware)        # executes 3rd
app.add_middleware(CORSMiddleware, ...)      # executes 2nd
app.add_middleware(RequestIDMiddleware)      # executes 1st — assigns request_id before all others
```

### Pattern 2: Global Exception Handler + RateLimitExceeded Handler

```python
# Source: FastAPI docs on exception handlers + SlowAPI docs
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from loguru import logger

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(
        "Rate limit exceeded",
        request_id=request_id,
        path=request.url.path,
        limit=str(exc),
    )
    return JSONResponse(
        status_code=429,
        content={"error": "Too many requests. Tente novamente em instantes.", "code": "RATE_LIMITED"},
        headers={"X-Request-ID": request_id},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception(
        "Unhandled exception",
        request_id=request_id,
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Erro interno do servidor.", "code": "INTERNAL_ERROR"},
        headers={"X-Request-ID": request_id},
    )
```

**Critical:** Register `RateLimitExceeded` handler BEFORE the general `Exception` handler. FastAPI matches handlers in registration order for the same exception type, and `RateLimitExceeded` must take priority over the catch-all.

### Pattern 3: Loguru Configuration

Replace the existing `logging.getLogger(__name__)` with loguru. The existing `logger.error(...)` call sites use the same API surface so no call-site changes are needed for basic usage.

```python
# Replace at top of main.py:
# import logging
# logger = logging.getLogger(__name__)

from loguru import logger
import sys

# Remove default loguru handler, configure JSON for production
logger.remove()
logger.add(
    sys.stderr,
    format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message} | {extra}",
    level="INFO",
    serialize=False,   # set to True for strict JSON output in prod
)
```

For correlation ID injection in the exception handler, loguru's `bind()` contextvar approach is available but `logger.exception(..., request_id=request_id, ...)` with keyword args is sufficient for PM2 log parsing in this codebase.

### Pattern 4: Input Validation for `inputs: dict` / `results: dict`

For `RiscoSaveRequest`, constrain the `inputs` and `results` fields:

```python
from pydantic import BaseModel, Field, model_validator
from typing import Any

class RiscoSaveRequest(BaseModel):
    inputs: dict[str, Any] = Field(default_factory=dict)
    fat_media: float
    custo_media: float
    ebitda_media: float
    results: dict[str, Any] = Field(default_factory=dict)
    label: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def validate_dict_size(self) -> "RiscoSaveRequest":
        import json
        if len(json.dumps(self.inputs)) > 10_000:
            raise ValueError("inputs payload too large")
        if len(json.dumps(self.results)) > 50_000:
            raise ValueError("results payload too large")
        return self
```

For `/api/metas` `meta` param:

```python
@app.get("/api/metas")
@limiter.limit("20/minute")
async def get_metas(
    request: Request,
    meta: float = Field(default=2600, ge=100, le=100_000),
    user: Annotated[dict, Depends(get_current_user)] = None,
):
```

Note: FastAPI query param `Field` validation works differently from Pydantic model fields — use `Query(default=2600, ge=100, le=100_000)` from `fastapi`:

```python
from fastapi import Query

async def get_metas(
    request: Request,
    meta: float = Query(default=2600, ge=100, le=100_000),
    ...
):
```

### Anti-Patterns to Avoid

- **Registering `Exception` handler before `RateLimitExceeded`:** The catch-all will intercept rate limit errors and return 500 instead of 429.
- **Using `exc_info` or printing `exc` in the JSON response:** Never include `str(exc)`, `repr(exc)`, or `traceback.format_exc()` in the JSON body returned to the client.
- **Replacing `SlowAPIMiddleware` with a custom middleware:** SlowAPI integrates with `limiter.limit` decorators; replacing the middleware breaks all existing rate limit decorators.
- **Setting `loguru.serialize=True` without testing PM2 output:** PM2 captures stderr; JSON lines work well, but ensure the format is verified locally before deploying.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom `request_count` dict in memory | `slowapi` (already installed) | Thread-safe, decorator-based, Redis-compatible |
| Request correlation IDs | Random string in each route | `RequestIDMiddleware` once at app level | Guarantees every request gets an ID before any handler runs |
| JSON error responses | Per-route try/except with JSONResponse | `@app.exception_handler(Exception)` | Single source of truth; catches errors even inside dependencies |
| Input size limits | Manual `len()` checks everywhere | Pydantic `model_validator` on the request body | Reusable, auto-documented in OpenAPI schema |

---

## Common Pitfalls

### Pitfall 1: SlowAPI RateLimitExceeded Bypasses router-level handlers

**What goes wrong:** Adding `@app.exception_handler(Exception)` is not enough. `SlowAPIMiddleware` raises `RateLimitExceeded` at the ASGI middleware level. The Starlette exception handler middleware (which runs `@app.exception_handler`) does not catch exceptions raised by other middlewares. SlowAPI has its own error handling path.

**Why it happens:** SlowAPI calls `_rate_limit_exceeded_handler` from its middleware, which raises `RateLimitExceeded`. FastAPI's `exception_handler` dispatch is at the router/application layer, not the ASGI layer.

**How to avoid:** Register an explicit `@app.exception_handler(RateLimitExceeded)` that returns `JSONResponse`. This overrides SlowAPI's default plain-text handler.

**Warning signs:** After adding the global handler, rate limit responses still return `Content-Type: text/plain` instead of `application/json`.

### Pitfall 2: loguru `logger.exception()` Must Be Called Inside `except` Block

**What goes wrong:** `logger.exception(msg)` auto-captures the current exception context. Calling it outside an `except` block (or inside an `async` exception handler that FastAPI catches via its own mechanism) may not capture the full traceback.

**How to avoid:** In the `global_exception_handler`, call `logger.exception("Unhandled exception", ...)` — FastAPI passes `exc` to the handler function; loguru's `logger.opt(exception=exc).error(...)` can be used alternatively when the exception is available as a variable.

```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.opt(exception=exc).error(
        "Unhandled exception | request_id={} path={}", 
        request_id, request.url.path
    )
    return JSONResponse(status_code=500, content={"error": "Erro interno.", "code": "INTERNAL_ERROR"})
```

### Pitfall 3: `BaseHTTPMiddleware` Breaks Streaming Responses

**What goes wrong:** `RequestIDMiddleware` using `BaseHTTPMiddleware` wraps `call_next` which buffers the full response. For streaming endpoints this can cause issues.

**Why it matters for this codebase:** No streaming endpoints exist currently. This is not an active risk, but worth documenting.

**How to avoid:** Since all endpoints return `JSONResponse`, `BaseHTTPMiddleware` is safe here. If streaming is added later, switch to pure ASGI middleware.

### Pitfall 4: `inputs: dict` Without Size Limit Enables Denial of Service

**What goes wrong:** `POST /api/risco/save` accepts `inputs: dict` and `results: dict` with no size constraint. A client can send a 100MB JSON body. Without a size cap, this can exhaust memory or cause uvicorn to spend excessive time parsing.

**How to avoid:** Add a `model_validator` that rejects payloads where `json.dumps(inputs)` exceeds 10KB and `json.dumps(results)` exceeds 50KB. For defense in depth, also configure uvicorn's `limit_max_requests` or set a `max_body_size` limit at the Nginx proxy level.

---

## Code Examples

### Complete Exception Handler Block

```python
# Source: FastAPI official exception handlers docs + SlowAPI README
from loguru import logger
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(
        "Rate limit exceeded | request_id={} path={}", 
        request_id, request.url.path
    )
    return JSONResponse(
        status_code=429,
        content={"error": "Muitas requisições. Aguarde e tente novamente.", "code": "RATE_LIMITED"},
        headers={"X-Request-ID": request_id},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "unknown")
    logger.opt(exception=exc).error(
        "Unhandled exception | request_id={} path={} method={}",
        request_id, request.url.path, request.method
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Erro interno do servidor.", "code": "INTERNAL_ERROR"},
        headers={"X-Request-ID": request_id},
    )
```

### RequestID Middleware

```python
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
```

### Loguru Drop-in Replace

```python
# Remove:
# import logging
# logger = logging.getLogger(__name__)

# Add:
from loguru import logger
import sys

logger.remove()   # remove default handler
logger.add(sys.stderr, level="INFO", format="{time} | {level} | {message}")
```

All existing `logger.error(...)` call sites work unchanged — loguru's `Logger` is API-compatible with stdlib `logging.Logger` for the basic methods used in this codebase.

### Missing Rate Limiters (to add on 10 endpoints)

```python
# /api/me
@app.get("/api/me")
@limiter.limit("60/minute")
async def me(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    ...

# /api/admin/ping  
@app.get("/api/admin/ping")
@limiter.limit("30/minute")
async def admin_ping(request: Request, user: Annotated[dict, Depends(require_admin)]):
    ...
```

**Note:** When adding `@limiter.limit` to admin endpoints, the `request: Request` parameter MUST be added to the function signature if not already present — SlowAPI requires it to extract the client IP.

Admin endpoints (`/api/admin/*`) do NOT currently have `request: Request` in their signatures. Adding a rate limiter requires adding `request: Request` as the first parameter.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `logging.getLogger()` | `loguru` | Stable since loguru 0.5 | JSON-serializable structured logs, no config files |
| Per-route try/except | `@app.exception_handler` | FastAPI 0.60+ | Single handler for all 500s |
| SlowAPI default text response | Explicit `RateLimitExceeded` handler | SlowAPI 0.1.9 | JSON 429 responses instead of text/plain |

---

## Open Questions

1. **`loguru.serialize=True` vs custom format**
   - What we know: `serialize=True` produces full JSON lines; custom format string is human-readable
   - What's unclear: PM2 log aggregation preference on Oracle Cloud — does the ops team want JSON lines or human-readable?
   - Recommendation: Use human-readable format with structured fields inline for v2.1; the format string `"{time} | {level} | {message}"` is easy to grep. JSON lines can be switched to later.

2. **Admin endpoints require `request: Request` parameter for rate limiting**
   - What we know: SlowAPI `@limiter.limit` requires `request: Request` in the function signature to extract the client IP
   - What's unclear: Whether adding `request` to admin endpoint signatures will break any existing client calls
   - Recommendation: REST semantics are unaffected by adding `request` (it's not a query param or body field). Safe to add.

3. **Should `/api/health` be rate-limited?**
   - What we know: Health checks are typically exempt from rate limiting; load balancers call them frequently
   - Recommendation: Leave `/api/health` unrated. It has no auth and returns only `{"status": "ok"}`.

---

## Implementation Order

The tasks should be sequenced in this order to maximize safety and avoid regressions:

1. **Add `loguru` to `requirements.txt`** — no code change yet, just dependency
2. **Replace `logging` with `loguru`** — swap import + configure sink; no call-site changes needed
3. **Add `RequestIDMiddleware`** — must be registered before exception handlers consume `request.state.request_id`
4. **Register `RateLimitExceeded` handler** — must come before the general `Exception` handler
5. **Register global `Exception` handler** — catch-all for all unhandled exceptions
6. **Validate `RiscoSaveRequest.inputs/results` dict sizes** — add `model_validator`
7. **Add `Query(ge=100, le=100_000)` to `/api/metas` `meta` param**
8. **Add `@limiter.limit` to the 9 missing non-health endpoints** — add `request: Request` to admin endpoints that don't have it

---

## Sources

### Primary (HIGH confidence)
- `backend/main.py` — direct code audit confirming: no exception handler, no `RateLimitExceeded` handler, `logging.getLogger` in use, rate limiting coverage gaps, `inputs: dict` unvalidated
- `backend/requirements.txt` — confirmed `slowapi>=0.1.9`, no `loguru`
- PITFALLS.md Pitfall 9 — FastAPI global handler + SlowAPI interaction documented with root cause

### Secondary (MEDIUM confidence)
- FastAPI exception handlers documentation (training knowledge, consistent with FastAPI 0.115 API)
- loguru documentation — API verified against library usage patterns in the codebase
- SlowAPI README — `RateLimitExceeded` handler pattern, confirmed in `.planning/research/PITFALLS.md`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing dependencies confirmed from requirements.txt; only loguru is new
- Architecture: HIGH — all patterns derived from direct audit of main.py, not assumptions
- Pitfalls: HIGH — all pitfalls traced to specific code in main.py and verified against known SlowAPI behavior

**Research date:** 2026-04-04
**Valid until:** 2026-07-04 (FastAPI 0.115 is stable; SlowAPI and loguru APIs are stable)
