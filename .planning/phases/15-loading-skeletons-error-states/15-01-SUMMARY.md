---
phase: 15-loading-skeletons-error-states
plan: "01"
subsystem: frontend-ux
tags: [skeleton, abort-controller, error-state, react-hooks, shadcn]
dependency_graph:
  requires: []
  provides:
    - frontend/components/ui/skeleton.tsx
    - frontend/hooks/useApiCall.ts
    - frontend/components/shared/ErrorState.tsx
  affects:
    - All 12 data-fetching pages in frontend/app/app/
tech_stack:
  added:
    - shadcn Skeleton (installed via npx shadcn@latest add skeleton)
  patterns:
    - AbortController + useRef for request cancellation (REL-05)
    - useCallback-wrapped execute() for stable hook reference
    - AnimatedPulse skeleton via shadcn Skeleton primitive
key_files:
  created:
    - frontend/components/ui/skeleton.tsx
    - frontend/hooks/useApiCall.ts
    - frontend/components/shared/ErrorState.tsx
  modified: []
decisions:
  - useApiCall checks !controller.signal.aborted before setData and setLoading(false) in finally — prevents stale state updates after intentional cancellation
  - AbortError silently ignored in catch block so user never sees an error flash during retry
  - fetcher receives AbortSignal as argument — each consuming page wires signal into its fetch() call
metrics:
  duration: "~5 min"
  completed: "2026-04-05"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 15 Plan 01: Shared Skeleton + AbortController Hook Infrastructure Summary

**One-liner:** shadcn Skeleton primitive installed plus `useApiCall` hook (AbortController + loading/error/data) and `ErrorState` component (AlertCircle + Tentar novamente button) — three shared artifacts required by all 12 subsequent data-fetching page plans.

## What Was Built

### Task 1: shadcn Skeleton component (af0595a)

Installed `frontend/components/ui/skeleton.tsx` via `npx shadcn@latest add skeleton`. The CLI produced the new-york/zinc-compatible component with `animate-pulse rounded-md bg-accent` base classes and `data-slot="skeleton"` attribute. No manual editing needed.

### Task 2: useApiCall hook and ErrorState component (73d777a)

Created `frontend/hooks/useApiCall.ts` — a generic hook that accepts a `fetcher: (signal: AbortSignal) => Promise<T>` and returns `{ loading, error, data, execute }`. The `execute()` function:

1. Aborts any previous in-flight request via `abortRef.current?.abort()`
2. Creates a fresh `AbortController` and stores it in `abortRef`
3. Sets `loading: true`, clears error, calls `fetcher(controller.signal)`
4. On success: sets `data` only if signal not aborted
5. On error: silently returns if `AbortError`; otherwise sets human-readable error string
6. In finally: clears loading only if signal not aborted

Created `frontend/components/shared/ErrorState.tsx` — renders `AlertCircle` icon (lucide-react), error message paragraph, and a shadcn `Button variant="outline" size="sm"` with text "Tentar novamente" wired to `onRetry`. No new dependencies needed (`lucide-react ^0.577.0` and `Button` already present).

## Verification Results

All 5 automated checks passed:
- `skeleton.tsx` exists with `animate-pulse`
- `useApiCall.ts` exists with `abortRef` pattern
- `ErrorState.tsx` exists with "Tentar novamente"
- `useApiCall` function exported
- `ErrorState` function exported

TypeScript: zero errors in new files. One pre-existing error in `next.config.ts` (Turbopack options type mismatch) is out of scope and pre-dates this plan.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Hash | Message |
|------|---------|
| af0595a | feat(15-01): install shadcn Skeleton component |
| 73d777a | feat(15-01): create useApiCall hook and ErrorState component |

## Self-Check: PASSED

- `frontend/components/ui/skeleton.tsx` — FOUND
- `frontend/hooks/useApiCall.ts` — FOUND
- `frontend/components/shared/ErrorState.tsx` — FOUND
- Commit af0595a — FOUND
- Commit 73d777a — FOUND
