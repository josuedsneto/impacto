# Phase 16: Export CSV/PDF - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can download quantitative results as CSV files and print any page to PDF via the browser. This covers 7 pages: Monte Carlo, VaR, Breakeven, ARIMA (Açúcar + Dólar), Stress Test, Jump Diffusion, and Black-Scholes/Opções. Creating new data or modifying simulation parameters is out of scope.

</domain>

<decisions>
## Implementation Decisions

### What gets exported (per page)

- **Monte Carlo**: Percentile summary — one row per day with P5, P25, P50, P75, P95 columns
- **VaR**: One CSV with two sections — top: VaR metrics (VaR 95%, VaR 99%, CVaR, etc.); bottom: raw historical return series used in the calculation
- **Breakeven**: Full breakeven grid (all rows of the strikes × scenarios matrix)
- **ARIMA (Açúcar + Dólar)**: Forecast values + confidence intervals
- **Stress Test**: Full stress scenario results table
- **Jump Diffusion**: Percentile summary (same structure as Monte Carlo)
- **Black-Scholes / Opções**: Options pricing table across strikes

### Export trigger & placement

- Button position: **Bottom of the page**, after the chart/table it exports
- Button style: `⬇ Exportar CSV` (icon + label) — shadcn Button variant, outline or secondary
- Disabled state: Button is **grayed out** until the simulation/calculation has run; tooltip reads "Rode a simulação primeiro"
- Filename pattern: `{ASSET}_{PAGE}_{YYYY-MM-DD}.csv` — e.g. `SB-F_montecarlo-2026-04-05.csv`
  - Asset comes from the currently selected asset in the page state
  - Page slug is fixed per page (montecarlo, var, breakeven, arima-acucar, arima-dolar, stress, jump-diffusion, opcoes)

### CSV format & locale

- Column headers: **Portuguese** (e.g. `Data`, `Preco_P50`, `VaR_95`)
- Decimal separator: **Comma** (`,`) — Brazilian locale (e.g. `125,50`)
- Field delimiter: **Semicolon** (`;`) — required to avoid conflict with comma decimal (e.g. `Data;Preco_P50;Preco_P95`)
- Date format: **DD/MM/YYYY** (e.g. `05/04/2026`) — Brazilian standard
- Encoding: **UTF-8 with BOM** — ensures accented characters (Açúcar, Dólar) render correctly in Excel on Windows

### PDF print layout

- Scope: **All pages** in the app get a `Imprimir PDF` button
- Trigger: Dedicated `🖨 Imprimir PDF` button → calls `window.print()` — browser print dialog, no server cost
- Button placement: Next to `Exportar CSV` at the bottom of the page (or standalone if the page has no CSV export)
- Print CSS: Hides **sidebar, top nav bar, and all buttons** — only page title, chart, and data tables are visible in print output
- Print content: **Chart + table** — the visual output (fan chart, histogram, etc.) plus any data table below it

### Claude's Discretion

- Exact shadcn Button variant and sizing for export/print buttons
- How to handle ARIMA pages that have two assets (Açúcar and Dólar) — one button or two
- How to serialize chart SVGs for clean print output (if SVG print has issues, table-only fallback is acceptable)
- Shared export utility structure (single hook/helper vs per-page implementation)

</decisions>

<specifics>
## Specific Ideas

- VaR export is two-section in a single file: the separator between sections should be a blank row + a `## Retornos Históricos` label row so it's readable when opened in Excel
- Filename uses ISO date (YYYY-MM-DD) in the filename even though the CSV content uses DD/MM/YYYY — this keeps filenames sortable in the filesystem

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-export-csv-pdf*
*Context gathered: 2026-04-05*
