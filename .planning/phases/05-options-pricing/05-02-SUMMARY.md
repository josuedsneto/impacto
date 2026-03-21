---
phase: 05-options-pricing
plan: 02
subsystem: frontend
tags: [options, payoff, black-scholes, monte-carlo, react, recharts]
dependency_graph:
  requires: [05-01]
  provides: [OPT-01, OPT-02, OPT-03]
  affects: [frontend/components/options/, frontend/app/app/options/page.tsx]
tech_stack:
  added: []
  patterns: [debounced-fetch, recharts-linechart, multi-leg-form, tab-layout]
key_files:
  created:
    - frontend/components/options/PayoffBuilder.tsx
    - frontend/components/options/PayoffChart.tsx
    - frontend/components/options/BSPricer.tsx
    - frontend/components/options/MCPricer.tsx
    - frontend/app/app/options/page.tsx
  modified: []
decisions:
  - "useRef + setTimeout/clearTimeout pattern used for 300ms debounce in BSPricer — no external debounce library"
  - "PayoffResult interface exported from PayoffBuilder.tsx and imported by page.tsx to avoid duplication"
  - "legCounter module-level variable used to generate stable unique IDs for React keys"
metrics:
  duration: 10min
  completed: 2026-03-21
  tasks_completed: 2
  files_changed: 5
---

# Phase 5 Plan 2: Options Frontend Summary

**One-liner:** Four React components (PayoffBuilder, PayoffChart, BSPricer, MCPricer) assembled into a three-tab `/app/options` page using Recharts LineChart with break-even ReferenceLine and debounced auto-recalculation.

## What Was Built

`frontend/components/options/PayoffBuilder.tsx`:
- Multi-leg option form with add/remove legs (call/put, long/short, strike, premium, quantity)
- POSTs to `/api/options/payoff` with Bearer token via `createBrowserClient`
- Calls `onPayoffResult` prop on success (OPT-01)

`frontend/components/options/PayoffChart.tsx`:
- Recharts `LineChart` rendering payoff series
- `ReferenceLine y={0}` to visualize break-even
- `XAxis` labeled "Preço do Ativo", `YAxis` labeled "P&L"

`frontend/components/options/BSPricer.tsx`:
- Five inputs: S, K, T, r, sigma with sensible defaults (S=20, K=20, T=1, r=0.05, sigma=0.20)
- Auto-recalculates on every input change, debounced 300ms using `useRef` + `setTimeout` (OPT-02)
- POSTs to `/api/options/bs-price`, displays result as large bold number

`frontend/components/options/MCPricer.tsx`:
- Same inputs as BSPricer plus `num_simulacoes` (default 10,000)
- Manual submit only — MC is slow, no auto-recalculate (OPT-03)
- POSTs to `/api/options/mc-price`, button shows "Calculando..." during load

`frontend/app/app/options/page.tsx`:
- Three tabs: "Payoff", "Black-Scholes", "MC Pricer"
- Payoff tab conditionally renders PayoffChart when result available
- BS and MC tabs include requirement notes (OPT-02/03)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- frontend/components/options/PayoffBuilder.tsx: FOUND
- frontend/components/options/PayoffChart.tsx: FOUND
- frontend/components/options/BSPricer.tsx: FOUND
- frontend/components/options/MCPricer.tsx: FOUND
- frontend/app/app/options/page.tsx: FOUND
- Commit 64f39e3 (components): FOUND
- Commit 9d8dae6 (page): FOUND
- TypeScript errors in options/: None
