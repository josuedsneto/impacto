---
phase: 09-fix-mkt03-param01
plan: "02"
subsystem: backend/simulation
tags: [simulation, params, volatility, param-01]
dependency_graph:
  requires: [backend/simulation.py, backend/main.py, supabase/migrations/20260320000005_user_parameters.sql]
  provides: [PARAM-01 wired end-to-end]
  affects: [POST /api/simulations]
tech_stack:
  added: []
  patterns: [optional-param-override, user-params-prefetch]
key_files:
  modified:
    - backend/simulation.py
    - backend/main.py
decisions:
  - "Used user_parameters table (actual DB table) instead of user_simulation_params as written in plan — plan had wrong table name"
  - "Client variable re-created before run_simulation and again before insert — identical credentials, no functional impact"
metrics:
  duration: "5 min"
  completed: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 09 Plan 02: Wire volatilidade_custom into Simulation Engine Summary

**One-liner:** Extended run_simulation() with optional volatilidade_custom override and wired user_parameters lookup into POST /api/simulations to satisfy PARAM-01.

## What Was Done

- `backend/simulation.py`: Added `volatilidade_custom: float | None = None` parameter to `run_simulation()`. When not None, overrides the historical sigma after GBM parameter estimation. Fallback to historical std is unchanged.
- `backend/main.py`: In `create_simulation()`, added a Supabase query to `user_parameters` before calling `run_simulation()`. The fetched `volatilidade_custom` value (or None) is passed through.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrong table name in plan code snippets**
- **Found during:** Task 2
- **Issue:** Plan specified `user_simulation_params` in the code to add, but the actual Supabase table (created in phase 01) is `user_parameters`. Using the wrong table name would cause a runtime error on every simulation request.
- **Fix:** Used `user_parameters` in the implementation.
- **Files modified:** backend/main.py
- **Commit:** 4f39cd2

## Self-Check

- [x] `backend/simulation.py` — `volatilidade_custom` param present: VERIFIED
- [x] `backend/main.py` — `user_parameters` query inside `create_simulation`: VERIFIED
- [x] Commits 98d6dc2 and 4f39cd2 exist: VERIFIED
