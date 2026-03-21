---
phase: 06-params-watchlist
plan: "02"
subsystem: frontend
tags: [next.js, react, supabase, watchlist, live-prices]
dependency_graph:
  requires: [GET /api/watchlist, POST /api/watchlist, DELETE /api/watchlist/{ticker}, GET /api/market/prices]
  provides: [WatchlistManager component, dashboard page with live watchlist]
  affects: [frontend/app/app/dashboard/page.tsx]
tech_stack:
  added: []
  patterns: [createBrowserClient + getSession for client-side auth token, Promise.all parallel price fetches, server component embedding client boundary]
key_files:
  created: [frontend/components/watchlist/WatchlistManager.tsx]
  modified: [frontend/app/app/dashboard/page.tsx]
decisions:
  - WatchlistManager uses createBrowserClient + getSession matching SimulationForm.tsx auth pattern
  - Price fetch window is last 7 days (not 5) to handle weekends/holidays with no trading data
  - null price displayed as dash (not error) per must_have truth
  - handleRemove deletes from local state immediately on success (optimistic UI, no reload)
  - addInput uppercased on submit to normalize ticker symbols
metrics:
  duration: ~8 min
  completed: 2026-03-21
---

# Phase 06 Plan 02: Watchlist Frontend Summary

WatchlistManager client component with live per-ticker price display embedded in the dashboard, replacing the "Plataforma em construção" placeholder with a functional watchlist UI backed by the phase 06-01 API routes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create WatchlistManager component | a024dab | frontend/components/watchlist/WatchlistManager.tsx |
| 2 | Update dashboard page to embed WatchlistManager | 37a3f1b | frontend/app/app/dashboard/page.tsx |

## What Was Built

`frontend/components/watchlist/WatchlistManager.tsx`:
- "use client" component with `getAccessToken` (createBrowserClient + getSession)
- `fetchPrice` helper: queries `/api/market/prices?ticker=...&start=...&end=...`, returns last row's close or null
- On mount: fetches GET `/api/watchlist` then parallel `Promise.all` price fetches
- `handleAdd`: trims/uppercases input, POST to `/api/watchlist`, on success prepends ticker and fetches its price
- `handleRemove`: DELETE `/api/watchlist/{ticker}`, on success removes from both `tickers` and `prices` state
- Render: heading, add form with inline error, loading/empty states, list rows (ticker, formatted price or "—", remove button)

`frontend/app/app/dashboard/page.tsx`:
- Server component — kept auth check + redirect unchanged
- Replaced placeholder div with `container mx-auto py-8 space-y-6` layout
- Imports and renders `<WatchlistManager />`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `frontend/components/watchlist/WatchlistManager.tsx` exists and contains all required identifiers
- `frontend/app/app/dashboard/page.tsx` contains WatchlistManager import, container layout, placeholder removed
- Commits a024dab and 37a3f1b verified in git log
