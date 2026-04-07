---
phase: 14-regressao-dolar
plan: "01"
subsystem: backend
tags: [regression, ols, bcb, fred, supabase, fastapi]
dependency_graph:
  requires: []
  provides: [regression_runs-table, /api/regression/dolar/run, /api/regression/dolar/defaults]
  affects: [backend/main.py, supabase/migrations]
tech_stack:
  added: [scikit-learn>=1.4.0]
  patterns: [OLS via statsmodels, lazy-bcb-import, run_in_executor for blocking IO, RLS user-isolation]
key_files:
  created:
    - supabase/migrations/20260406000001_regression_runs.sql
    - backend/regression.py
  modified:
    - backend/main.py
    - backend/requirements.txt
    - backend/.env.example
decisions:
  - "Lazy bcb import inside functions (matches existing /api/focus pattern; avoids top-level import side-effects)"
  - "SUPABASE_SERVICE_ROLE_KEY used (consistent with all other routes; plan specified SUPABASE_SERVICE_KEY which was incorrect)"
  - "regression_runs tipo CHECK includes 'acucar' now so Phase 15 reuses same table without a new migration"
metrics:
  duration: ~15 min
  completed: 2026-04-07
  tasks: 3
  files: 5
---

# Phase 14 Plan 01: FastAPI OLS Regression Backend Summary

**One-liner:** FastAPI OLS regression backend with BCB+FRED data fetching, Supabase persistence, and two auth-guarded endpoints for USD/BRL prediction.

## What Was Built

Three artifacts implement the server-side computation for the Regressão Dólar feature:

1. **Supabase migration** (`regression_runs` table): shared table for dolar and acucar regression runs, with RLS SELECT/INSERT policies scoped to `auth.uid()`.

2. **regression.py module**: OLS logic + data fetching:
   - `get_dolar_defaults()` — fetches latest BCB (selic, m2_bcb, prod_industrial) and FRED (fed_funds, m2_fred, indpro) values via python-bcb SGS and requests respectively
   - `fetch_dolar_history(months=60)` — merges 60 months of monthly BCB + FRED + USDBRL=X data; raises `ValueError` if <24 rows
   - `run_dolar_regression(inputs)` — trains OLS via statsmodels, returns `taxa_prevista`, `r2`, `rmse`, `coeficientes`, `correlacao`

3. **main.py route wiring**: two new endpoints:
   - `GET /api/regression/dolar/defaults` — rate-limited 20/min, returns latest series values
   - `POST /api/regression/dolar/run` — rate-limited 10/min, runs OLS, persists row to `regression_runs`, returns 5-field result

## Commits

| Hash | Description |
|------|-------------|
| bacdbc8 | feat(14-01): add regression_runs Supabase migration |
| 1245de8 | feat(14-01): add regression.py OLS module with BCB/FRED data fetching |
| ad88fe2 | feat(14-01): wire /api/regression/dolar/* routes in main.py |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong Supabase service key env var name**
- **Found during:** Task 3
- **Issue:** Plan specified `SUPABASE_SERVICE_KEY` but every other route in main.py uses `SUPABASE_SERVICE_ROLE_KEY` — would cause `KeyError` at runtime
- **Fix:** Changed to `SUPABASE_SERVICE_ROLE_KEY` to match existing convention
- **Files modified:** backend/main.py
- **Commit:** ad88fe2

## Self-Check: PASSED

All 3 artifact files confirmed on disk. All 3 task commits confirmed in git log.
