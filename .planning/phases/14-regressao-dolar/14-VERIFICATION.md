---
phase: 14-regressao-dolar
verified: 2026-04-06T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Start backend (uvicorn main:app --reload in backend/) and call GET /api/regression/dolar/defaults with a valid Bearer token"
    expected: "JSON object with keys selic, m2_bcb, prod_industrial, fed_funds, m2_fred, indpro — values should be real numbers (not all null) when FRED_API_KEY and BCB are reachable"
    why_human: "Cannot exercise live BCB SGS + FRED HTTP calls or verify FRED_API_KEY is configured in the environment"
  - test: "Call POST /api/regression/dolar/run with the default values returned above"
    expected: "JSON with keys taxa_prevista, r2, rmse, coeficientes (dict of 7 entries), correlacao (nested dict) — no 422 Dados insuficientes error"
    why_human: "OLS requires 24+ months of merged BCB+FRED+yfinance data; cannot verify live data merge without running the stack"
  - test: "Check Supabase regression_runs table after a successful POST"
    expected: "Row inserted with user_id populated, tipo='dolar', inputs and resultado JSONB non-empty"
    why_human: "Requires live Supabase instance with the migration applied"
  - test: "Visit http://localhost:3000/app/regressao-dolar while logged in"
    expected: "Page loads; inputs pre-fill with values from defaults endpoint; 'Regressão Dólar' link visible in sidebar under Análise"
    why_human: "Visual/UI verification; requires browser with running frontend and backend"
  - test: "Submit the form and verify charts render"
    expected: "Taxa Prevista, R², RMSE metric cards appear; Plotly correlation heatmap and OLS coefficients bar chart render without errors"
    why_human: "Plotly rendering is SSR-disabled (ssr: false) — requires browser to confirm no hydration errors or blank charts"
  - test: "Switch to Histórico tab after a successful run"
    expected: "The run just submitted appears as a list item showing taxa_prevista, R², RMSE, and date"
    why_human: "Requires live Supabase RLS to confirm user_id isolation is working correctly"
---

# Phase 14: Regressão Dólar Verification Report

**Phase Goal:** Endpoint FastAPI OLS com dados do BCB e FRED, tabela Supabase `regression_runs`, e página Next.js com inputs editáveis, resultados e histórico.
**Verified:** 2026-04-06
**Status:** human_needed — all automated checks passed; live API/browser checks required
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/regression/dolar/run returns { taxa_prevista, r2, rmse, coeficientes, correlacao } | VERIFIED | `regression.py:257-263` returns all 5 keys; route wired in `main.py:145` |
| 2 | GET /api/regression/dolar/defaults returns latest BCB + FRED values (6 keys) | VERIFIED | `get_dolar_defaults()` at `regression.py:114` fetches all 6 series; route at `main.py:135` |
| 3 | OLS model trains on at least 24 months of monthly historical data | VERIFIED | `fetch_dolar_history` raises `ValueError` if < 24 rows after merge (`regression.py:210-213`) |
| 4 | Each run is persisted to regression_runs with user_id, tipo='dolar', inputs JSONB, resultado JSONB | VERIFIED | `main.py:168-173` inserts all required fields using `SUPABASE_SERVICE_ROLE_KEY` |
| 5 | Page /regressao-dolar loads with inputs pre-filled from GET defaults | VERIFIED | `page.tsx:39-61` useEffect fetches defaults on mount; `DolarForm useEffect:52-60` populates inputs |
| 6 | Form calls POST /api/regression/dolar/run and displays metric cards + charts | VERIFIED | `DolarForm:69` POSTs to the run endpoint; `page.tsx:107-113` conditionally renders DolarMetrics + DolarCharts |
| 7 | Regressao Dolar link is visible in the sidebar navigation | VERIFIED | `layout.tsx:33` has `{ href: "/app/regressao-dolar", label: "Regressão Dólar" }` under Análise section |

**Score:** 7/7 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260406000001_regression_runs.sql` | regression_runs table DDL | VERIFIED | 23 lines; CREATE TABLE with all required columns, RLS enabled, SELECT + INSERT policies, tipo CHECK constraint |
| `backend/regression.py` | OLS logic + BCB/FRED data fetching | VERIFIED | 263 lines; exports `run_dolar_regression`, `get_dolar_defaults`, `fetch_dolar_history`; bcb imported lazily |
| `backend/main.py` | FastAPI route wiring for /api/regression/dolar/* | VERIFIED | All 3 routes present: GET defaults (line 135), POST run (line 145), GET runs (line 178) |
| `frontend/components/regression/DolarForm.tsx` | Editable inputs form + submit button | VERIFIED | 194 lines; exports `DolarForm` (default), `DolarResult`, `DolarDefaults` interfaces; 2-col grid layout |
| `frontend/components/regression/DolarMetrics.tsx` | Metric cards for taxa_prevista, R², RMSE | VERIFIED | 61 lines; 3 Cards + coeficientes table; imports `DolarResult` from DolarForm |
| `frontend/components/regression/DolarCharts.tsx` | Correlation heatmap + coeficientes bar chart | VERIFIED | 75 lines; named exports `CorrelationHeatmap` and `CoeficientesChart`; Plotly imported via `next/dynamic ssr:false` |
| `frontend/app/app/regressao-dolar/page.tsx` | Page shell with Simular / Histórico tabs | VERIFIED | 152 lines; Tabs with both panels; all 3 components wired; lazy history fetch on first tab switch |
| `frontend/app/app/layout.tsx` | Nav link /app/regressao-dolar under Análise section | VERIFIED | Line 33 confirmed |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/main.py` | `backend/regression.py` | `from regression import run_dolar_regression, get_dolar_defaults` | WIRED | Line 33 in main.py |
| `backend/regression.py` | BCB API (python-bcb) | `SGS()` lazy import inside functions | WIRED | `get_dolar_defaults:120`, `fetch_dolar_history:157` — lazy import pattern |
| `backend/regression.py` | FRED API (requests) | `requests.get(_FRED_BASE, ...)` with `FRED_API_KEY` | WIRED | `_fetch_fred_latest:42-67`, `_fetch_fred_history:70-111` |
| `backend/main.py` | Supabase regression_runs | `supa.table('regression_runs').insert()` | WIRED | Lines 167-174 in dolar_run route; also `regression_runs_list` at line 190 |
| `frontend/page.tsx` | GET /api/regression/dolar/defaults | `fetch` in useEffect on mount | WIRED | `page.tsx:45` |
| `frontend/page.tsx` | POST /api/regression/dolar/run | form submit handler in DolarForm | WIRED | `DolarForm.tsx:69`; `page.tsx:104` passes `onResult={setActiveResult}` |
| `frontend/DolarCharts.tsx` | Plotly | `dynamic(() => import('react-plotly.js'), { ssr: false })` | WIRED | Line 6; `react-plotly.js` and `@types/react-plotly.js` present in `frontend/package.json` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DOLAR-01 | 14-01-PLAN.md | POST /api/regression/dolar/run returns taxa_prevista, R², RMSE, coeficientes, correlacao | SATISFIED | `run_dolar_regression` returns all 5 fields; route wired in main.py |
| DOLAR-02 | 14-01-PLAN.md | Backend fetches BCB (432, 1837, 21859) and FRED (FEDFUNDS, M2SL, INDPRO) monthly series | SATISFIED | `_BCB_SERIES` and `_FRED_SERIES` dicts in regression.py; `fetch_dolar_history` merges both |
| DOLAR-03 | 14-01-PLAN.md | GET /api/regression/dolar/defaults returns latest series values | SATISFIED | `get_dolar_defaults()` and route at main.py:135 |
| DOLAR-04 | 14-01-PLAN.md | Each run persisted to regression_runs with user_id, tipo, inputs JSONB, resultado JSONB | SATISFIED | main.py:168-173; migration DDL matches schema |
| DOLAR-05 | 14-02-PLAN.md | Next.js page /regressao-dolar with editable inputs, defaults pre-fill, metrics, heatmap, coeficients bar chart, history | SATISFIED | All 4 artifacts present and fully wired; nav link confirmed |

No orphaned requirements — all 5 DOLAR-* IDs declared in plans are accounted for.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/app/app/regressao-dolar/page.tsx` | 78 | `setHistoryLoaded(true)` only inside `else` (success) branch, not in `finally` | Info | On API error the user can re-try by switching tabs away and back — this is a UX choice, not a blocker |

No stubs, no placeholder returns, no TODO/FIXME found in any phase artifact.

---

## Human Verification Required

### 1. BCB + FRED Data Fetch (Live)

**Test:** With FRED_API_KEY set in backend env, call `GET /api/regression/dolar/defaults`
**Expected:** JSON with 6 non-null values (selic ~10.5, fed_funds ~5.3, etc.)
**Why human:** Code gracefully returns `null` for any failing key — cannot distinguish API success from silent failure without live execution

### 2. OLS Regression End-to-End

**Test:** POST to `/api/regression/dolar/run` with valid float inputs for all 6 fields
**Expected:** Returns `{ taxa_prevista, r2, rmse, coeficientes (7 keys including const), correlacao (7x7 nested dict) }` — no 422
**Why human:** Requires BCB + FRED + yfinance all returning 24+ overlapping monthly rows; data availability depends on live APIs

### 3. Supabase Migration Applied

**Test:** Check Supabase dashboard for `regression_runs` table existence and RLS policies
**Expected:** Table exists with RLS enabled, two policies (SELECT + INSERT scoped to auth.uid())
**Why human:** Migration file exists but cannot verify it was applied to the live Supabase project

### 4. Page Visual Render + Sidebar Link

**Test:** Visit http://localhost:3000/app/regressao-dolar while authenticated
**Expected:** Inputs pre-filled; "Regressão Dólar" visible in sidebar under Análise
**Why human:** Visual/browser verification required

### 5. Plotly Charts Render Without SSR Errors

**Test:** Submit the regression form and inspect the Simular tab output
**Expected:** Correlation heatmap (7x7 colored grid) and bar chart (7 bars) both render in the browser without blank or error states
**Why human:** Dynamic Plotly import (ssr: false) cannot be verified server-side; requires browser execution

### 6. History Tab — RLS Isolation

**Test:** Switch to Histórico tab after a successful run
**Expected:** Only the authenticated user's runs appear (not other users' runs)
**Why human:** RLS user-isolation requires a live multi-user Supabase environment to verify correctly

---

## Gaps Summary

No gaps found. All automated checks pass:

- Migration DDL is complete and correct (CREATE TABLE, RLS, policies, CHECK constraint)
- `regression.py` is fully implemented — no stubs, all 3 functions present and substantive (263 lines)
- All 3 backend routes are wired, rate-limited, and auth-guarded
- All 4 frontend artifacts are present, substantive, and correctly wired to each other and the API
- `scikit-learn>=1.4.0` added to `backend/requirements.txt`
- `react-plotly.js` and `@types/react-plotly.js` present in `frontend/package.json`
- Nav link confirmed in `layout.tsx`
- `SUPABASE_SERVICE_ROLE_KEY` used (correct env var name, matching all other routes)

Phase goal is structurally achieved. Verification is blocked on human confirmation of live API connectivity and browser rendering.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
