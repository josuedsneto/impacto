---
phase: 04-mc-simulation
plan: 02
subsystem: frontend
tags: [simulation, monte-carlo, react, recharts, shadcn]
dependency_graph:
  requires: [POST /api/simulations, GET /api/simulations/{id}, auth.createBrowserClient]
  provides: [SimulationForm, FanChart, SimulationMetrics]
  affects: [frontend simulation page (04-03)]
tech_stack:
  added: [recharts@2.15.4]
  patterns: [controlled form with Bearer token fetch, Recharts AreaChart fan chart, shadcn-style ui primitives]
key_files:
  created:
    - frontend/components/simulation/SimulationForm.tsx
    - frontend/components/simulation/FanChart.tsx
    - frontend/components/simulation/SimulationMetrics.tsx
    - frontend/components/ui/input.tsx
    - frontend/components/ui/label.tsx
  modified:
    - frontend/package.json
decisions:
  - SimulationResult interface defined in SimulationForm.tsx and re-imported by SimulationMetrics to avoid duplication
  - Input and Label ui stubs created as native HTML wrappers (no @base-ui/react equivalent) — resolves pre-existing TS errors in TickerSuggestForm too
  - recharts resolved to 2.15.4 (npm latest satisfying ^2.12.7)
metrics:
  duration: ~8 min
  completed: 2026-03-21
  tasks_completed: 2
  files_changed: 6
---

# Phase 4 Plan 2: Simulation React Components Summary

**One-liner:** Three reusable React components for MC simulation — controlled form, Recharts fan chart, and scalar metrics card.

## What Was Built

`frontend/components/simulation/SimulationForm.tsx` — "use client" controlled form with six inputs (ticker, preco_inicial, dias_simulados, num_simulacoes, pct_bound, label). On submit, fetches Bearer token via `createBrowserClient`, POSTs to `/api/simulations`, calls `onResult(data)` on success or shows a red error paragraph on failure.

`frontend/components/simulation/FanChart.tsx` — "use client" Recharts `AreaChart` inside `ResponsiveContainer (100% x 400px)`. Transforms `percentiles_series` into a day-indexed data array and renders five `Area` layers (p95, p80, p50, p20, p5) with blue fill and opacity shading to form a fan chart.

`frontend/components/simulation/SimulationMetrics.tsx` — "use client" card (Tailwind-styled, no shadcn Card dependency) showing ticker + dias_simulados header, three stat cells (P5 / P50 / P95), and preço inicial footer.

`frontend/components/ui/input.tsx` and `frontend/components/ui/label.tsx` — minimal native-element wrappers following the same Tailwind + `cn()` pattern as `button.tsx`. Created because these were missing and already imported by `TickerSuggestForm`.

## Decisions Made

- `SimulationResult` interface lives in `SimulationForm.tsx` and is re-exported; `SimulationMetrics` imports it from there to avoid interface drift.
- Metrics card uses plain Tailwind (`rounded-xl border bg-card`) instead of a shadcn Card component that does not yet exist in the project.
- `isAnimationActive={false}` on all Area layers for performance with 252+ data points.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Created ui/input.tsx and ui/label.tsx**
- **Found during:** Task 1
- **Issue:** `@/components/ui/input` and `@/components/ui/label` were imported by `TickerSuggestForm.tsx` but not present — TypeScript reported TS2307 errors. SimulationForm also needed these.
- **Fix:** Created both as minimal native-element wrappers with Tailwind styling matching the existing button.tsx pattern.
- **Files modified:** frontend/components/ui/input.tsx, frontend/components/ui/label.tsx
- **Commit:** efa2bff

## Self-Check

Files exist:
- frontend/components/simulation/SimulationForm.tsx: FOUND
- frontend/components/simulation/FanChart.tsx: FOUND
- frontend/components/simulation/SimulationMetrics.tsx: FOUND
- frontend/components/ui/input.tsx: FOUND
- frontend/components/ui/label.tsx: FOUND

Commits:
- efa2bff: feat(04-02): create SimulationForm and SimulationMetrics components
- 3db0979: feat(04-02): create FanChart component and add recharts dependency

## Self-Check: PASSED
