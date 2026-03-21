---
phase: 06-params-watchlist
plan: "03"
subsystem: frontend
tags: [nextjs, react, supabase, params, form]
dependency_graph:
  requires: [GET /api/params/{ticker}, PUT /api/params/{ticker}, frontend/components/ui/input.tsx, frontend/components/ui/button.tsx]
  provides: [frontend/components/params/ParamsForm, /app/params route]
  affects: [simulation page (will pre-fill from saved params)]
tech_stack:
  added: []
  patterns: [useEffect ticker-change load, createBrowserClient inline token, server component auth guard]
key_files:
  created: [frontend/components/params/ParamsForm.tsx, frontend/app/app/params/page.tsx]
  modified: []
decisions:
  - ParamsForm uses useEffect([ticker]) to load on mount and on ticker change — avoids stale data across ticker switches
  - Only non-empty fields sent in PUT body — omitting fields rather than sending null matches backend 400 guard
  - select element styled with Tailwind to match shadcn Input appearance — no new component needed
metrics:
  duration: ~2 min
  completed: 2026-03-21
---

# Phase 06 Plan 03: Params Settings Page Summary

Per-ticker simulation params form (ParamsForm) with load-on-mount, PUT save, and success/error feedback, mounted at /app/params as an auth-guarded server page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ParamsForm client component | 930d619 | frontend/components/params/ParamsForm.tsx |
| 2 | Create /app/params page | 1a9415e | frontend/app/app/params/page.tsx |

## What Was Built

**ParamsForm.tsx** (`frontend/components/params/ParamsForm.tsx`):
- "use client" component with ticker selector (SB=F / USDBRL=X)
- Loads saved params via GET `/api/params/{ticker}` on mount and ticker change (useEffect)
- 404 response treated as no-params-yet — leaves fields empty without error
- Three numeric inputs: volatilidade_custom (0–5, step 0.01), taxa_livre_risco (-0.5–1, step 0.001), pct_bound_preferido (0.05–2, step 0.01)
- handleSave builds body with only non-empty fields, sends PUT `/api/params/{ticker}`
- Guards: validates at least one field filled before sending
- Feedback: "Carregando..." during load, "Parâmetros salvos com sucesso." (green) on success, error text (red) on failure

**page.tsx** (`frontend/app/app/params/page.tsx`):
- Server component following dashboard pattern exactly
- Auth guard via createServerSupabaseClient + getUser, redirect('/login') if unauthenticated
- Renders ParamsForm inside container with heading and subtitle

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- frontend/components/params/ParamsForm.tsx exists
- frontend/app/app/params/page.tsx exists
- All required identifiers present in both files
- Commits 930d619 and 1a9415e verified
