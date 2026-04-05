---
phase: 16-export-csv-pdf
plan: "02"
subsystem: ui
tags: [csv-export, print, react, nextjs, typescript, monte-carlo, var, breakeven]

# Dependency graph
requires:
  - phase: 16-01
    provides: downloadCsv, formatBrNumber, isoToday, printPage utilities in lib/export.ts
  - phase: 16-04
    provides: VaR backend endpoint returning returns array field
provides:
  - Exportar CSV button on Monte Carlo simulation page (disabled until result, Dia;P5;P25;P50;P75;P95 columns)
  - Exportar CSV button on VaR page (two-section CSV: metrics + blank row + Retornos Históricos + ~252 returns)
  - Exportar CSV button on Breakeven page live tab and manual tab (Preco_Acucar;Preco_Dolar;Fator_Conversao;Breakeven_BRL_Saca)
  - Imprimir PDF button on all three pages
affects: [16-03, export-pdf, print-css]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - buildXxxRows transformer function defined outside component, pure function string[][] → downloadCsv
    - disabled-button-in-span pattern for Tooltip on disabled Button (HTML constraint workaround)
    - no-print CSS class on all export/print controls for @media print suppression

key-files:
  created: []
  modified:
    - frontend/app/app/simulation/page.tsx
    - frontend/app/app/var/page.tsx
    - frontend/app/app/breakeven/page.tsx

key-decisions:
  - "Breakeven live tab export uses adjusted liveFatorNum (user-overridable) rather than raw live.fator_conversao — exports what is displayed"
  - "Breakeven manual tab export button renders only when manualBreakeven !== null (same condition as ResultCards) — no separate disabled state needed"
  - "VarResult interface extended with returns: number[] — field populated by plan 16-04 backend; graceful fallback via ?? [] in buildVarRows"

patterns-established:
  - "buildXxxRows transformer: pure function outside component, takes result state object, returns string[][] for downloadCsv"
  - "disabled-in-span: <TooltipProvider><Tooltip><TooltipTrigger asChild><span><Button disabled /></span></TooltipTrigger>{!result && <TooltipContent>}</Tooltip></TooltipProvider>"

requirements-completed: [EXP-01, EXP-02, EXP-03]

# Metrics
duration: 6min
completed: 2026-04-05
---

# Phase 16 Plan 02: Wire CSV Export + Print Buttons Summary

**Semicolon-delimited CSV export and window.print() wired to simulation, VaR, and breakeven pages using shared lib/export.ts utilities — disabled-until-data with Portuguese tooltip**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T15:37:49Z
- **Completed:** 2026-04-05T15:43:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Monte Carlo simulation page gains `Exportar CSV` (disabled until `SimulationResult` arrives) downloading `{ticker}_montecarlo_{YYYY-MM-DD}.csv` with columns Dia;Preco_P5;Preco_P25;Preco_P50;Preco_P75;Preco_P95
- VaR page `VarPanel` gains two-section CSV export: metrics row + blank separator + `## Retornos Históricos` header + raw returns column; `VarResult` interface extended with `returns: number[]`
- Breakeven page gains export buttons on both live tab (exports displayed values with user-overridable fator) and manual tab (renders alongside ResultCards when result is computed)
- All three pages have `Imprimir PDF` button calling `window.print()`; all export controls carry `no-print` class

## Task Commits

1. **Task 1: Add CSV + print export to Monte Carlo simulation page** — `f523162` (feat)
2. **Task 2: Add CSV + print export to VaR and Breakeven pages** — `5e4e4f0` (feat)

## Files Created/Modified

- `frontend/app/app/simulation/page.tsx` — added buildMonteCarloRows transformer + export button bar after FanChart
- `frontend/app/app/var/page.tsx` — extended VarResult interface, added buildVarRows transformer + export button bar in VarPanel
- `frontend/app/app/breakeven/page.tsx` — added buildBreakevenRows transformer + export buttons on live and manual result sections

## Decisions Made

- Breakeven live tab export uses the *displayed* `liveFatorNum` (user-overridable input) rather than raw `live.fator_conversao` — ensuring the CSV reflects exactly what appears on screen
- Breakeven manual tab export renders conditionally with ResultCards (when `manualBreakeven !== null`) rather than as a separate disabled button — avoids disabled state complexity since the result appears live as inputs change
- `VarResult.returns` typed as `number[]` with `?? []` fallback in transformer — forward-compatible if backend returns field absent in older responses

## Deviations from Plan

None — plan executed exactly as written. The only TypeScript compiler error (`next.config.ts(37,3): turbopack: false`) is pre-existing and unrelated to this plan.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- EXP-01, EXP-02, EXP-03 requirements fulfilled
- All three core data pages have fully functional export buttons
- Ready for Phase 16-03 (remaining feature pages export wiring) if planned

## Self-Check: PASSED

- FOUND: frontend/app/app/simulation/page.tsx
- FOUND: frontend/app/app/var/page.tsx
- FOUND: frontend/app/app/breakeven/page.tsx
- FOUND: .planning/phases/16-export-csv-pdf/16-02-SUMMARY.md
- FOUND commit f523162: feat(16-02) simulation page export
- FOUND commit 5e4e4f0: feat(16-02) VaR and breakeven export

---
*Phase: 16-export-csv-pdf*
*Completed: 2026-04-05*
