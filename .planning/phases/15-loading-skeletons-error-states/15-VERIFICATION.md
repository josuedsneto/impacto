---
phase: 15-regressao-acucar
verified: 2026-04-07T23:55:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
note_on_requirement_ids: >
  The task prompt specified requirement IDs REG-06, REG-07, REG-08, REG-09, REG-10.
  These IDs do NOT exist in REQUIREMENTS.md. The actual requirement IDs for Phase 15
  are ACUCAR-01 through ACUCAR-06 (as declared in PLAN frontmatter and REQUIREMENTS.md).
  All six ACUCAR-* requirements are verified below.
---

# Phase 15: Regressão Açúcar Verification Report

**Phase Goal:** Endpoint FastAPI Ridge/XGBoost com dados yfinance + defaults USDA, tabela Supabase reutilizada, e página Next.js com inputs editáveis, preço previsto com range e histórico.
**Verified:** 2026-04-07T23:55:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Requirement ID Discrepancy

The task prompt specified requirement IDs REG-06, REG-07, REG-08, REG-09, REG-10. These IDs do not appear anywhere in `.planning/REQUIREMENTS.md`. The REQUIREMENTS.md file defines Phase 15 requirements as **ACUCAR-01 through ACUCAR-06**. Both PLAN files declare `requirements: [ACUCAR-01..05]` (plan 01) and `requirements: [ACUCAR-06]` (plan 02). All six ACUCAR-* requirements are fully verified below.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/regression/acucar/run returns sb_f_previsto, sb_f_min, sb_f_max, r2, rmse | VERIFIED | `backend/main.py:190` — route defined; `regression.py:432-437` — all five keys returned |
| 2 | Endpoint accepts model='ridge' (default) or model='xgboost' | VERIFIED | `AcucarRunRequest.model: Literal["ridge","xgboost"] = "ridge"` at `main.py:292-293`; `regression.py:392-402` — xgboost/ridge branch |
| 3 | GET /api/regression/acucar/defaults returns SB=F, USDBRL=X, CL=F latest prices plus USDA demand/supply defaults | VERIFIED | `main.py:180-187`; `regression.py:285-305` — yfinance fetch for sb_f, usdbrl, cl_f + `_USDA_DEFAULTS` merged |
| 4 | Each run is persisted to regression_runs table with tipo='acucar' | VERIFIED | `main.py:215-226` — `supa.table("regression_runs").insert({..."tipo": "acucar"...})` |
| 5 | Model trains on annual yfinance data (SB=F 2014-today) plus hardcoded USDA supply/demand | VERIFIED | `regression.py:309-363` — `fetch_acucar_history()` fetches SB=F/USDBRL/CL=F annual + merges `_USDA_ANNUAL` (2014-2024, 11 rows) |
| 6 | Sidebar nav shows 'Regressão Açúcar' under Análise section | VERIFIED | `layout.tsx:34` — `{ href: "/app/regressao-acucar", label: "Regressão Açúcar" }` immediately after Regressão Dólar entry |
| 7 | Page /regressao-acucar loads with inputs pre-filled from defaults API | VERIFIED | `page.tsx:39-61` — useEffect on mount fetches `/api/regression/acucar/defaults`; `AcucarForm.tsx:63-72` — useEffect on `defaults` prop populates all 7 fields |
| 8 | User can select Ridge or XGBoost model before submitting | VERIFIED | `AcucarForm.tsx:217-227` — native `<select>` with ridge/xgboost options, bound to `modelType` state |
| 9 | After submit, page shows preço previsto SB=F with mín/máx range, R², RMSE | VERIFIED | `page.tsx:107-112` — `activeResult && <AcucarMetrics>` + `<AcucarHistoricoChart>`; `AcucarMetrics.tsx:18,29,37,45` — all four metric cards rendered |
| 10 | Histórico tab shows previous runs with sb_f_previsto and date | VERIFIED | `page.tsx:125-148` — history list renders `sb_f_previsto.toFixed(2)`, `created_at`, model, R², RMSE, range |
| 11 | Chart shows historical SB=F real vs previsto (from historico in API response) | VERIFIED | `AcucarCharts.tsx:16-44` — Plotly dual trace: `historico.map(h=>h.sb_f_real)` and `historico.map(h=>h.sb_f_previsto)`; dynamic import ssr:false |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/regression.py` | VERIFIED | Contains `_USDA_DEFAULTS`, `_USDA_ANNUAL`, `get_acucar_defaults()`, `fetch_acucar_history()`, `run_acucar_regression()` — substantive implementations, not stubs |
| `backend/main.py` | VERIFIED | Imports `run_acucar_regression, get_acucar_defaults`; `AcucarRunRequest` Pydantic model; two auth-guarded routes; Supabase insert with `tipo="acucar"` |
| `backend/requirements.txt` | VERIFIED | `xgboost>=2.0.0` present at line 16 |
| `frontend/components/regression/AcucarForm.tsx` | VERIFIED | Exports `AcucarDefaults`, `HistoricoPoint`, `AcucarResult` interfaces + default `AcucarForm`; 7-input form + model selector; real fetch to `/api/regression/acucar/run` |
| `frontend/components/regression/AcucarMetrics.tsx` | VERIFIED | Exports `AcucarMetrics`; 4-card grid with sb_f_previsto, interval, R², RMSE; imports `AcucarResult` from AcucarForm |
| `frontend/components/regression/AcucarCharts.tsx` | VERIFIED | Exports `AcucarHistoricoChart`; dual-trace Plotly chart; dynamic import with `ssr: false`; imports `AcucarResult` from AcucarForm |
| `frontend/app/app/regressao-acucar/page.tsx` | VERIFIED | Full page shell with Simular/Histórico tabs; defaults fetch on mount; lazy history load on first tab activation; all three components wired |
| `frontend/app/app/layout.tsx` | VERIFIED | Nav entry `{ href: "/app/regressao-acucar", label: "Regressão Açúcar" }` at line 34, immediately after Regressão Dólar |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/main.py` | `backend/regression.py` | `from regression import run_acucar_regression, get_acucar_defaults` | WIRED | `main.py:35` — explicit named import; both functions called at lines 186 and 206 |
| `backend/main.py` | `supabase regression_runs` | `supa.table("regression_runs").insert({..."tipo": "acucar"...})` | WIRED | `main.py:215-226` — real Supabase insert with all required fields |
| `page.tsx` | `/api/regression/acucar/defaults` | `fetch` in `useEffect` on mount | WIRED | `page.tsx:45` — `fetch(\`${API}/api/regression/acucar/defaults\`)` in `loadDefaults()` called from `useEffect([], [])` |
| `page.tsx` | `/api/regression/acucar/run` | `AcucarForm onResult` callback | WIRED | `AcucarForm.tsx:81` — `fetch(\`${API}/api/regression/acucar/run\`, ...)`; `page.tsx:104` — `onResult={setActiveResult}` wired |
| `AcucarCharts.tsx` | `AcucarResult.historico` | Plotly data mapping | WIRED | `AcucarCharts.tsx:21-30` — `result.historico.map(h => h.sb_f_real)` and `result.historico.map(h => h.sb_f_previsto)` |

---

### Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| ACUCAR-01 | 15-01 | POST /api/regression/acucar/run returns sb_f_previsto/min/max/r2/rmse | SATISFIED | `main.py:190`; `regression.py:432-437` |
| ACUCAR-02 | 15-01 | Endpoint supports Ridge (default) and XGBoost model selection | SATISFIED | `AcucarRunRequest.model: Literal["ridge","xgboost"]`; `regression.py:392-402` |
| ACUCAR-03 | 15-01 | yfinance for SB=F/USDBRL=X/CL=F defaults; USDA annual data hardcoded | SATISFIED | `regression.py:285-363` |
| ACUCAR-04 | 15-01 | GET /api/regression/acucar/defaults returns yfinance prices + USDA defaults | SATISFIED | `main.py:180-187` |
| ACUCAR-05 | 15-01 | Run persisted to regression_runs with tipo="acucar" | SATISFIED | `main.py:215-226` |
| ACUCAR-06 | 15-02 | /regressao-acucar page with editable inputs, price range, R², RMSE, chart, history tab | SATISFIED | `page.tsx`, `AcucarForm.tsx`, `AcucarMetrics.tsx`, `AcucarCharts.tsx` |

**Note on prompt IDs:** REG-06, REG-07, REG-08, REG-09, REG-10 do not exist in REQUIREMENTS.md. All Phase 15 requirements use the ACUCAR-* namespace.

---

### Anti-Patterns Found

No blockers or warnings found.

- No TODO/FIXME/placeholder comments in any of the 8 modified files
- No `return null` / `return {}` / empty implementations
- No stub handlers (form submit calls real fetch, not just `e.preventDefault()`)
- `historico` intentionally excluded from Supabase `resultado` insert (lean payload) but included in API response — documented decision, not an omission

---

### Human Verification Required

The SUMMARY documents that a human approved Task 3 (end-to-end flow verification) during plan execution. The following items were verified by the user at that time and cannot be re-checked programmatically:

1. **Visual rendering of Plotly chart**
   - Test: Navigate to /regressao-acucar, submit form, observe chart
   - Expected: Dual-trace line chart with "Real" (solid) and "Previsto" (dashed) traces labeled in Portuguese
   - Why human: Chart rendering requires browser + Plotly runtime

2. **XGBoost vs Ridge produce visibly different results**
   - Test: Submit once with Ridge, once with XGBoost, compare sb_f_previsto values
   - Expected: Different numeric outputs (11-row training set makes divergence likely)
   - Why human: Requires live yfinance data fetch to produce predictions

3. **Defaults API pre-fills all 7 input fields on page load**
   - Test: Navigate to /regressao-acucar while authenticated; observe form fields
   - Expected: All 7 fields populated with current yfinance + USDA values
   - Why human: Requires live backend + authentication session

User signed off: "APPROVED" (recorded in 15-02-SUMMARY.md, Task 3)

---

## Summary

Phase 15 goal is **fully achieved**. All 11 observable truths are verified against actual code. All 8 artifacts exist with substantive implementations (no stubs). All 5 key links are wired end-to-end. All 6 ACUCAR-* requirements are satisfied.

The phase directory name (`15-loading-skeletons-error-states`) is a vestige of the initial roadmap label — the phase was re-scoped to Regressão Açúcar. This has no impact on implementation correctness.

---

_Verified: 2026-04-07T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
