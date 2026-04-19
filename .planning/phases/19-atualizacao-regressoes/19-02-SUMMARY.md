---
phase: 19-atualizacao-regressoes
plan: 02
subsystem: ui
tags: [streamlit, yfinance, sklearn, ridge, xgboost, seaborn, USDA]

requires:
  - phase: 19-atualizacao-regressoes-01
    provides: backend/regression.py sugar regression functions

provides:
  - pages/05_Regressão_Açúcar.py rewritten to fetch live prices via yfinance
  - backend/regression.py _USDA_ANNUAL updated with year 2025 (12 entries)
  - backend/regression.py _USDA_DEFAULTS updated to 2025/26 projections

affects: [19-atualizacao-regressoes, regressao-acucar]

tech-stack:
  added: []
  patterns:
    - "@st.cache_data(ttl=3600) on yfinance annual fetch"
    - "Local _USDA_ANNUAL in Streamlit page mirrors backend — avoids cross-import"
    - "Inner join between yfinance annual closes and USDA data on year index"

key-files:
  created: []
  modified:
    - pages/05_Regressão_Açúcar.py
    - backend/regression.py

key-decisions:
  - "Local _USDA_ANNUAL duplicated in Streamlit page (not imported from backend) to keep pages self-contained per project pattern"
  - "Inner join between yfinance and USDA data naturally excludes 2025 if no annual close available yet — no special-case code needed"
  - "Ridge/XGBoost inputs use Mt directly (48.5) not legacy 'milhares' (45000) — aligned with backend and USDA PSD units"
  - "float(last.iloc[0]) if hasattr(last, 'iloc') else float(last) pattern for yfinance multi-level column FutureWarning"

patterns-established:
  - "Streamlit regression pages: fetch_dados_X() with ttl=3600, inputs in real units, Ridge/XGBoost selector, R²+RMSE metrics, seaborn heatmap, plotly real-vs-predicted"

requirements-completed: [REG-02]

duration: 18min
completed: 2026-04-08
---

# Phase 19 Plan 02: Regressão Açúcar — Live Data Update Summary

**Regressão Açúcar page rewritten from dadosRegSugar.xlsx to live yfinance (SB=F, USDBRL=X, CL=F) with USDA 2025 data; inputs aligned to Mt; Ridge/XGBoost with R², RMSE, heatmap, and 95% CI**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08T00:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `_USDA_ANNUAL` in `backend/regression.py` extended to 12 years (2014–2025) with safra 2024/25 USDA PSD estimates
- `_USDA_DEFAULTS` updated to reflect 2025/26 projection (estoque_inicial=48.5, producao=190.0, estoque_uso_pct=26.6)
- `pages/05_Regressão_Açúcar.py` completely rewritten — removes `dadosRegSugar.xlsx`, fetches annual closes via yfinance, displays Ridge/XGBoost prediction with R², RMSE, 95% CI, seaborn heatmap, Plotly real-vs-predicted chart and training history table

## Task Commits

1. **Task 1: Adicionar ano 2025 ao _USDA_ANNUAL e revisar defaults no backend** - `3c56102` (feat)
2. **Task 2: Atualizar página Streamlit Regressão Açúcar para dados live** - `41ea46b` (feat)

## Files Created/Modified

- `backend/regression.py` - _USDA_ANNUAL expanded to 2025; _USDA_DEFAULTS revised for 2025/26; FutureWarning fix in get_acucar_defaults()
- `pages/05_Regressão_Açúcar.py` - Full rewrite: yfinance live data, Ridge/XGBoost model, seaborn heatmap, plotly chart, Mt inputs

## Decisions Made

- Local `_USDA_ANNUAL` duplicated in Streamlit page (not imported from backend) to keep pages self-contained per project pattern — avoids adding a cross-module import to the pages directory
- Inner join on year index between yfinance annual closes and USDA data naturally excludes 2025 if yfinance lacks a full-year close — no special-case code needed
- Inputs in Mt (48.5) not legacy "milhares" (45000) — aligned with backend/regression.py and USDA PSD actual units

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed FutureWarning: float() on single-element Series in get_acucar_defaults()**
- **Found during:** Task 1 verification
- **Issue:** `float(close.iloc[-1])` raises FutureWarning in newer yfinance/pandas when Close is a multi-column DataFrame; warning indicates TypeError in future
- **Fix:** Replaced with `last = close.iloc[-1]; float(last.iloc[0]) if hasattr(last, "iloc") else float(last)` — handles both Series and scalar
- **Files modified:** backend/regression.py
- **Verification:** Verification run shows no FutureWarning after fix
- **Committed in:** 3c56102 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added MultiIndex column flattening in fetch_dados_acucar()**
- **Found during:** Task 2 implementation
- **Issue:** yfinance can return a multi-level column DataFrame (ticker x field) when downloading; Close.groupby().last() would return a DataFrame instead of Series, causing dtype errors downstream
- **Fix:** Added `if isinstance(close, pd.DataFrame): close = close.iloc[:, 0]` after groupby to ensure scalar Series
- **Files modified:** pages/05_Regressão_Açúcar.py
- **Verification:** Syntax check passes; pattern mirrors backend fix
- **Committed in:** 41ea46b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 missing critical)
**Impact on plan:** Both fixes necessary for compatibility with current yfinance API. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Regressão Açúcar page now uses live data — ready for user testing
- `_USDA_ANNUAL` will require annual update each year (next: add 2026 data)
- If yfinance SB=F annual data for 2025 becomes available, it will automatically be included via the inner join

---
*Phase: 19-atualizacao-regressoes*
*Completed: 2026-04-08*
