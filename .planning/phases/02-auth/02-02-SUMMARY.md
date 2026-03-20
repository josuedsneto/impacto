---
phase: 02-auth
plan: 02
subsystem: auth
tags: [jwt, pyjwt, rs256, fastapi, supabase, python]

requires:
  - phase: 02-auth-01
    provides: FastAPI scaffold with CORS and /api/health endpoint, PyJWT + cryptography in requirements.txt

provides:
  - backend/auth.py with verify_jwt, get_current_user, require_admin dependencies
  - /api/me protected route for standard users
  - /api/admin/ping admin-only route with 403 enforcement

affects: [03-data-api, all future FastAPI phases using Depends(verify_jwt)]

tech-stack:
  added: []
  patterns:
    - "FastAPI dependency injection: Depends(verify_jwt) -> Depends(get_current_user) -> Depends(require_admin)"
    - "JWT verified locally with PyJWT RS256 — zero network calls in verification path"
    - "Role extracted from app_metadata.role in JWT payload; defaults to 'user'"

key-files:
  created:
    - backend/auth.py
  modified:
    - backend/main.py
    - backend/.env.example

key-decisions:
  - "PyJWT RS256 with SUPABASE_JWT_PUBLIC_KEY env var — fully local verification, no round-trip to Supabase"
  - "Role sourced from app_metadata.role (set by Supabase admin), not JWT role claim"
  - "Routes keep /api/ prefix — Nginx does not strip prefix (proxy_pass without rewrite)"

patterns-established:
  - "Auth pattern: all protected routes use Depends(get_current_user); admin routes use Depends(require_admin)"
  - "401 on token failure, 403 on insufficient role, 500 if public key not configured"

requirements-completed: [AUTH-04, AUTH-05]

duration: 10min
completed: 2026-03-20
---

# Phase 2 Plan 02: JWT RS256 Auth Dependencies Summary

**PyJWT RS256 local JWT verification for FastAPI with role-based access control via app_metadata — no Supabase round-trip**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20
- **Completed:** 2026-03-20
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `backend/auth.py` with three composable FastAPI dependencies: `verify_jwt`, `get_current_user`, `require_admin`
- JWT decoded locally using PyJWT RS256 with Supabase public key — no network call at verification time
- Wired `/api/me` and `/api/admin/ping` into `main.py` as pattern examples for all Phase 3+ routes

## Task Commits

1. **Task 1: Create backend/auth.py with JWT RS256 verification dependencies** - `517a39b` (feat)
2. **Task 2: Wire auth dependencies into FastAPI routes** - `ae6d574` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `backend/auth.py` - Three FastAPI dependencies: verify_jwt (RS256 decode), get_current_user (extracts id/email/role), require_admin (403 guard)
- `backend/main.py` - Added /api/me and /api/admin/ping protected routes; /api/health unchanged
- `backend/.env.example` - Improved SUPABASE_JWT_PUBLIC_KEY comment with source URL

## Decisions Made

- Routes keep `/api/` prefix: Nginx does not strip the prefix (proxy_pass without URL rewrite per Phase 1 decision)
- Role is read from `app_metadata.role` in the JWT, not from the top-level `role` claim, matching Supabase admin-set metadata pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- PyJWT not installed in the active Python environment (only in requirements.txt). Installed via pip to run the import verification check. No code change needed.

## User Setup Required

None - no external service configuration required beyond what was already documented in .env.example.

## Next Phase Readiness

- Auth foundation complete: `Depends(verify_jwt)`, `Depends(get_current_user)`, `Depends(require_admin)` ready for Phase 3 data-api routes
- No blockers

---
*Phase: 02-auth*
*Completed: 2026-03-20*
