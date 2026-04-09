---
phase: quick
plan: 1
subsystem: frontend/atr
tags: [bug-fix, api-contract, typescript, atr]
dependency_graph:
  requires: []
  provides: [INT-01-fix, INT-02-fix, INT-03-fix]
  affects: [frontend/app/app/atr/page.tsx, frontend/components/admin/AtrUsinasAdmin.tsx]
tech_stack:
  added: []
  patterns: [envelope-unwrapping, fetch-guard]
key_files:
  created: []
  modified:
    - frontend/app/app/atr/page.tsx
    - frontend/components/admin/AtrUsinasAdmin.tsx
decisions:
  - "Guard historico fetch on empty selectedUsinaId — show informational message instead of calling backend without required param"
  - "Associate-user uses path params only (/usuarios/{user_id}), no request body — matches FastAPI route definition"
metrics:
  duration: ~10 min
  completed: 2026-04-09
---

# Phase quick Plan 1: Fix ATR Integration Bugs (INT-01, INT-02, INT-03) Summary

**One-liner:** Fixed three API contract mismatches in ATR frontend — usinas envelope unwrap, historico 422 guard, and associate-user path-param endpoint.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Fix INT-01 and INT-02 in atr/page.tsx | 77ba8fd | frontend/app/app/atr/page.tsx |
| 2 | Fix INT-01 and INT-03 in AtrUsinasAdmin.tsx | 54b1fcf | frontend/components/admin/AtrUsinasAdmin.tsx |

## What Was Done

### Task 1 — atr/page.tsx (INT-01 + INT-02)

**INT-01:** `setUsinas` was casting the raw API response as `Usina[]`, but the backend returns `{"usinas": [...]}`. Fixed by unwrapping: `(data as { usinas: Usina[] }).usinas`.

**INT-02 Part A:** The historico fetch was falling through to call `/api/atr/historico` with no `usina_id` query param when `selectedUsinaId` was empty — triggering a 422. Fixed by guarding the fetch: when `selectedUsinaId` is empty, set an informational error message and return early.

**INT-02 Part B:** The success branch cast `data as HistoricoItem[]` — backend returns `{"historico": [...]}`. Fixed by unwrapping: `(data as { historico: HistoricoItem[] }).historico`.

**INT-02 Part C:** Added a `useEffect` to reset `historicoLoaded` and `historicoError` whenever `selectedUsinaId` changes, so switching usinas forces a fresh load instead of serving stale data.

### Task 2 — AtrUsinasAdmin.tsx (INT-01 + INT-03)

**INT-01:** Same envelope mismatch in admin `fetchUsinas`. Fixed the same way: `(data as { usinas: Usina[] }).usinas`.

**INT-03:** `handleAssociate` was calling `POST /api/admin/usinas/{id}/users` with `{ user_id }` in the request body. The actual FastAPI route is `POST /api/admin/usinas/{usina_id}/usuarios/{user_id_target}` — both IDs as path parameters, no body. Fixed the fetch URL to include `user_id` in the path and removed the body and Content-Type header.

## Deviations from Plan

None — plan executed exactly as written.

## Success Criteria Verification

- INT-01: Both files unwrap `{ usinas: Usina[] }` envelope before calling setUsinas. PASS
- INT-02: Historico fetch only fires when selectedUsinaId is non-empty; response unwraps `{ historico: HistoricoItem[] }` envelope. PASS
- INT-03: Associate-user call targets `/api/admin/usinas/{id}/usuarios/{user_id}` as path params with no body. PASS
- TypeScript compilation passes cleanly (`npx tsc --noEmit` — no output). PASS

## Self-Check: PASSED

- frontend/app/app/atr/page.tsx — modified and committed (77ba8fd)
- frontend/components/admin/AtrUsinasAdmin.tsx — modified and committed (54b1fcf)
- `data as Usina[]` — 0 occurrences remain in both files
- `data as HistoricoItem[]` — 0 occurrences remain
- `/users` path segment — 0 occurrences remain in AtrUsinasAdmin.tsx
- TypeScript: clean (no errors)
