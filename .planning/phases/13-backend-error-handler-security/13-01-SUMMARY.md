---
phase: 13-backend-error-handler-security
plan: 01
subsystem: api
tags: [loguru, fastapi, middleware, error-handling, rate-limiting, request-id]

# Dependency graph
requires: []
provides:
  - RequestIDMiddleware that injects UUID X-Request-ID header on every response
  - loguru structured logging replacing stdlib logging in backend/main.py
  - Global Exception handler returning sanitized JSON 500 (no traceback exposure)
  - RateLimitExceeded handler returning JSON 429 with RATE_LIMITED code
affects:
  - 14-frontend-error-display
  - 15-backend-monitoring
  - all backend phases that rely on structured logging

# Tech tracking
tech-stack:
  added: [loguru>=0.7.3]
  patterns:
    - BaseHTTPMiddleware for request correlation ID injection (LIFO registration order)
    - loguru.opt(exception=exc).error() for structured exception logging with traceback server-side
    - Sanitized JSONResponse for all error paths — no internal detail to client (SEC-02)

key-files:
  created: []
  modified:
    - backend/requirements.txt
    - backend/main.py

key-decisions:
  - "loguru replaces stdlib logging; logger.remove() prevents duplicate output then adds single stderr sink"
  - "RequestIDMiddleware registered last so Starlette LIFO processes it first — request_id injected before rate-limit and CORS middleware"
  - "RateLimitExceeded handler registered before global Exception handler to ensure 429s are not caught as 500s"
  - "No traceback, str(exc), or repr(exc) appears in JSON response body — exception logged server-side only (SEC-02)"

patterns-established:
  - "Request correlation: every handler reads getattr(request.state, 'request_id', 'unknown') for log correlation"
  - "Error response shape: {error: <user-safe message>, code: <ERROR_CODE>} — consistent across all error types"

requirements-completed: [REL-01, REL-02, SEC-01, SEC-02]

# Metrics
duration: 7min
completed: 2026-04-04
---

# Phase 13 Plan 01: Backend Error Handler + Security Summary

**loguru structured logging with UUID request correlation IDs and sanitized JSON error responses replacing Python traceback exposure and plain-text rate-limit errors**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-04T18:45:31Z
- **Completed:** 2026-04-04T18:52:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced stdlib `logging.getLogger` with loguru configured on stderr at INFO level with timestamp/level/message format
- Added `RequestIDMiddleware` (BaseHTTPMiddleware) that generates a UUID per request, stores it on `request.state.request_id`, and injects `X-Request-ID` header on every response
- Registered global `Exception` handler returning `{"error": "Erro interno do servidor.", "code": "INTERNAL_ERROR"}` with status 500 — no traceback or internal detail exposed to client
- Registered `RateLimitExceeded` handler returning `{"error": "Muitas requisições...", "code": "RATE_LIMITED"}` with status 429, overriding SlowAPI's default plain-text response

## Task Commits

Each task was committed atomically:

1. **Task 1: Add loguru dependency and swap stdlib logging** - `f397d42` (feat)
2. **Task 2: Add RequestIDMiddleware and register exception handlers** - `ba4fb62` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/requirements.txt` - Added `loguru>=0.7.3` dependency
- `backend/main.py` - Replaced stdlib logging; added imports (sys, uuid, BaseHTTPMiddleware); added loguru sink config; added RequestIDMiddleware class; registered middleware LIFO; added RateLimitExceeded and global Exception handlers with sanitized JSON responses

## Decisions Made

- loguru `logger.remove()` called before `logger.add()` to prevent loguru's default stderr handler from producing duplicate output
- `RequestIDMiddleware` registered last in `app.add_middleware()` chain — Starlette LIFO means it executes first, ensuring `request_id` is available to all downstream middleware and handlers
- `RateLimitExceeded` handler explicitly registered before the global `Exception` handler so rate-limit errors produce 429 rather than falling through to the 500 handler
- `from fastapi.responses import JSONResponse` imported inline after middleware block (not at module top) to match plan structure; no duplicate since it wasn't previously imported

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `loguru` is automatically installed via `pip install -r requirements.txt`.

## Next Phase Readiness

- All subsequent v2.1 phases can rely on structured logging with request correlation IDs
- Foundation for monitoring/alerting phases that parse loguru JSON output is in place
- No blockers

---
*Phase: 13-backend-error-handler-security*
*Completed: 2026-04-04*
