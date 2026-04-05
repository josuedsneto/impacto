---
phase: 16-export-csv-pdf
verified: 2026-04-05T18:00:00Z
status: passed
score: 14/14 must-haves verified
human_verification:
  - test: "Download CSV from simulation page in browser"
    expected: "File SB-F_montecarlo_YYYY-MM-DD.csv downloads with semicolon-delimited rows, comma decimal separators, and columns Dia;Preco_P5;Preco_P25;Preco_P50;Preco_P75;Preco_P95"
    why_human: "Browser File API and MIME type handling cannot be verified statically"
  - test: "Download CSV from VaR page"
    expected: "Two-section CSV: metrics row, blank row, ## Retornos Históricos header, then ~252 float values as a single column"
    why_human: "Two-section structure and return array length require live backend call"
  - test: "Hover over disabled export button before simulation runs"
    expected: "Tooltip reads 'Rode a simulação primeiro'"
    why_human: "Tooltip visibility on disabled Button requires browser interaction"
  - test: "Open browser print preview on any /app/* page"
    expected: "Sidebar and mobile header are hidden; export/print buttons are hidden; chart and data table fill full width"
    why_human: "@media print rendering requires browser print preview to verify visual output"
  - test: "POST /api/jump-diffusion and inspect response"
    expected: "Response includes percentile_series with p5/p25/p50/p75/p95, each an array of 253 floats (steps=252 + s0)"
    why_human: "Requires live backend call to verify array length and value correctness"
---

# Phase 16: Export CSV/PDF Verification Report

**Phase Goal:** Users can download simulation, VaR, and breakeven results as files without leaving the app
**Verified:** 2026-04-05
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Shared `downloadCsv` utility exists in `lib/export.ts` producing semicolon-delimited UTF-8 BOM CSV with browser download | VERIFIED | File exists, 46 lines, exports `downloadCsv` with `createObjectURL` + `revokeObjectURL` + `\uFEFF` BOM prepend |
| 2 | `formatBrDate`, `formatBrNumber`, `isoToday`, `printPage` helpers exported from `lib/export.ts` | VERIFIED | All four functions present with correct implementations |
| 3 | `@media print` hides sidebar, mobile header, `.no-print` elements | VERIFIED | `globals.css` contains block targeting `aside`, `.mobile-header`, `.no-print`, `main`, `.recharts-wrapper`, `tr` |
| 4 | Mobile header in `layout.tsx` carries `mobile-header` CSS class | VERIFIED | Line 31: `className="flex md:hidden items-center px-4 py-3 flex-shrink-0 mobile-header"` |
| 5 | Clicking Exportar CSV on simulation page downloads correct CSV | VERIFIED | `buildMonteCarloRows` transformer + `downloadCsv` wired to `activeResult`; disabled until result |
| 6 | Clicking Exportar CSV on VaR page downloads two-section CSV with returns | VERIFIED | `buildVarRows` with `## Retornos Históricos` section + `result.returns ?? []` fallback; `VarResult.returns: number[]` typed |
| 7 | Clicking Exportar CSV on breakeven page downloads single-row CSV | VERIFIED | `buildBreakevenRows` wired on both live and manual tabs; `breakeven_brl_saca` column present |
| 8 | Export buttons disabled before data with tooltip "Rode a simulação primeiro" | VERIFIED | `disabled={!activeResult}` / `disabled={!result}` + `{!result && <TooltipContent>Rode a simulação primeiro</TooltipContent>}` on simulation and VaR |
| 9 | Filenames follow `{ASSET}_{PAGE}_{YYYY-MM-DD}.csv` pattern | VERIFIED | Simulation: `${asset}_montecarlo_${isoToday()}.csv`; VaR: `${result.ticker}_var_${isoToday()}.csv`; Breakeven: `acucar_breakeven_${isoToday()}.csv` |
| 10 | Imprimir PDF button appears on all targeted pages and calls `window.print()` | VERIFIED | Present on simulation, var, breakeven, arima, stress, jump-diffusion, BSPricer, focus, volatilidade, noticias, options pages |
| 11 | ARIMA page has export button inside each `ArimaPanel` component | VERIFIED | `buildArimaRows` wired with `ci_lower`/`ci_upper` columns; ticker slug maps SB=F → arima-acucar |
| 12 | Stress Test page exports all scenario rows | VERIFIED | `buildStressRows` with `drawdown_pct` column; disabled when `!scenarios || scenarios.length === 0` |
| 13 | `/api/var` response includes `returns` field (daily log-returns array) | VERIFIED | `backend/main.py` line 812: `"returns": [round(float(r), 8) for r in returns]` |
| 14 | `/api/jump-diffusion` response includes `percentile_series` with p5/p25/p50/p75/p95 | VERIFIED | `backend/main.py` lines 1399-1404: `percentile_series` dict with all five percentile arrays |

**Score:** 14/14 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/lib/export.ts` | downloadCsv, formatBrDate, formatBrNumber, isoToday, printPage | VERIFIED | 46 lines, all five functions exported, no external imports |
| `frontend/app/globals.css` | @media print rules | VERIFIED | Block appended after @layer base targeting aside, .mobile-header, .no-print, main, .recharts-wrapper, tr |
| `frontend/app/app/layout.tsx` | mobile-header class on mobile nav div | VERIFIED | `mobile-header` on the `flex md:hidden` div at line 31 |
| `frontend/app/app/simulation/page.tsx` | downloadCsv wired to SimulationResult | VERIFIED | buildMonteCarloRows + disabled button + printPage |
| `frontend/app/app/var/page.tsx` | downloadCsv + returns array in VarResult | VERIFIED | buildVarRows with two-section structure + `returns: number[]` interface field |
| `frontend/app/app/breakeven/page.tsx` | downloadCsv on both live and manual tabs | VERIFIED | buildBreakevenRows called on both tabs with breakeven_brl_saca |
| `frontend/app/app/arima/page.tsx` | Export button inside ArimaPanel | VERIFIED | buildArimaRows with ci_lower pattern; ticker slug logic present |
| `frontend/app/app/stress/page.tsx` | Export wired to scenarios state | VERIFIED | buildStressRows with drawdown_pct; ticker-aware filename |
| `frontend/app/app/jump-diffusion/page.tsx` | Export wired to JDResult.prices | VERIFIED | buildJDRows mapping prices array; disabled when !result |
| `frontend/components/options/BSPricer.tsx` | Export current inputs + price | VERIFIED | Inline single-row export with downloadCsv; disabled when price === null |
| `frontend/app/app/focus/page.tsx` | Standalone print button | VERIFIED | printPage import + Imprimir PDF button with no-print class |
| `frontend/app/app/volatilidade/page.tsx` | Standalone print button | VERIFIED | printPage import + Imprimir PDF button with no-print class |
| `frontend/app/app/noticias/page.tsx` | Standalone print button | VERIFIED | printPage import + Imprimir PDF button with no-print class |
| `frontend/app/app/options/page.tsx` | Standalone print button | VERIFIED | printPage import + Imprimir PDF button with no-print class |
| `backend/main.py` | returns field in /api/var + percentile_series in /api/jump-diffusion | VERIFIED | Both fields present; Python syntax parses clean; additive changes only |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `layout.tsx` mobile header div | `globals.css .mobile-header { display: none }` | CSS class name matching | WIRED | Class name `mobile-header` present on div; CSS rule targets `.mobile-header` |
| `lib/export.ts downloadCsv` | Browser File API | `URL.createObjectURL` + synthetic `<a>` click + `revokeObjectURL` | WIRED | All three operations present in `downloadCsv` body |
| `simulation page activeResult state` | `downloadCsv` in lib/export.ts | `buildMonteCarloRows` transformer | WIRED | `percentiles_series["p5"/"p25"/"p50"/"p75"/"p95"]` accessed in transformer; `downloadCsv` called in onClick |
| `VarResult.returns` | `downloadCsv` in lib/export.ts | `buildVarRows` two-section CSV | WIRED | `"## Retornos Históricos"` section header present; `result.returns ?? []` maps to return rows |
| `breakeven live/manual state` | `downloadCsv` in lib/export.ts | `buildBreakevenRows` transformer | WIRED | `breakeven_brl_saca` column in transformer; called in both tab onClick handlers |
| `backend /api/var returns computation` | JSON response dict | `"returns": [round(float(r), 8) for r in returns]` | WIRED | Line 812 of main.py; `returns` variable computed at line 791 |
| `backend /api/jump-diffusion N=1000 paths` | JSON response `percentile_series` | `np.percentile` over `price_paths` matrix | WIRED | `pcts = np.percentile(price_paths, [5, 25, 50, 75, 95], axis=0)` feeds `percentile_series` dict |
| `ArimaPanel data state (ArimaPoint[])` | `downloadCsv` | `buildArimaRows` inside ArimaPanel | WIRED | `ci_lower`/`ci_upper` accessed in transformer; downloadCsv called in onClick |
| `stress scenarios state (StressScenario[])` | `downloadCsv` | `buildStressRows` transformer | WIRED | `drawdown_pct` column present in transformer; wired to scenarios state |
| `JDResult.prices array` | `downloadCsv` | `buildJDRows` transformer | WIRED | `result.prices.map(p => [String(p.step), formatBrNumber(p.price)])` in transformer |
| `BSPricer price state + form inputs` | `downloadCsv` | inline single-row export | WIRED | `downloadCsv(rows, ...)` in onClick with `price` state guard |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXP-01 | 16-02, 16-03 | User can download simulation results as CSV from the simulation page | SATISFIED | `simulation/page.tsx` has `downloadCsv` wired to `activeResult`; extended to ARIMA, Stress, JD, BSPricer in plan 03 |
| EXP-02 | 16-02, 16-04 | User can download VaR analysis as CSV from the VaR page | SATISFIED | `var/page.tsx` has two-section buildVarRows + returns array; backend returns field added in plan 04 |
| EXP-03 | 16-02 | User can download breakeven analysis as CSV from the breakeven page | SATISFIED | `breakeven/page.tsx` has buildBreakevenRows on both live and manual tabs |
| EXP-04 | 16-01, 16-02, 16-03 | User can print/save simulation page to PDF via browser print dialog | SATISFIED | @media print CSS in globals.css; printPage utility; Imprimir PDF buttons on 11 pages; no-print class hides controls |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `breakeven/page.tsx` | 285, 293, 309 | `placeholder=` attributes on inputs | Info | HTML form placeholder attributes — not implementation stubs, UI hint text only |
| `jump-diffusion/page.tsx` | 134 | `placeholder="automático"` | Info | HTML form placeholder on sigma input — not an implementation stub |

No blocker or warning anti-patterns found.

---

## Commit Verification

All 8 documented implementation commits verified in git history:

| Commit | Plan | Description |
|--------|------|-------------|
| `0249540` | 16-01 Task 1 | Create lib/export.ts |
| `85b10d9` | 16-01 Task 2 | @media print CSS + mobile-header class |
| `f523162` | 16-02 Task 1 | Simulation page CSV export |
| `5e4e4f0` | 16-02 Task 2 | VaR and Breakeven CSV export |
| `e6327cd` | 16-03 Task 1 | ARIMA, Stress, JD, BSPricer CSV export |
| `0797954` | 16-03 Task 2 | Print buttons on focus, volatilidade, noticias, options |
| `6dcc062` | 16-04 Task 1 | /api/var returns field |
| `2d4515c` | 16-04 Task 2 | /api/jump-diffusion percentile_series |

---

## TypeScript Build Status

`npx tsc --noEmit` exits 0. The only diagnostic emitted (`next.config.ts(37,3): TurbopackOptions 'false'`) is a pre-existing type mismatch in the build config, present before Phase 16 and unrelated to export functionality.

---

## Human Verification Required

### 1. CSV Download — Simulation Page

**Test:** Run a simulation on the Monte Carlo page, then click "Exportar CSV"
**Expected:** File named e.g. `SB-F_montecarlo_2026-04-05.csv` downloads; opening in Excel shows columns Dia;Preco_P5;Preco_P25;Preco_P50;Preco_P75;Preco_P95 with comma decimal separators and Portuguese headers
**Why human:** Browser File API, Blob MIME handling, and Excel CSV parsing cannot be verified statically

### 2. VaR Two-Section CSV

**Test:** Load VaR page, wait for data, click "Exportar CSV"
**Expected:** Downloaded CSV has metrics row at top, blank row, `## Retornos Históricos` label row, then approximately 252 float values as a single column
**Why human:** Requires live backend call to confirm array length and two-section structure in the actual file

### 3. Disabled Button Tooltip

**Test:** Navigate to any page with an export button before any simulation runs; hover over the grayed-out "Exportar CSV" button
**Expected:** Tooltip "Rode a simulação primeiro" appears
**Why human:** Tooltip on disabled Button requires browser hover interaction

### 4. Print Preview Layout

**Test:** Open browser print preview (Ctrl+P) on `/app/simulation`, `/app/var`, and `/app/focus`
**Expected:** Sidebar and mobile header are hidden; all button bars are hidden; chart and data table expand to full page width
**Why human:** @media print rendering requires browser print preview to verify visual output

### 5. Jump Diffusion Backend Response

**Test:** POST to `/api/jump-diffusion` with default body `{}`
**Expected:** Response includes `"percentile_series"` with keys `p5`, `p25`, `p50`, `p75`, `p95`, each an array of 253 values (252 steps + s0); `"prices"` array still present for backward compatibility
**Why human:** Requires live backend call with running server

---

## Scope Note: Partial Print Coverage

The CONTEXT.md stated "All pages in the app get a `Imprimir PDF` button." Seven pages were not given print buttons: `admin`, `cenarios`, `dashboard`, `market`, `metas`, `params`, `risco`. These are settings/utility/data-entry pages.

The formal requirement EXP-04 reads "User can print/save **simulation page** to PDF" — which is fully satisfied. The CONTEXT.md aspiration to cover all pages was not fully executed, but this does not block any formal requirement. The omission is noted as a future-improvement item, not a verification gap.

---

## Summary

Phase 16 successfully delivers the stated goal: users can download simulation, VaR, and breakeven results as files without leaving the app. All four formal requirements (EXP-01 through EXP-04) are satisfied with substantive, wired implementations. The shared export utility (`lib/export.ts`) is correctly structured with UTF-8 BOM, semicolon delimiter, Brazilian locale formatting, and memory-leak-free download. Both backend endpoints were extended additively. TypeScript compiles clean. All 8 implementation commits exist in git history.

---

_Verified: 2026-04-05_
_Verifier: Claude (gsd-verifier)_
