---
phase: 10-cicd-artifacts-polish
plan: "01"
subsystem: frontend
tags: [fouc, theme, auth, admin, security]
dependency_graph:
  requires: []
  provides: [INFRA-04, ADM-01]
  affects: [frontend/app/layout.tsx, frontend/components/ThemeProvider.tsx, frontend/app/app/admin/page.tsx]
tech_stack:
  added: []
  patterns: [blocking-inline-script, dom-initialized-state, server-component-role-guard]
key_files:
  modified:
    - frontend/app/layout.tsx
    - frontend/components/ThemeProvider.tsx
    - frontend/app/app/admin/page.tsx
decisions:
  - "Blocking inline script via dangerouslySetInnerHTML in layout head — not Script strategy=beforeInteractive — avoids client component overhead"
  - "ThemeProvider initializes from DOM classList (set by blocking script) instead of reading localStorage in useEffect"
  - "Admin role sourced from app_metadata.role per existing JWT architecture decision"
metrics:
  duration: 10
  completed: 2026-03-22
---

# Phase 10 Plan 01: FOUC Fix and Admin Role Guard Summary

**One-liner:** Blocking inline theme script eliminates dark-flash on light-theme users; admin Server Component now redirects non-admin users via app_metadata.role before rendering UI.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | FOUC fix — blocking script + ThemeProvider DOM init | 5474967 | frontend/app/layout.tsx, frontend/components/ThemeProvider.tsx |
| 2 | ADM-01 — role guard in admin Server Component | 1dae601 | frontend/app/app/admin/page.tsx |

## What Was Built

### Task 1: FOUC Fix

Added an inline blocking `<script>` tag inside `<head>` in `layout.tsx` using `dangerouslySetInnerHTML`. The script runs synchronously before React hydration, reading `localStorage.getItem('theme')` and setting or removing the `dark` class on `document.documentElement`.

Updated `ThemeProvider.tsx` to initialize state from the DOM: `document.documentElement.classList.contains('dark')` instead of the hardcoded `'dark'`. Removed the first `useEffect` that read localStorage (now handled by the blocking script). The second `useEffect` that writes localStorage and updates classList on toggle is preserved.

### Task 2: ADM-01 Role Guard

Added `app_metadata?.role` check in `frontend/app/app/admin/page.tsx` after the existing unauthenticated user redirect. Non-admin authenticated users are redirected to `/app/dashboard` server-side before any component renders or API call is made. Admin users continue to the SuggestionQueue UI.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- frontend/app/layout.tsx: contains `dangerouslySetInnerHTML`
- frontend/components/ThemeProvider.tsx: contains `classList.contains`
- frontend/app/app/admin/page.tsx: contains `app_metadata` and `redirect('/app/dashboard')`
- Commits 5474967 and 1dae601 exist
