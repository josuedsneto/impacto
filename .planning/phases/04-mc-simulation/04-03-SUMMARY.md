---
phase: 04-mc-simulation
plan: 03
subsystem: frontend
tags: [simulation, monte-carlo, react, tabs, next.js]
dependency_graph:
  requires: [SimulationForm, FanChart, SimulationMetrics, GET /api/simulations, GET /api/simulations/{id}]
  provides: [simulation page with two tabs, history list, fan chart replay]
  affects: []
tech_stack:
  added: []
  patterns: [native HTML tabs with React context, lazy-fetch on tab activation, prepend-to-history optimistic update]
key_files:
  created:
    - frontend/app/app/simulation/page.tsx
    - frontend/components/ui/tabs.tsx
  modified: []
decisions:
  - ui/tabs.tsx created as native HTML stub — no external tabs library needed; API matches shadcn Tabs surface
  - History list lazy-fetches on first Histórico tab activation, not on mount — avoids redundant API call when user never visits history
  - handleNewResult prepends optimistically to history state (SIM-02 — no page reload required)
metrics:
  duration: ~8 min
  completed: 2026-03-21
  tasks_completed: 1
  files_changed: 2
---

# Phase 4 Plan 3: Simulation Page Summary

**One-liner:** Two-tab simulation page composing SimulationForm, FanChart, and SimulationMetrics with lazy-loaded history replay via GET /api/simulations.

## What Was Built

`frontend/app/app/simulation/page.tsx` — "use client" page with two tabs:

- **Simular tab:** Renders `<SimulationForm onResult={handleNewResult} />`. On successful simulation, `handleNewResult` sets `activeResult` and prepends a `HistorySummary` to `history` state. Below the form, if `activeResult` is set, renders `<SimulationMetrics>` and `<FanChart>`.

- **Histórico tab:** On first activation (`historyLoaded === false`), fetches `GET /api/simulations` with Bearer token, sets history, marks loaded. Renders a clickable list of past simulations (ticker, label, P50, date). Clicking an item fetches `GET /api/simulations/{id}` and replays the full fan chart in the Simular tab by switching `activeTab`.

`frontend/components/ui/tabs.tsx` — minimal native-HTML Tabs implementation using React context (`TabsContext`) to share active value between `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent`. API surface matches the shadcn/ui Tabs components used in the page import.

## Decisions Made

- `ui/tabs.tsx` built as a native stub (Rule 2 auto-fix) — `@/components/ui/tabs` was imported but missing, causing TS2307.
- History fetch deferred to first tab activation instead of component mount — avoids an API call on every page load for users who only run simulations.
- `toSummary()` helper extracts `HistorySummary` fields from the full `SimulationResult` returned by the API, keeping the two interfaces cleanly separated.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Created ui/tabs.tsx**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `@/components/ui/tabs` imported in simulation/page.tsx but no such file existed — TS2307 error blocked compilation.
- **Fix:** Created `frontend/components/ui/tabs.tsx` as a native-element implementation with React context, matching the shadcn Tabs API surface (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`).
- **Files modified:** frontend/components/ui/tabs.tsx
- **Commit:** 0eefdf5

## Self-Check

Files exist:
- frontend/app/app/simulation/page.tsx: FOUND
- frontend/components/ui/tabs.tsx: FOUND

Commits:
- 0eefdf5: feat(04-03): create simulation page with Simular and Histórico tabs

## Self-Check: PASSED
