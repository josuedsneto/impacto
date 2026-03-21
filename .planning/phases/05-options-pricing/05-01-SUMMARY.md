---
phase: 05-options-pricing
plan: 01
subsystem: backend
tags: [options, pricing, black-scholes, monte-carlo, fastapi]
dependency_graph:
  requires: []
  provides: [OPT-01, OPT-02, OPT-03]
  affects: [backend/main.py, backend/options.py]
tech_stack:
  added: [scipy.stats.norm]
  patterns: [risk-neutral-mc, black-scholes, pydantic-models]
key_files:
  created: [backend/options.py]
  modified: [backend/main.py]
decisions:
  - "Risk-neutral drift (r - 0.5*sigma^2) used in mc_call_price — not historical mu — per no-arbitrage pricing theory"
  - "scipy.stats.norm.cdf used for Black-Scholes N() — scipy is already a transitive dependency"
  - "200 price points generated from 0.5*min_strike to 1.5*max_strike when price_range is None"
  - "New routes follow existing /api/* prefix convention (Nginx no-strip architecture from STATE.md)"
metrics:
  duration: 8min
  completed: 2026-03-21
  tasks_completed: 2
  files_changed: 2
---

# Phase 5 Plan 1: Options Pricing Backend Summary

**One-liner:** Three FastAPI options pricing routes backed by payoff computation, Black-Scholes, and risk-neutral MC pricer in `backend/options.py`.

## What Was Built

`backend/options.py` — three public functions:
- `compute_payoff(legs, price_range)` — vectorized multi-leg P&L across 200 price points (OPT-01)
- `bs_call_price(S, K, T, r, sigma)` — standard Black-Scholes via `scipy.stats.norm.cdf` (OPT-02)
- `mc_call_price(S, K, T, r, sigma, num_simulacoes)` — risk-neutral GBM paths, discounted expected payoff (OPT-03)

`backend/main.py` additions:
- Pydantic models: `OptionLeg`, `PayoffRequest`, `BSPriceRequest`, `MCPriceRequest`
- `POST /api/options/payoff` — multi-leg payoff diagram
- `POST /api/options/bs-price` — Black-Scholes European call
- `POST /api/options/mc-price` — MC European call, all protected by `get_current_user`

## Verification Results

ATM European call (S=20, K=20, T=1yr, r=5%, sigma=20%):
- BS price: 2.0901
- MC price: 2.1022 (deviation: 0.6% — well within 15% tolerance)

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Items

Pre-existing: All FastAPI routes in `backend/main.py` use `/api/*` prefixes, which conflicts with the vercel-services skill rule (Vercel strips routePrefix before forwarding). This is an architectural decision recorded in STATE.md ("Nginx does NOT strip /api prefix") and out of scope for this plan. Logged to `deferred-items.md`.

## Self-Check: PASSED

- backend/options.py: FOUND
- Commit f75a3d7 (options.py): FOUND
- Commit 890539a (main.py routes): FOUND
