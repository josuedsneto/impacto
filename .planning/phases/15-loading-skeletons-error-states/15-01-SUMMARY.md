---
phase: 15-regressao-acucar
plan: "01"
subsystem: api
tags: [regression, xgboost, ridge, yfinance, sklearn, supabase, fastapi]

# Dependency graph
requires:
  - phase: 14-regressao-dolar
    provides: regression.py with dolar functions, regression_runs table with tipo check including 'acucar'
provides:
  - get_acucar_defaults() — fetches SB=F, USDBRL=X, CL=F latest prices + USDA defaults
  - fetch_acucar_history() — merges annual yfinance closes with hardcoded USDA 2014-2024 data
  - run_acucar_regression() — Ridge/XGBoost training, prediction with 1.96-sigma uncertainty range
  - GET /api/regression/acucar/defaults — auth-guarded endpoint returning yfinance + USDA defaults
  - POST /api/regression/acucar/run — auth-guarded endpoint running model and persisting to regression_runs
affects: [frontend regressao-acucar page, regression_runs table queries]

# Tech tracking
tech-stack:
  added: [xgboost>=2.0.0, from __future__ import annotations (fixes forward reference NameError)]
  patterns: [RidgeCV with alpha grid search, XGBRegressor with fixed hyperparameters, annual yfinance+USDA merge, 1.96*std residuals for uncertainty range, historico list for frontend chart, lean DB payload (exclude historico from resultado column)]

key-files:
  created: []
  modified:
    - backend/regression.py
    - backend/main.py
    - backend/requirements.txt

key-decisions:
  - "XGBoost hyperparameters fixed (n_estimators=100, max_depth=3, lr=0.1) — small dataset (11 rows), no CV needed"
  - "historico returned in API response but not stored in DB resultado to keep payload lean"
  - "user[sub] used in acucar_run (matches JWT sub claim) — consistent with existing auth pattern"
  - "from __future__ import annotations added to main.py to fix pre-existing forward-reference NameError on Pydantic models defined after routes"

patterns-established:
  - "Sugar regression: fetch_acucar_history() returns year-indexed DataFrame; run_acucar_regression() trains on X=7 features, y=sb_f"
  - "Uncertainty range: 1.96 * std(residuals) symmetric band around point estimate"
  - "USDA data embedded as _USDA_ANNUAL dict — no external API dependency for training data"

requirements-completed: [ACUCAR-01, ACUCAR-02, ACUCAR-03, ACUCAR-04, ACUCAR-05]

# Metrics
duration: 18min
completed: 2026-04-06
---

# Phase 15 Plan 01: Sugar Regression Backend Summary

**Ridge/XGBoost sugar price regression with annual yfinance+USDA training data, 1.96-sigma uncertainty band, and two auth-guarded FastAPI endpoints persisting to regression_runs**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-06T00:00:00Z
- **Completed:** 2026-04-06T00:18:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `get_acucar_defaults()`, `fetch_acucar_history()`, `run_acucar_regression()` to regression.py with hardcoded USDA 2014-2024 annual data and yfinance annual close fetching
- Wired `GET /api/regression/acucar/defaults` and `POST /api/regression/acucar/run` in main.py following the dolar route pattern
- Auto-fixed pre-existing forward-reference `NameError` in main.py by adding `from __future__ import annotations`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add sugar model functions to regression.py** - `ce81dc7` (feat)
2. **Task 2: Wire /api/regression/acucar/* routes in main.py** - `112891f` (feat)

## Files Created/Modified
- `backend/regression.py` - Added _USDA_DEFAULTS, _USDA_ANNUAL, get_acucar_defaults(), fetch_acucar_history(), run_acucar_regression()
- `backend/main.py` - Added AcucarRunRequest model, two acucar routes, updated import, added from __future__ import annotations
- `backend/requirements.txt` - Added xgboost>=2.0.0

## Decisions Made
- XGBoost uses fixed hyperparameters (no grid search) — training set is only ~11 rows, CV would overfit
- `historico` list included in API response for frontend chart but excluded from DB `resultado` column to keep Supabase payload lean
- `user["sub"]` used in acucar_run Supabase insert — consistent with JWT sub claim pattern
- `from __future__ import annotations` added to fix pre-existing forward-reference NameError where Pydantic models were defined after the routes that use them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed forward-reference NameError in main.py**
- **Found during:** Task 2 (wiring routes)
- **Issue:** `DolarRegressionRequest` and `AcucarRunRequest` were defined after the routes that reference them as parameter types, causing `NameError` at module load
- **Fix:** Added `from __future__ import annotations` at top of main.py — defers annotation evaluation, allowing forward references
- **Files modified:** backend/main.py
- **Verification:** `python -c "import main"` exits 0 without errors
- **Committed in:** `112891f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Pre-existing bug that would prevent the backend from starting; critical fix, no scope creep.

## Issues Encountered
- Pre-existing forward-reference bug in main.py: Pydantic model classes were placed after the routes that use them as parameter type annotations, causing `NameError` on import. Fixed with `from __future__ import annotations`.

## User Setup Required
None - no external service configuration required beyond what Phase 14 already established (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars).

## Next Phase Readiness
- Backend fully ready for Phase 15 Plan 02 (Next.js Regressão Açúcar frontend)
- Endpoints: GET /api/regression/acucar/defaults, POST /api/regression/acucar/run
- Response shape: `{sb_f_previsto, sb_f_min, sb_f_max, r2, rmse, historico}`
- No blockers

---
*Phase: 15-regressao-acucar*
*Completed: 2026-04-06*
