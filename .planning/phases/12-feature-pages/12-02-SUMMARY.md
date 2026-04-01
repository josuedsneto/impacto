---
phase: 12-feature-pages
plan: "02"
subsystem: frontend
tags: [pages, focus, var, breakeven, arima, recharts, shadcn]
dependency_graph:
  requires: [12-01]
  provides: [focus-page, var-page, breakeven-page, arima-page]
  affects: [frontend/app/app]
tech_stack:
  added: []
  patterns: [recharts-ComposedChart, shadcn-Table, shadcn-Select, lazy-tab-fetch]
key_files:
  created:
    - frontend/app/app/focus/page.tsx
    - frontend/app/app/var/page.tsx
    - frontend/app/app/breakeven/page.tsx
    - frontend/app/app/arima/page.tsx
  modified: []
decisions:
  - "ARIMA panel uses lazy init pattern (fetch on first render, not on tab activation) to avoid double-fetch on mount"
  - "VaR panel re-fetches on confidence change via useCallback + useEffect dependency"
  - "ARIMA CI rendered as stacked Area fill trick (ci_upper filled, ci_lower fills with background) for shaded band without custom shape"
metrics:
  duration: ~2 min
  completed: "2026-04-01"
  tasks_completed: 4
  files_created: 4
---

# Phase 12 Plan 02: Focus, VaR, Breakeven, ARIMA Pages Summary

Four frontend feature pages implementing Focus/IPCA table, Value at Risk metrics with confidence selector, Breakeven calculator cards, and ARIMA forecast chart with CI shading — all following the existing auth/fetch pattern (createBrowserClient + Bearer token).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Focus page — IPCA expectation table | 312c44b | frontend/app/app/focus/page.tsx |
| 2 | VaR page — risk metrics for SB=F and USDBRL=X | 312c44b | frontend/app/app/var/page.tsx |
| 3 | Breakeven page | 312c44b | frontend/app/app/breakeven/page.tsx |
| 4 | ARIMA page — forecast chart | 312c44b | frontend/app/app/arima/page.tsx |

## What Was Built

**Focus page** (`/app/focus`): Fetches `GET /api/focus` on mount, renders a shadcn Table with DataReferência, Mediana (%), and last update date. Animated skeleton during load.

**VaR page** (`/app/var`): Two tabs (Açúcar NY / USD/BRL). Each tab renders a `VarPanel` component with a confidence-level Select (90/95/99%) that re-fetches on change. Six metric cards showing last price, historical VaR (abs + %), parametric VaR (abs + %), and observation count.

**Breakeven page** (`/app/breakeven`): Fetches `GET /api/breakeven` on mount. Highlighted primary card for the final R$/saca result, plus three secondary cards for sugar price (¢/lb), USD/BRL rate, and conversion factor.

**ARIMA page** (`/app/arima`): Two tabs (Açúcar NY / USD/BRL). Each tab renders an `ArimaPanel` with a steps Select (15/30/60 days). Uses Recharts `ComposedChart` with stacked `Area` fill trick for confidence interval shading plus two `Line` series (historical solid, forecast dashed). Shows yellow warning box when API returns 400 (ARIMA failed to converge).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
