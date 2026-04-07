---
phase: 14-regressao-dolar
plan: "02"
subsystem: ui
tags: [react, next.js, plotly, supabase, regression, ols, shadcn]

# Dependency graph
requires:
  - phase: 14-regressao-dolar-01
    provides: FastAPI OLS regression backend with BCB/FRED data fetching and Supabase persistence

provides:
  - Next.js page /app/regressao-dolar with Simular and Histórico tabs
  - DolarForm component: editable inputs pre-filled from API defaults, POST to OLS backend
  - DolarMetrics component: metric cards for taxa_prevista, R², RMSE plus coeficientes table
  - DolarCharts component: Plotly correlation heatmap and OLS coefficients bar chart
  - GET /api/regression/runs backend route for history tab
  - Sidebar nav link "Regressão Dólar" under Análise section

affects: [15-regressao-acucar]

# Tech tracking
tech-stack:
  added: [react-plotly.js, plotly.js-dist-min, @types/react-plotly.js]
  patterns:
    - Dynamic Plotly import with next/dynamic (ssr: false) to avoid SSR issues
    - Lazy history fetch — deferred to first Histórico tab activation
    - DolarDefaults + DolarResult interfaces defined in DolarForm.tsx, imported by other components

key-files:
  created:
    - frontend/components/regression/DolarForm.tsx
    - frontend/components/regression/DolarMetrics.tsx
    - frontend/components/regression/DolarCharts.tsx
    - frontend/app/app/regressao-dolar/page.tsx
  modified:
    - frontend/app/app/layout.tsx
    - backend/main.py

key-decisions:
  - "react-plotly.js imported dynamically (next/dynamic ssr:false) to prevent SSR hydration mismatch with Plotly"
  - "History fetch deferred to first Histórico tab activation — avoids API call on every page load (same pattern as simulation page)"
  - "DolarForm owns DolarDefaults and DolarResult interface definitions — DolarMetrics and DolarCharts import from DolarForm to avoid duplication"

patterns-established:
  - "Regression page pattern: DolarForm (inputs + submit) + DolarMetrics (result cards) + DolarCharts (plotly) — reusable for Phase 15 (Regressão Açúcar)"
  - "Dynamic Plotly import: const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) — use for all chart components"

requirements-completed: [DOLAR-05]

# Metrics
duration: ~20min
completed: 2026-04-07
---

# Phase 14 Plan 02: Regressão Dólar Frontend Summary

**Next.js Regressão Dólar page with editable OLS inputs, Plotly correlation heatmap and coefficients bar chart, metric cards, and historical runs tab backed by Supabase**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-07
- **Completed:** 2026-04-07
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments

- Created 3 new components (DolarForm, DolarMetrics, DolarCharts) under `frontend/components/regression/`
- Created page `/app/regressao-dolar` with Simular/Histórico tabs, mirroring the simulation page pattern
- Added `GET /api/regression/runs` backend route for paginated history retrieval per user and tipo
- Added "Regressão Dólar" link to sidebar nav under Análise section
- Checkpoint human-verify approved by user

## Task Commits

Each task was committed atomically:

1. **Task 1: DolarForm, DolarMetrics, DolarCharts components** - `05fdbf3` (feat)
2. **Task 2: Page /app/regressao-dolar + nav link + backend history route** - `b9729ec` (feat)
3. **Task 3: Checkpoint human-verify** - (approved, no code commit)

## Files Created/Modified

- `frontend/components/regression/DolarForm.tsx` - Editable 6-input form with 2-column grid, populates from defaults, POSTs to OLS backend
- `frontend/components/regression/DolarMetrics.tsx` - Metric cards for taxa_prevista, R², RMSE + coeficientes table
- `frontend/components/regression/DolarCharts.tsx` - CorrelationHeatmap (Plotly heatmap) and CoeficientesChart (Plotly bar) via dynamic import
- `frontend/app/app/regressao-dolar/page.tsx` - Page shell with Simular/Histórico tabs, defaults fetch on mount, lazy history fetch
- `frontend/app/app/layout.tsx` - Added "Regressão Dólar" nav link under Análise section
- `backend/main.py` - Added GET /api/regression/runs route for history tab

## Decisions Made

- react-plotly.js imported dynamically (next/dynamic ssr:false) to prevent SSR hydration mismatch with Plotly
- History fetch deferred to first Histórico tab activation — avoids API call on every page load (same pattern as simulation page)
- DolarForm owns DolarDefaults and DolarResult interface definitions — DolarMetrics and DolarCharts import from DolarForm to avoid duplication

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required beyond what Phase 14-01 already set up (FRED_API_KEY, SUPABASE_SERVICE_ROLE_KEY).

## Next Phase Readiness

- Regressão Dólar frontend fully wired to backend; ready for Phase 15 (Regressão Açúcar)
- Component pattern (DolarForm/DolarMetrics/DolarCharts) can be replicated for AçúcarForm/AçúcarMetrics/AçúcarCharts in Phase 15
- GET /api/regression/runs route already supports tipo='acucar' — no backend changes needed for Phase 15 history tab

---
*Phase: 14-regressao-dolar*
*Completed: 2026-04-07*
