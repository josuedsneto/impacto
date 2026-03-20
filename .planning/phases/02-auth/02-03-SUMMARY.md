---
phase: 02-auth
plan: 03
subsystem: auth
tags: [nextjs, supabase, ssr, middleware, proxy, pkce, jwt, route-protection]

requires:
  - phase: 02-auth/02-01
    provides: Supabase SSR client helpers (createServerSupabaseClient, createClient)
  - phase: 02-auth/02-02
    provides: JWT RS256 verification and FastAPI auth dependency chain

provides:
  - Next.js proxy.ts route guard protecting all /app/* routes
  - Silent JWT refresh via supabase.auth.getUser() on every request
  - PKCE code exchange route handler at /api/auth/callback
  - Minimal protected dashboard page at /app/dashboard with server-side session check

affects: [03-data-api, all future frontend pages under /app/*]

tech-stack:
  added: []
  patterns:
    - "proxy.ts (Next.js 16) replaces deprecated middleware.ts — export function named `proxy`, not `middleware`"
    - "Route guard pattern: getUser() in proxy for token refresh + redirect, plus defensive redirect in page component"
    - "PKCE callback: exchangeCodeForSession(code) in Route Handler, redirect to /login?error on failure"

key-files:
  created:
    - frontend/proxy.ts
    - frontend/app/api/auth/callback/route.ts
    - frontend/app/app/dashboard/page.tsx
  modified: []

key-decisions:
  - "Used proxy.ts (Next.js 16 convention) instead of deprecated middleware.ts — export function named `proxy`"
  - "getUser() not getSession() in proxy — forces server-side token validation and triggers silent refresh"
  - "Dual protection: proxy redirects unauthenticated /app/* requests + dashboard page has its own redirect fallback"

patterns-established:
  - "Proxy-first auth: all /app/* protection lives in proxy.ts, page components add defensive fallback only"
  - "Cookie forwarding: setAll() updates both request.cookies and supabaseResponse.cookies to persist session refresh"

requirements-completed: [AUTH-03, AUTH-06]

duration: 20min
completed: 2026-03-20
---

# Phase 2 Plan 03: Auth Route Guard and PKCE Callback Summary

**Next.js 16 proxy.ts route guard protecting all /app/* routes with silent JWT refresh via Supabase SSR, plus PKCE code exchange callback and a server-side protected dashboard page**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-20T00:00:00Z
- **Completed:** 2026-03-20T00:20:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Proxy route guard in `proxy.ts` silently refreshes expired JWTs and redirects unauthenticated users away from all `/app/*` routes
- PKCE auth callback at `/api/auth/callback` exchanges Supabase code for session cookie
- `/app/dashboard` Server Component reads session server-side and provides belt-and-suspenders redirect fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Proxy route guard and auth callback route** - `44ea305` (feat)
2. **Task 2: Protected /app/dashboard page** - `70015b0` (feat)

**Plan metadata:** (docs commit — see final commit)

## Files Created/Modified

- `frontend/proxy.ts` — Next.js 16 proxy that guards /app/* routes, silently refreshes tokens, redirects unauthenticated requests
- `frontend/app/api/auth/callback/route.ts` — PKCE code exchange handler; sets session cookie and redirects to /app/dashboard
- `frontend/app/app/dashboard/page.tsx` — Minimal protected Server Component showing logged-in user email

## Decisions Made

- Used `proxy.ts` with `export function proxy()` (Next.js 16 convention) instead of the deprecated `middleware.ts` / `export function middleware()` — confirmed by reading bundled Next.js 16.2.0 docs
- Used `supabase.auth.getUser()` (not `getSession()`) in proxy — makes a server-side call to verify token and triggers silent refresh via stored refresh token cookie
- Dual-layer protection: proxy handles redirects for all /app/* routes; individual pages add a defensive `redirect('/login')` as a fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used proxy.ts instead of deprecated middleware.ts**

- **Found during:** Task 1 (Create Next.js middleware for route protection)
- **Issue:** Plan specifies `frontend/middleware.ts` with `export async function middleware()`, but this version of Next.js (16.2.0) has deprecated `middleware.ts` and renamed it to `proxy.ts` with `export function proxy()`. Using the old convention would produce a deprecation warning or silent failure.
- **Fix:** Created `frontend/proxy.ts` with `export async function proxy()` per the bundled Next.js docs in `node_modules/next/dist/docs/`
- **Files modified:** `frontend/proxy.ts` (instead of `frontend/middleware.ts`)
- **Verification:** `npm run build` output shows `ƒ Proxy (Middleware)` — recognized correctly
- **Committed in:** 44ea305 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - wrong API convention for installed Next.js version)
**Impact on plan:** Necessary for correctness — middleware.ts would be silently ignored or deprecated in Next.js 16. No scope creep.

## Issues Encountered

- First `npm run build` attempt failed with `EPERM: operation not permitted` on a `.next/static` temp file — caused by OneDrive sync locking the file. Retried immediately and succeeded.

## Next Phase Readiness

- Auth loop is complete: login page (02-01) + JWT verification (02-02) + route guard + callback (02-03)
- All `/app/*` routes are now protected — Phase 3 (Data API) can build pages under `/app/` knowing unauthenticated access is blocked
- No blockers

---
*Phase: 02-auth*
*Completed: 2026-03-20*
