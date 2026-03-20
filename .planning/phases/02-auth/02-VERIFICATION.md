---
phase: 02-auth
verified: 2026-03-20T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Submit valid email and password on /login"
    expected: "User is redirected to /app/dashboard and session cookie is set"
    why_human: "signInWithPassword requires a live Supabase project with a real user account"
  - test: "Close and reopen the browser tab after login"
    expected: "User remains logged in — /app/dashboard loads without being redirected to /login"
    why_human: "Cookie persistence across browser restarts cannot be verified statically"
  - test: "Wait for access token to expire (or manually clear only the access_token cookie, leave refresh_token intact)"
    expected: "Next request to any /app/* route silently refreshes the access token in proxy.ts via getUser(); no redirect to /login occurs"
    why_human: "Token refresh is time-dependent and requires a live session"
  - test: "Submit invalid credentials on /login"
    expected: "Inline error 'Email ou senha inválidos.' appears; page does not crash or navigate away"
    why_human: "Requires a live Supabase project to receive an error response from signInWithPassword"
  - test: "Access /app/dashboard without any session cookie (e.g. curl -v http://localhost:3000/app/dashboard)"
    expected: "307 redirect to /login"
    why_human: "Requires a running Next.js dev/prod server; cannot be verified from static analysis alone"
  - test: "Send a request to GET /api/me with a JWT whose role claim in app_metadata is 'user'"
    expected: "200 response with user id, email, role=user"
    why_human: "Requires a running FastAPI server and a signed JWT from Supabase"
  - test: "Send a request to GET /api/admin/ping with a JWT whose app_metadata.role is 'user'"
    expected: "403 Forbidden — 'Acesso restrito a administradores'"
    why_human: "Requires a running FastAPI server and a signed JWT"
  - test: "Send a request to GET /api/admin/ping with a JWT whose app_metadata.role is 'admin'"
    expected: "200 OK — {message: 'admin ok', user: <email>}"
    why_human: "Requires a running FastAPI server and a JWT with admin role in app_metadata"
---

# Phase 2: Auth Verification Report

**Phase Goal:** Users can log in with email and password, stay logged in across browser sessions, and be redirected to /login when unauthenticated; FastAPI validates the JWT locally without contacting Supabase.
**Verified:** 2026-03-20
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can submit email + password on /login and be redirected to /app/dashboard on success | VERIFIED | `login/page.tsx` calls `signInWithPassword`, on success calls `router.push('/app/dashboard')` |
| 2 | Session cookie is set after login so the browser session survives a tab close and reopen | VERIFIED | `@supabase/ssr` `createBrowserClient` stores session in cookies by design; `client.ts` uses this factory |
| 3 | Frontend automatically refreshes the access token before it expires without redirecting to /login | VERIFIED | `proxy.ts` calls `supabase.auth.getUser()` on every request — this triggers silent token refresh via the stored refresh token cookie |
| 4 | Invalid credentials show an inline error message | VERIFIED | `login/page.tsx` L22-25: `setError('Email ou senha inválidos.')` rendered at L65-67 inside form |
| 5 | Visiting any /app/* route without a session redirects to /login | VERIFIED | `proxy.ts` L36-40: `if (pathname.startsWith('/app') && !user)` redirects to `/login` |
| 6 | FastAPI rejects tampered/expired JWT with 401 using only RS256 local verification | VERIFIED | `backend/auth.py` uses `jwt.decode(..., algorithms=["RS256"])` with public key from env var; no network call in module body |
| 7 | FastAPI extracts role from app_metadata.role and enforces admin-only routes with 403 | VERIFIED | `auth.py` L51-55: extracts `app_metadata.role`; `require_admin` raises HTTP 403 for non-admins; `/api/admin/ping` uses `Depends(require_admin)` |

**Score:** 6/6 requirements verified (7/7 truths pass automated checks)

### Required Artifacts

| Artifact | Plan | Status | Details |
|----------|------|--------|---------|
| `frontend/lib/supabase/client.ts` | 02-01 | VERIFIED | Exports `createClient()` using `createBrowserClient` from `@supabase/ssr` |
| `frontend/lib/supabase/server.ts` | 02-01 | VERIFIED | Exports `createServerSupabaseClient()` using `createServerClient` from `@supabase/ssr` |
| `frontend/app/(auth)/login/page.tsx` | 02-01 | VERIFIED | 79 lines, `'use client'`, calls `signInWithPassword`, inline error, redirect on success |
| `frontend/app/(auth)/layout.tsx` | 02-01 | VERIFIED | Auth layout wrapper exists, 7 lines |
| `backend/auth.py` | 02-02 | VERIFIED | Exports `verify_jwt`, `get_current_user`, `require_admin`; RS256 via PyJWT; no network call |
| `backend/main.py` | 02-02 | VERIFIED | Routes `/api/me` and `/api/admin/ping` wired with `Depends(get_current_user)` and `Depends(require_admin)` |
| `frontend/proxy.ts` | 02-03 | VERIFIED | Next.js 16 route guard (replaces deprecated `middleware.ts`); calls `getUser()`, redirects `/app/*` to `/login` when no session |
| `frontend/app/api/auth/callback/route.ts` | 02-03 | VERIFIED | PKCE handler calls `exchangeCodeForSession(code)`, redirects to `/app/dashboard` on success |
| `frontend/app/app/dashboard/page.tsx` | 02-03 | VERIFIED | Server Component, calls `getUser()`, defensive `redirect('/login')` if no user |

**Notable deviation — not a gap:** Plan 02-03 specified `frontend/middleware.ts` with `export function middleware()`. The executing agent correctly identified that Next.js 16.2.0 deprecates this convention and created `frontend/proxy.ts` with `export function proxy()` instead. The build confirmed it as `ƒ Proxy (Middleware)`. Behaviour is functionally identical to what the plan required.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend/app/(auth)/login/page.tsx` | `supabase.auth.signInWithPassword` | Client component form submit handler | WIRED | L20: `supabase.auth.signInWithPassword({ email, password })` |
| `frontend/lib/supabase/client.ts` | `@supabase/ssr` | `createBrowserClient` factory | WIRED | L1: `import { createBrowserClient } from '@supabase/ssr'` |
| `backend/auth.py` | `jwt.decode` RS256 | Public key from env var | WIRED | L31-36: `jwt.decode(..., algorithms=["RS256"])` with `_PUBLIC_KEY` from env |
| `backend/main.py` | `backend/auth.py` | `Depends(verify_jwt)` chain | WIRED | L5: `from auth import get_current_user, require_admin`; L28: `Depends(get_current_user)`; L34: `Depends(require_admin)` |
| `frontend/proxy.ts` | `@supabase/ssr createServerClient` | Request/response cookie adapters | WIRED | L1: `import { createServerClient } from '@supabase/ssr'`; L7-26: full cookie adapter |
| `frontend/proxy.ts` | `supabase.auth.getUser` | Token validation + silent refresh on every request | WIRED | L31: `const { data: { user } } = await supabase.auth.getUser()` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01 | Login with email and password via Supabase Auth | SATISFIED | `login/page.tsx` calls `signInWithPassword` |
| AUTH-02 | 02-01 | Session persists after closing and reopening browser | SATISFIED | `@supabase/ssr` `createBrowserClient` stores session in cookies; `client.ts` uses this factory |
| AUTH-03 | 02-03 | Unauthenticated user redirected to /login on any /app/* route | SATISFIED | `proxy.ts` redirects `pathname.startsWith('/app') && !user` to `/login` |
| AUTH-04 | 02-02 | FastAPI validates JWT RS256 locally without round-trip to Supabase | SATISFIED | `auth.py` uses `jwt.decode` with RS256 public key from env var; no supabase-py or network call in verification path |
| AUTH-05 | 02-02 | Role extracted from `app_metadata.role`, applied on protected routes | SATISFIED | `auth.py` L51-55 extracts role; `require_admin` guards `/api/admin/ping` |
| AUTH-06 | 02-01, 02-03 | Frontend auto-refreshes token before redirecting to /login | SATISFIED | `proxy.ts` calls `getUser()` on every request — triggers silent refresh via refresh token cookie |

No orphaned requirements: all six AUTH-* requirements are claimed by plans and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/auth.py` | 14 | `_PUBLIC_KEY = os.environ.get("SUPABASE_JWT_PUBLIC_KEY", "")` defaults to empty string | Info | If the env var is missing at runtime, every protected request returns HTTP 500 rather than failing at startup. Not a code defect — the error is handled at L25-29 with a clear message. |

No blocker or warning anti-patterns found. No TODO/FIXME/placeholder comments. No empty implementations. No stub returns.

### Human Verification Required

The automated checks confirm all implementation is present, substantive, and wired. The following behaviors require a running environment with a live Supabase project to verify end-to-end:

#### 1. Login with valid credentials

**Test:** Navigate to /login. Enter a real user's email and password. Submit the form.
**Expected:** Redirect to /app/dashboard; session cookie set in browser devtools (Application > Cookies).
**Why human:** `signInWithPassword` requires a live Supabase Auth project.

#### 2. Session persistence across browser restart

**Test:** After logging in, close the browser entirely. Reopen and navigate to /app/dashboard.
**Expected:** Dashboard loads with user email displayed — no redirect to /login.
**Why human:** Cookie persistence depends on browser behavior and cannot be verified statically.

#### 3. Silent token refresh

**Test:** After logging in, wait for the access token to expire (Supabase default: 1 hour) or manually delete the `sb-*-auth-token` access token cookie while leaving the refresh token. Navigate to any /app/* route.
**Expected:** Page loads normally — proxy.ts silently refreshed the token; no /login redirect.
**Why human:** Time-dependent, requires live session state.

#### 4. Invalid credentials show inline error

**Test:** Submit /login with wrong password.
**Expected:** Form stays on /login; "Email ou senha inválidos." text appears below the password field; no crash or navigation.
**Why human:** Requires Supabase to return an auth error response.

#### 5. Unauthenticated access to /app/*

**Test:** `curl -v http://localhost:3000/app/dashboard` with no cookies.
**Expected:** HTTP 307 redirect to /login in the response headers.
**Why human:** Requires a running Next.js server.

#### 6. FastAPI JWT enforcement (user route)

**Test:** `GET /api/me` with a valid Supabase-issued JWT in the Authorization header.
**Expected:** 200 `{"id": "...", "email": "...", "role": "user"}`.
**Why human:** Requires a running FastAPI server and a real JWT from Supabase.

#### 7. FastAPI role enforcement (admin route, non-admin)

**Test:** `GET /api/admin/ping` with a JWT whose `app_metadata.role` is `"user"`.
**Expected:** 403 `{"detail": "Acesso restrito a administradores"}`.
**Why human:** Requires a running FastAPI server and a signed JWT.

#### 8. FastAPI role enforcement (admin route, admin)

**Test:** `GET /api/admin/ping` with a JWT whose `app_metadata.role` is `"admin"`.
**Expected:** 200 `{"message": "admin ok", "user": "<email>"}`.
**Why human:** Requires a running FastAPI server and a JWT with `app_metadata.role = "admin"`.

---

## Summary

All six AUTH requirements (AUTH-01 through AUTH-06) have complete, substantive, and wired implementations. No stubs, placeholders, or missing files were found. The one plan deviation (`middleware.ts` -> `proxy.ts`) is a valid adaptation to Next.js 16.2.0 API changes confirmed by the build output.

The phase goal is structurally achieved. Eight human-driven integration tests remain to confirm end-to-end behavior against a live Supabase project and running servers.

---
_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
