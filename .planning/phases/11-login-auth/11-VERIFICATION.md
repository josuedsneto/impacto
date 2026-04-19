---
phase: 11-login-auth
verified: 2026-04-01T00:00:00Z
status: gaps_found
score: 3/4 must-haves verified
gaps:
  - truth: "frontend/proxy.ts exists and redirects unauthenticated /app/* requests to /login"
    status: failed
    reason: "proxy.ts exists and contains correct logic, but Next.js middleware must live in middleware.ts at the project root. No middleware.ts exists, so the proxy function is never called by the framework and /app/* routes are completely unprotected."
    artifacts:
      - path: "frontend/proxy.ts"
        issue: "File is named proxy.ts — Next.js ignores it. Must be middleware.ts exporting a default function named `middleware`."
    missing:
      - "Create frontend/middleware.ts that imports and re-exports the proxy logic as the default `middleware` export, or rename proxy.ts to middleware.ts and rename the exported function to `middleware`."
---

# Phase 11: Login Auth Verification Report

**Phase Goal:** Add login page (email+senha + magic link) and Next.js middleware protecting all /app/* routes.
**Verified:** 2026-04-01
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `frontend/proxy.ts` exists and redirects unauthenticated `/app/*` to `/login` | ORPHANED | File exists at `frontend/proxy.ts` with correct redirect logic, but no `middleware.ts` exists — Next.js never invokes it |
| 2 | `frontend/app/(auth)/login/page.tsx` exists with email+senha tab and magic link tab | VERIFIED | File exists, `Tabs` with `value="senha"` and `value="magic"`, both substantive with real form fields |
| 3 | Successful login redirects to `/app/dashboard` | VERIFIED | `handleSubmit` calls `router.push('/app/dashboard')` after `signInWithPassword` succeeds (line 37) |
| 4 | Magic link calls `signInWithOtp` | VERIFIED | `handleMagicLink` calls `supabase.auth.signInWithOtp({ email: magicEmail, ... })` (line 47) |

**Score:** 3/4 truths verified (1 failed — the middleware is an orphaned file)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/middleware.ts` | Next.js middleware entry point | MISSING | Does not exist. Framework never calls `proxy.ts`. |
| `frontend/proxy.ts` | Auth guard logic for /app/* routes | ORPHANED | Exists, logic is correct, but wrong filename for Next.js to pick it up. |
| `frontend/app/(auth)/login/page.tsx` | Login UI with two tabs | VERIFIED | 155 lines, full implementation, no stubs. |
| `frontend/app/api/auth/callback/route.ts` | Magic link callback handler | VERIFIED | Exchanges code for session, redirects to `/app/dashboard`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `middleware.ts` | `proxy.ts` | import + re-export | NOT_WIRED | `middleware.ts` does not exist; `proxy.ts` is never loaded by Next.js |
| `login/page.tsx` | `/app/dashboard` | `router.push` | WIRED | Line 37: `router.push('/app/dashboard')` after successful `signInWithPassword` |
| `login/page.tsx` | `supabase.auth.signInWithOtp` | direct call | WIRED | Line 47: `supabase.auth.signInWithOtp({ email: magicEmail, ... })` |
| `login/page.tsx` | `supabase.auth.signInWithPassword` | direct call | WIRED | Line 29: `supabase.auth.signInWithPassword({ email, password })` |
| `api/auth/callback/route.ts` | `/app/dashboard` | `NextResponse.redirect` | WIRED | Line 29: redirects to `${origin}${next}` where `next` defaults to `/app/dashboard` |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| AUTH-LOGIN | Login page with email+senha and magic link, middleware protecting /app/* | BLOCKED | Login page is fully implemented. Middleware protection is broken — `/app/*` routes are reachable without authentication because `middleware.ts` is absent. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/proxy.ts` | 1–57 | File named `proxy.ts` instead of `middleware.ts` | BLOCKER | Next.js ignores any file not named `middleware.ts` (or `src/middleware.ts`). Route protection does not work. |

### Human Verification Required

None identified — all checks are verifiable statically.

### Gaps Summary

The login UI and Supabase integration are fully implemented and correct. The single blocking gap is a filename error: Next.js middleware **must** be in a file named `middleware.ts` at the root of the project (next to `package.json`). The file `frontend/proxy.ts` exports a function named `proxy` with the correct auth guard logic, but Next.js does not know it exists.

**Fix required:** Create `frontend/middleware.ts` that re-exports the proxy function as the default `middleware` export, or simply rename `proxy.ts` to `middleware.ts` and rename the exported function from `proxy` to `middleware`. The `config.matcher` export in `proxy.ts` is already correctly shaped and can move with it.

Example fix:

```ts
// frontend/middleware.ts
export { proxy as middleware, config } from './proxy'
```

Or rename the file and the function directly. Either approach will activate route protection.

---

_Verified: 2026-04-01_
_Verifier: Claude (gsd-verifier)_
