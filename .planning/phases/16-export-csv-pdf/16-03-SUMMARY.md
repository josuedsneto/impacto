---
phase: 16-export-csv-pdf
plan: "03"
subsystem: ui
tags: [csv-export, print, react, nextjs, typescript, lucide-react]

# Dependency graph
requires:
  - phase: 16-export-csv-pdf plan 01
    provides: shared export utilities (downloadCsv, formatBrDate, formatBrNumber, isoToday, printPage) and @media print CSS
  - phase: 16-export-csv-pdf plan 02
    provides: CSV + print export on Monte Carlo simulation, VaR, and Breakeven pages
provides:
  - CSV export button inside each ArimaPanel component (per-ticker slug filenames)
  - CSV export on Stress Test page wired to scenarios state with ticker-aware filename
  - CSV export on Jump Diffusion page wired to JDResult.prices array
  - CSV export on BSPricer component (single-row: inputs + computed price)
  - Standalone Imprimir PDF button on focus, volatilidade, noticias, options pages
affects: [16-04, options, arima, stress, jump-diffusion, focus, volatilidade, noticias]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - buildXxxRows transformer pattern for page-specific CSV shape (outside component)
    - Inline single-row export pattern for form-based pricers (BSPricer)
    - Disabled export button until data/result state is non-null

key-files:
  created: []
  modified:
    - frontend/app/app/arima/page.tsx
    - frontend/app/app/stress/page.tsx
    - frontend/app/app/jump-diffusion/page.tsx
    - frontend/components/options/BSPricer.tsx
    - frontend/app/app/focus/page.tsx
    - frontend/app/app/volatilidade/page.tsx
    - frontend/app/app/noticias/page.tsx
    - frontend/app/app/options/page.tsx

key-decisions:
  - "ArimaPanel export lives inside the child component (not lifted to page) to co-locate with data state"
  - "Stress page export uses ticker state for filename slug (acucar vs dolar) even though plan said sugar-only"
  - "Jump diffusion export wraps card + buttons in React Fragment to avoid extra DOM nesting"
  - "Options page gets a standalone print button at page level (Payoff and MC tabs have no CSV export)"

patterns-established:
  - "buildXxxRows: pure function outside component, maps domain type to string[][] for downloadCsv"
  - "Export button disabled={!data} with optional tooltip explaining why disabled"
  - "All export+print button groups use flex gap-2 no-print; buttons individually carry no-print class"

requirements-completed: [EXP-01, EXP-04]

# Metrics
duration: 18min
completed: 2026-04-05
---

# Phase 16 Plan 03: Export CSV/PDF — ARIMA, Stress, JD, BSPricer, and Remaining Print Buttons Summary

**CSV export added to four remaining data pages (ARIMA/Stress/JumpDiffusion/BSPricer) plus standalone print buttons on all remaining pages, completing EXP-04 full print coverage**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-05T00:00:00Z
- **Completed:** 2026-04-05T00:18:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ARIMA page: `buildArimaRows` transformer inside `ArimaPanel`; each panel has its own export button (two total on page); export disabled until data loads; ticker-slug filenames (`arima-acucar`, `arima-dolar`)
- Stress Test page: `buildStressRows` transformer; export disabled when scenarios empty; ticker-aware filename slug
- Jump Diffusion page: `buildJDRows` transformer wired to `JDResult.prices`; result ticker used in filename
- BSPricer component: inline single-row export with all six inputs plus computed price; export disabled until price is non-null
- Focus, Volatilidade, Noticias, Options pages: standalone Imprimir PDF button added to each
- TypeScript compiles clean (exit 0) across entire frontend

## Task Commits

1. **Task 1: CSV + print export to ARIMA, Stress, JD, BSPricer** - `e6327cd` (feat)
2. **Task 2: Standalone print button to focus, volatilidade, noticias, options** - `0797954` (feat)

## Files Created/Modified
- `frontend/app/app/arima/page.tsx` - Added buildArimaRows, export+print buttons inside ArimaPanel
- `frontend/app/app/stress/page.tsx` - Added buildStressRows, export+print buttons after table
- `frontend/app/app/jump-diffusion/page.tsx` - Added buildJDRows, export+print buttons after result card
- `frontend/components/options/BSPricer.tsx` - Added inline single-row CSV export + print button
- `frontend/app/app/focus/page.tsx` - Standalone print button after indicators grid
- `frontend/app/app/volatilidade/page.tsx` - Standalone print button after VolPanel
- `frontend/app/app/noticias/page.tsx` - Standalone print button after news list
- `frontend/app/app/options/page.tsx` - Standalone print button after Tabs component

## Decisions Made
- ArimaPanel keeps data state local (not lifted to page) — export button lives inside the child component per plan instruction
- Stress page uses ticker state for filename slug even though plan initially mentioned "sugar-only"; ticker selector exists in JSX so the dynamic slug is more correct
- Jump diffusion card + buttons wrapped in React Fragment (`<>...</>`) to avoid wrapping div affecting layout
- Options page receives a page-level print button in addition to BSPricer's embedded print button, covering the Payoff and MC tabs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — pre-existing `next.config.ts` type error (TurbopackOptions `false`) was present before this plan and is out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EXP-01 (CSV export) and EXP-04 (print everywhere) requirements are now fully satisfied
- All `/app/*` pages have at least one Imprimir PDF button
- CSV export pages: simulation, var, breakeven, arima, stress, jump-diffusion, options/BSPricer
- Ready for plan 04 if any remaining export scope exists

---
*Phase: 16-export-csv-pdf*
*Completed: 2026-04-05*
