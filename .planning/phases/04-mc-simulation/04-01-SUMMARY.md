---
phase: 04-mc-simulation
plan: 01
subsystem: backend
tags: [simulation, monte-carlo, fastapi, supabase, rls]
dependency_graph:
  requires: [market_cache.get_prices, auth.get_current_user, supabase.simulations_table]
  provides: [run_simulation, POST /api/simulations, GET /api/simulations, GET /api/simulations/{id}]
  affects: [frontend simulation page]
tech_stack:
  added: []
  patterns: [vectorized GBM with np.cumprod, cache-aside via market_cache, user-scoped RLS via service role + .eq(user_id)]
key_files:
  created: [backend/simulation.py]
  modified: [backend/main.py]
decisions:
  - PCT_BOUND=0.50 bounds applied per-step to clip GBM paths (from STATE.md)
  - Scalar p5/p50/p95 stored alongside JSONB percentiles_series for flexible querying
  - User isolation enforced at query level via .eq("user_id", user["id"]) — not solely relying on RLS
metrics:
  duration: ~8 min
  completed: 2026-03-21
  tasks_completed: 2
  files_changed: 2
---

# Phase 4 Plan 1: MC Simulation Engine and FastAPI Routes Summary

**One-liner:** Vectorized GBM simulation engine persisted to Supabase with user-scoped RLS-safe API routes.

## What Was Built

`backend/simulation.py` — single public function `run_simulation()` that fetches 3 years of historical closes via `market_cache.get_prices()`, estimates log-return mu/sigma, runs 10,000 GBM paths vectorized with `np.cumprod`, clips to ±50% PCT_BOUND bounds, and returns scalar percentiles (p5–p95) plus a `percentiles_series` JSONB dict of daily series across all simulated days.

`backend/main.py` — three new routes appended after existing market routes:
- `POST /api/simulations` — runs engine, inserts full result to `simulations` table with `user_id` from JWT, returns `id` + all metrics
- `GET /api/simulations` — lists user's simulations (summary columns only, no `percentiles_series`)
- `GET /api/simulations/{id}` — returns full simulation or 404 if not found or belongs to another user

## Decisions Made

- User isolation enforced at query level (`.eq("user_id", user["id"])`) in both list and detail routes — belt-and-suspenders alongside Supabase RLS
- `percentiles_series` excluded from list endpoint to keep payload small; included only in detail endpoint
- `label` field optional (None if empty string) — allows user to name simulations for history UI

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files exist:
- backend/simulation.py: FOUND
- backend/main.py: FOUND (modified)

Commits:
- 8ddf617: feat(04-01): create MC simulation engine
- 8e75bd2: feat(04-01): add simulation routes to FastAPI

## Self-Check: PASSED
