---
phase: 19-atualizacao-regressoes
plan: "01"
subsystem: ui
tags: [streamlit, bcb, fred, yfinance, ols, regression, dolar]

requires:
  - phase: 15-regressao-acucar
    provides: backend/regression.py with BCB+FRED fetch infrastructure

provides:
  - pages/04_Regressão_Dólar.py rewritten to fetch live data from BCB SGS + FRED + yfinance
  - backend/regression.py with 72-month default window and 120-day lookback for defaults

affects: [pages/04_Regressão_Dólar.py, backend/regression.py]

tech-stack:
  added: []
  patterns:
    - "st.cache_data(ttl=3600) on data fetch functions in Streamlit pages"
    - "Graceful degradation: model runs without FRED_API_KEY using BCB + yfinance only"
    - "obter_defaults_atuais() pre-fills inputs from live BCB data with fallback hardcoded values"

key-files:
  created: []
  modified:
    - pages/04_Regressão_Dólar.py
    - backend/regression.py

key-decisions:
  - "FRED_API_KEY sourced from st.secrets.get() in Streamlit page; model degrades gracefully without it"
  - "feature_cols filtered to only present columns so model works with BCB-only data (no FRED)"
  - "obter_defaults_atuais() uses 120-day lookback matching backend get_dolar_defaults() convention"

patterns-established:
  - "Streamlit pages fetch live data directly (BCB SGS lazy import inside functions) matching utils.py pattern"

requirements-completed: [REG-01]

duration: 2min
completed: "2026-04-08"
---

# Phase 19 Plan 01: Regressão Dólar — Live Data Migration Summary

**OLS USD/BRL regression page migrated from static dadosReg.xls to live BCB SGS + FRED + yfinance with 72-month training window, graceful FRED degradation, and auto-filled inputs from current indicator values**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-08T20:00:23Z
- **Completed:** 2026-04-08T20:01:56Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed all dependency on `dadosReg.xls` from `pages/04_Regressão_Dólar.py`
- Page now fetches live BCB SGS (selic/M2/ProdInd), FRED (FedFunds/M2SL/INDPRO), and USDBRL=X via yfinance
- Backend `fetch_dolar_history` extended to 72-month default; `get_dolar_defaults` lookback extended to 120 days
- Model displays: predicted rate, R², RMSE, observation count, correlation heatmap, real vs predicted chart, OLS coefficients table

## Task Commits

1. **Task 1: Revisar janela temporal e defaults do backend dólar** - `80c731c` (feat)
2. **Task 2: Atualizar página Streamlit Regressão Dólar para dados live** - `62cb005` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/regression.py` — fetch_dolar_history default 60→72 months; get_dolar_defaults lookback 90→120 days; comment added; run_dolar_regression updated to months=72
- `pages/04_Regressão_Dólar.py` — full rewrite: removed xls load, added fetch_dados_dolar() + obter_defaults_atuais(), OLS with dynamic feature_cols, heatmap + plotly chart + coefficients table

## Decisions Made

- FRED_API_KEY fetched via `st.secrets.get("FRED_API_KEY", "")` — absent key triggers `st.info` message and model trains on BCB + yfinance only (no crash)
- `feature_cols` filtered at model time: `[c for c in _FEATURE_COLS if c in df.columns]` — enables full graceful degradation
- `obter_defaults_atuais()` uses 120-day lookback, mirroring the backend convention established in Task 1

## Deviations from Plan

None — plan executed exactly as written. Backend changes (Task 1) were already partially applied in the working tree from a prior session; the diff confirmed all required changes were present and the commit captured them cleanly.

## Issues Encountered

None.

## User Setup Required

Optional: add `FRED_API_KEY = "..."` to `.streamlit/secrets.toml` to enable FRED variables (FedFunds, M2SL, INDPRO) in the model. Without it, the model trains on BCB + yfinance data only.

## Next Phase Readiness

- Regressão Dólar page fully updated and ready for use
- Same pattern (live BCB + FRED fetch, graceful degradation) can be applied to other regression pages if needed

---
*Phase: 19-atualizacao-regressoes*
*Completed: 2026-04-08*
