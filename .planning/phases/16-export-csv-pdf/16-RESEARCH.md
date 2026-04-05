# Phase 16: Export CSV/PDF - Research

**Researched:** 2026-04-05
**Domain:** Client-side CSV generation + browser `@media print` layout
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scope:** 7 pages — Monte Carlo, VaR, Breakeven, ARIMA (Açúcar + Dólar), Stress Test, Jump Diffusion, Black-Scholes/Opções.

**What gets exported (per page):**
- Monte Carlo: Percentile summary — one row per day with P5, P25, P50, P75, P95 columns
- VaR: One CSV with two sections — top: VaR metrics (VaR 95%, VaR 99%, CVaR, etc.); bottom: raw historical return series used in the calculation
- Breakeven: Full breakeven grid (all rows of the strikes × scenarios matrix)
- ARIMA (Açúcar + Dólar): Forecast values + confidence intervals
- Stress Test: Full stress scenario results table
- Jump Diffusion: Percentile summary (same structure as Monte Carlo)
- Black-Scholes / Opções: Options pricing table across strikes

**Export trigger & placement:**
- Button position: Bottom of the page, after the chart/table it exports
- Button style: `⬇ Exportar CSV` (icon + label) — shadcn Button variant, outline or secondary
- Disabled state: Button is grayed out until the simulation/calculation has run; tooltip reads "Rode a simulação primeiro"
- Filename pattern: `{ASSET}_{PAGE}_{YYYY-MM-DD}.csv` — e.g. `SB-F_montecarlo-2026-04-05.csv`
  - Asset comes from the currently selected asset in the page state
  - Page slug is fixed per page (montecarlo, var, breakeven, arima-acucar, arima-dolar, stress, jump-diffusion, opcoes)

**CSV format & locale:**
- Column headers: Portuguese (e.g. `Data`, `Preco_P50`, `VaR_95`)
- Decimal separator: Comma (`,`) — Brazilian locale (e.g. `125,50`)
- Field delimiter: Semicolon (`;`) — required to avoid conflict with comma decimal
- Date format: DD/MM/YYYY (e.g. `05/04/2026`) — Brazilian standard
- Encoding: UTF-8 with BOM — ensures accented characters render correctly in Excel on Windows

**PDF print layout:**
- Scope: All pages get a `Imprimir PDF` button
- Trigger: Dedicated `🖨 Imprimir PDF` button → calls `window.print()` — browser print dialog, no server cost
- Button placement: Next to `Exportar CSV` at the bottom (or standalone if no CSV export on that page)
- Print CSS: Hides sidebar, top nav bar, and all buttons — only page title, chart, and data tables are visible
- Print content: Chart + table — the visual output plus any data table below it

**Specifics:**
- VaR export is two-section in a single file: blank row + `## Retornos Históricos` label row as separator
- Filename uses ISO date (YYYY-MM-DD) in the filename, DD/MM/YYYY inside CSV content

### Claude's Discretion
- Exact shadcn Button variant and sizing for export/print buttons
- How to handle ARIMA pages that have two assets (Açúcar and Dólar) — one button or two
- How to serialize chart SVGs for clean print output (if SVG print has issues, table-only fallback is acceptable)
- Shared export utility structure (single hook/helper vs per-page implementation)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | User can download simulation results as CSV from the simulation page | `percentiles_series: Record<string, number[]>` is already in `SimulationResult`; transpose to rows with Blob/URL download pattern |
| EXP-02 | User can download VaR analysis as CSV from the VaR page | `VarResult` interface fully mapped; two-section CSV with blank-row separator pattern |
| EXP-03 | User can download breakeven analysis as CSV from the breakeven page | `BreakevenResult` interface fully mapped; single-row export from live or manual tab |
| EXP-04 | User can print/save simulation page to PDF via browser print dialog | `@media print` CSS in `globals.css`; hide `.aside`, `.mobile-header`, `.no-print` elements |

</phase_requirements>

---

## Summary

Phase 16 is a pure client-side feature: no new API endpoints are needed. All data required for export already exists in React component state after a calculation or simulation runs. The export mechanism is the native browser File API (Blob + `URL.createObjectURL` + synthetic `<a>` click) — zero external dependencies. The PDF strategy is `@media print` CSS rules added to `globals.css` — also zero new dependencies, and explicitly required by REQUIREMENTS.md which lists `html2canvas + jsPDF` as out of scope.

The codebase uses a consistent pattern across pages: results are held in typed state variables (`SimulationResult`, `VarResult`, `StressScenario[]`, etc.). Export buttons become enabled when the relevant state variable is non-null. A single shared utility function handles CSV serialization (semicolon delimiter, comma decimal, UTF-8 BOM, DD/MM/YYYY dates) and triggers the download — this utility is called by each page with its own data-to-rows transformer.

The layout structure is well-understood: the desktop sidebar is `<aside className="hidden md:flex ...">` and the mobile header is a `<div className="flex md:hidden ...">`. Both must be hidden in `@media print`. Recharts renders SVG, which browsers print natively — no special handling is needed beyond ensuring `ResponsiveContainer` height is not `0` when `print` media fires (use explicit fallback height on the container).

**Primary recommendation:** Build one shared `downloadCsv(rows, filename)` utility + one `printPage()` utility in `lib/export.ts`, add `@media print` rules to `globals.css`, then wire up buttons per-page with page-specific data transformers.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native File API | Browser built-in | Blob + `URL.createObjectURL` for CSV download | No dependency, works in all modern browsers, no server round-trip |
| `window.print()` | Browser built-in | Opens browser print dialog | Specified by product decision; zero cost, no React 19 compatibility concerns |
| Tailwind CSS v4 | 4.x (already installed) | `print:hidden` utility for hiding elements | Already in project, no new install |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 (already installed) | `Download` and `Printer` icons for buttons | Already in project |
| shadcn Button | Already installed | Styled button for export/print triggers | Consistent with existing UI patterns |
| shadcn Tooltip | Already installed | "Rode a simulação primeiro" disabled tooltip | Already used in the project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native Blob download | `file-saver` npm package | file-saver adds no meaningful value over native API for this use case |
| `@media print` CSS | `html2canvas + jsPDF` | Explicitly OUT OF SCOPE — breaks with oklch CSS variables and Recharts SVG gradients |
| `@media print` CSS | `@react-pdf/renderer` | React 19 compatibility unverified (flagged in STATE.md); `@media print` requires no dependency |

**Installation:** No new packages required. All needed tools are already in the project.

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── lib/
│   └── export.ts              # Shared: downloadCsv(), formatBrDate(), printPage()
├── app/globals.css            # Add @media print rules here
├── app/app/simulation/page.tsx  # Add ExportButton + useExportCsv wiring
├── app/app/var/page.tsx         # Add ExportButton + useExportCsv wiring
├── app/app/breakeven/page.tsx   # Add ExportButton + useExportCsv wiring
├── app/app/arima/page.tsx       # Add ExportButton (per ticker tab)
├── app/app/stress/page.tsx      # Add ExportButton
├── app/app/jump-diffusion/page.tsx  # Add ExportButton
└── app/app/options/page.tsx     # Add ExportButton (Black-Scholes tab)
```

### Pattern 1: Shared CSV Download Utility

**What:** A pure function in `lib/export.ts` that accepts typed rows (string[][]) and a filename, builds a UTF-8 BOM CSV blob, and triggers a synthetic anchor click.
**When to use:** Every page that exports CSV calls this function with its own data transformer.

```typescript
// lib/export.ts
// Source: MDN File API + standard practice

const BOM = "\uFEFF"; // UTF-8 BOM for Excel on Windows

/** Format a JS Date or ISO string as DD/MM/YYYY for CSV content */
export function formatBrDate(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Format a number with comma as decimal separator (Brazilian locale) */
export function formatBrNumber(value: number, decimals = 4): string {
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * Build a semicolon-delimited CSV string with UTF-8 BOM and trigger download.
 * @param rows  First element is header row; rest are data rows (all strings)
 * @param filename  e.g. "SB-F_montecarlo_2026-04-05.csv"
 */
export function downloadCsv(rows: string[][], filename: string): void {
  const csv = BOM + rows.map((r) => r.join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build ISO-date suffix for filenames: YYYY-MM-DD */
export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Trigger browser print dialog */
export function printPage(): void {
  window.print();
}
```

### Pattern 2: Per-Page Data Transformer + Button Wiring

**What:** Each page holds typed result state. When non-null, the export button is enabled. The onClick callback transforms the typed state into `string[][]` rows, then calls `downloadCsv`.
**When to use:** Per page, inline in the page component or as a small local function.

```typescript
// Example: Monte Carlo page — transforms percentiles_series to rows
// percentiles_series shape: { "p5": number[], "p25": number[], "p50": number[], "p75": number[], "p95": number[] }
function buildMonteCarloRows(result: SimulationResult): string[][] {
  const header = ["Dia", "Preco_P5", "Preco_P25", "Preco_P50", "Preco_P75", "Preco_P95"];
  const { p5, p25, p50, p75, p95 } = result.percentiles_series as Record<string, number[]>;
  const days = p50.length;
  const data = Array.from({ length: days }, (_, i) => [
    String(i + 1),
    formatBrNumber(p5[i]),
    formatBrNumber(p25[i]),
    formatBrNumber(p50[i]),
    formatBrNumber(p75[i]),
    formatBrNumber(p95[i]),
  ]);
  return [header, ...data];
}
```

### Pattern 3: Export Button Component (inline usage)

**What:** A disabled-until-data Button using shadcn Tooltip for the disabled hint.
**When to use:** Bottom of every page that exports CSV. Print button sits beside it.

```tsx
// In each page component, after the result is rendered:
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Printer } from "lucide-react";
import { downloadCsv, printPage } from "@/lib/export";

// Disabled CSV button with tooltip
<Tooltip>
  <TooltipTrigger asChild>
    <span>  {/* span wrapper required so tooltip fires even when button is disabled */}
      <Button
        variant="outline"
        size="sm"
        disabled={!result}
        onClick={() => {
          if (!result) return;
          downloadCsv(buildRows(result), `SB-F_montecarlo_${isoToday()}.csv`);
        }}
      >
        <Download className="w-4 h-4 mr-1.5" />
        Exportar CSV
      </Button>
    </span>
  </TooltipTrigger>
  {!result && <TooltipContent>Rode a simulação primeiro</TooltipContent>}
</Tooltip>

{/* Print button — always enabled */}
<Button variant="outline" size="sm" onClick={printPage} className="no-print">
  <Printer className="w-4 h-4 mr-1.5" />
  Imprimir PDF
</Button>
```

### Pattern 4: `@media print` CSS in globals.css

**What:** CSS rules added to `globals.css` that hide navigation and buttons, and ensure charts render at a fixed width during print.
**When to use:** Global — applies to all app pages automatically.

```css
/* Add to globals.css — after the existing @layer base block */

@media print {
  /* Hide navigation sidebar (desktop aside) */
  aside {
    display: none !important;
  }

  /* Hide mobile header (hamburger bar) */
  .mobile-header {
    display: none !important;
  }

  /* Hide all buttons and interactive controls */
  .no-print {
    display: none !important;
  }

  /* Ensure main content fills full width without sidebar gap */
  main {
    padding: 0 !important;
  }

  /* Recharts SVG: prevent page-break inside charts */
  .recharts-wrapper {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Tables: prevent row splitting across pages */
  table {
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
```

**Note on mobile header:** The mobile header div needs a CSS class `mobile-header` added to it so `@media print` can target it. Currently it only has `flex md:hidden` Tailwind classes — add `mobile-header` as an additional class in `app/app/layout.tsx`.

### Pattern 5: VaR Two-Section CSV

**What:** Single CSV with VaR metrics section, blank separator row, then historical returns section.
**When to use:** VaR page only.

```typescript
function buildVarRows(result: VarResult): string[][] {
  const confLabel = `${(result.confidence * 100).toFixed(0)}%`;
  return [
    // Section 1: VaR metrics
    [`Ticker`, `Confianca`, `Ultimo_Preco`, `VaR_Historico_Abs`, `VaR_Historico_Pct`, `VaR_Parametrico_Abs`, `VaR_Parametrico_Pct`, `N_Observacoes`],
    [
      result.ticker,
      confLabel,
      formatBrNumber(result.last_price),
      formatBrNumber(result.var_historico_abs),
      formatBrNumber(result.var_historico_pct * 100, 2),
      formatBrNumber(result.var_parametrico_abs),
      formatBrNumber(result.var_parametrico_pct * 100, 2),
      String(result.n_observations),
    ],
    // Blank separator row
    [],
    // Section 2 header label
    [`## Retornos Históricos`],
    // Note: VarResult does NOT include the raw return series — see Open Questions
  ];
}
```

### Pattern 6: ARIMA — One Button Per Asset Tab

**What:** The ARIMA page has two tabs (Açúcar and Dólar). Each `ArimaPanel` component receives a `ticker` prop and manages its own data. Each panel gets its own export button, placed inside the panel. This is cleaner than lifting state to the parent.
**When to use:** ARIMA page only.

**Filename:** `SB-F_arima-acucar_2026-04-05.csv` / `USDBRL-X_arima-dolar_2026-04-05.csv`

### Anti-Patterns to Avoid

- **Wrapping disabled Button in TooltipTrigger without a span wrapper:** Radix Tooltip does not fire on `disabled` HTML elements. Always wrap with `<span>` as the `asChild` target.
- **Calling `URL.createObjectURL` without `revokeObjectURL`:** Creates memory leaks. Always revoke after click (synchronous in download context is fine).
- **Targeting Tailwind utility classes in `@media print` CSS:** Tailwind classes use PostCSS — use semantic class names (`no-print`, `mobile-header`) or element selectors (`aside`, `main`) for print targets, not generated class names.
- **Using `height="100%"` on `ResponsiveContainer` inside print:** When the container has no explicit height during print, Recharts renders at 0px. The workaround is ensuring the wrapping div has an explicit `h-[Npx]` class — which is already the project pattern from Phase 14.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV download trigger | Custom download component | Native `Blob` + `URL.createObjectURL` + `<a>.click()` | Single well-tested browser API; no package needed |
| Number locale formatting | Custom regex replace | `value.toFixed(N).replace(".", ",")` in the utility | Simple and explicit; `Intl.NumberFormat` risks inconsistency on edge cases |
| PDF generation | `html2canvas + jsPDF` | `window.print()` | Explicitly OUT OF SCOPE — fails with oklch CSS vars and Recharts SVG gradients |
| Print layout | Custom print server/endpoint | `@media print` CSS | Zero cost, no React 19 compatibility concerns, no infrastructure |

**Key insight:** Both CSV download and PDF printing are solved by the browser itself. The only "code" needed is a thin serialization layer and CSS rules.

---

## Common Pitfalls

### Pitfall 1: `percentiles_series` key names unknown at compile time

**What goes wrong:** `SimulationResult.percentiles_series` is typed as `Record<string, number[]>`. The actual keys (`p5`, `p25`, `p50`, `p75`, `p95`) come from the backend. If the backend adds or renames a key, the export silently produces empty columns.
**Why it happens:** The API response shape is not enforced at the frontend type level.
**How to avoid:** In `buildMonteCarloRows`, destructure with explicit fallback to empty array: `result.percentiles_series["p5"] ?? []`. Add a length guard before building rows.
**Warning signs:** CSV exported with all-empty numeric columns.

### Pitfall 2: Disabled Button tooltip not showing

**What goes wrong:** `TooltipTrigger asChild` on a `disabled` HTML button suppresses pointer events — the tooltip never fires.
**Why it happens:** `pointer-events: none` is set on disabled buttons by browsers.
**How to avoid:** Wrap with `<span>` (or `<span tabIndex={0}>` for keyboard accessibility): `<TooltipTrigger asChild><span><Button disabled ...>`. This is a documented shadcn/Radix pattern.
**Warning signs:** Hover over disabled button shows no tooltip.

### Pitfall 3: SVG chart missing in print output

**What goes wrong:** Recharts `ResponsiveContainer` with `height="100%"` collapses to 0px during print because the print layout recalculates element dimensions.
**Why it happens:** Print media triggers a reflow. Without an explicit parent height, `height="100%"` resolves to 0.
**How to avoid:** The project already uses `h-[Xpx] md:h-[Npx]` wrapper divs with `height='100%'` on `ResponsiveContainer` (established in Phase 14). Verify this is in place before relying on print output.
**Warning signs:** Blank box where chart should appear in print preview.

### Pitfall 4: UTF-8 BOM placement

**What goes wrong:** BOM prepended after other content or as a separate row produces garbage characters in Excel.
**Why it happens:** BOM must be the very first bytes of the file — before any content including whitespace.
**How to avoid:** Prepend `"\uFEFF"` to the complete CSV string, not to individual rows. In `downloadCsv`: `const csv = BOM + rows.map(...).join("\r\n")`.
**Warning signs:** First cell in Excel shows `ï»¿` or `Â` characters.

### Pitfall 5: VaR page — raw historical returns not in API response

**What goes wrong:** The CONTEXT.md specifies that the VaR CSV should include "raw historical return series used in the calculation." The current `VarResult` interface only contains aggregated metrics (var_historico_abs, var_historico_pct, etc.) — not the return series.
**Why it happens:** The VaR API endpoint returns summary data only.
**How to avoid:** See Open Questions below. Two options: (a) add a returns endpoint, or (b) export only the metrics section and omit the returns section.
**Warning signs:** Cannot build the second section of the VaR CSV at all from current API response.

### Pitfall 6: ARIMA page has two `ArimaPanel` components sharing one parent

**What goes wrong:** If the export button is placed in the parent page (not inside `ArimaPanel`), accessing the panel's `data` state requires lifting state up, which breaks the existing component structure.
**Why it happens:** Each `ArimaPanel` manages its own `data` state internally.
**How to avoid:** Place the export button inside `ArimaPanel`, where `data` is already in scope. Do not lift state.
**Warning signs:** TypeScript error trying to access `data` from parent scope.

---

## Code Examples

Verified patterns from codebase analysis:

### Current `SimulationResult.percentiles_series` shape (from SimulationForm.tsx)
```typescript
// Source: frontend/components/simulation/SimulationForm.tsx line 24
export interface SimulationResult {
  // ...
  percentiles_series: Record<string, number[]>;
  // keys are: "p5", "p25", "p50", "p75", "p95" (verified from backend logic)
}
```

### Current `VarResult` shape (from var/page.tsx)
```typescript
// Source: frontend/app/app/var/page.tsx lines 19-28
interface VarResult {
  ticker: string;
  last_price: number;
  confidence: number;
  var_historico_abs: number;
  var_historico_pct: number;
  var_parametrico_abs: number;
  var_parametrico_pct: number;
  n_observations: number;
  // NOTE: does NOT include raw return series
}
```

### Current `StressScenario` shape (from stress/page.tsx)
```typescript
// Source: frontend/app/app/stress/page.tsx lines 27-33
interface StressScenario {
  cenario: string;
  periodo_inicio: string;
  periodo_fim: string;
  drawdown_pct: number;
  preco_final: number;
}
```

### Current `ArimaPoint` shape (from arima/page.tsx)
```typescript
// Source: frontend/app/app/arima/page.tsx lines 29-35
interface ArimaPoint {
  date: string;
  value?: number;      // historical values (undefined for forecast rows)
  forecast?: number;   // forecast values (undefined for historical rows)
  ci_lower?: number;
  ci_upper?: number;
}
```

### Current `JDResult` shape (from jump-diffusion/page.tsx)
```typescript
// Source: frontend/app/app/jump-diffusion/page.tsx lines 18-24
interface JDResult {
  ticker: string;
  s0: number;
  sigma: number;
  mu: number;
  mean: number;
  prices: { step: number; price: number }[];
  // NOTE: single path only — not percentiles. Export will be step+price pairs.
}
```

### Layout structure for `@media print` targeting (from app/app/layout.tsx)
```tsx
// Source: frontend/app/app/layout.tsx
// Desktop sidebar — target with: aside { display: none }
<aside className="hidden md:flex w-56 ...">

// Mobile header — needs "mobile-header" class added, then target with:
// .mobile-header { display: none }
<div className="flex md:hidden items-center ... mobile-header">
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `html2canvas + jsPDF` for PDF export | `@media print` CSS + `window.print()` | Established in this project's REQUIREMENTS.md | Eliminates oklch/SVG gradient compatibility issues |
| `file-saver` npm package for CSV | Native Blob API + anchor click | Modern browsers (2020+) | Zero dependency, same result |

**Deprecated/outdated:**
- `html2canvas + jsPDF`: Explicitly listed as OUT OF SCOPE in REQUIREMENTS.md — breaks with oklch CSS variables and Recharts SVG gradients.

---

## Open Questions

1. **VaR CSV: raw historical returns section**
   - What we know: CONTEXT.md specifies "bottom: raw historical return series used in the calculation." The current `VarResult` API response contains only summary metrics — no return array.
   - What's unclear: Does the `/api/var` endpoint (or a related endpoint) return the return series? The VarResult interface in `var/page.tsx` does not include it.
   - Recommendation: Plan for two options — (a) if the API can return `returns: number[]`, add it to `VarResult` and use it; (b) if not, export only the metrics section and note the gap in the plan. The planner should check the FastAPI `/api/var` route definition to determine which applies.

2. **Jump Diffusion: single path vs percentiles**
   - What we know: CONTEXT.md says "Percentile summary (same structure as Monte Carlo)" but the `JDResult` interface contains `prices: { step: number; price: number }[]` — a single simulation path.
   - What's unclear: Is the backend returning a single path or percentile arrays? The interface suggests single path.
   - Recommendation: Export what is available (`step`, `price` as two columns). The planner should verify the backend `/api/jump-diffusion` response shape.

3. **Black-Scholes / Opções: which tab gets the export button**
   - What we know: The options page has three tabs: Payoff, Black-Scholes, and MC Pricer. CONTEXT.md says "Options pricing table across strikes."
   - What's unclear: Only BSPricer computes a price across strikes. MCPricer computes a single price. PayoffBuilder computes payoff vs price, not strikes table.
   - Recommendation: Place export button only on the Black-Scholes tab (BSPricer), exporting the strike sweep if it exists, or a single-row export of the current S/K/T/r/sigma/price values.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `frontend/app/app/var/page.tsx`, `simulation/page.tsx`, `breakeven/page.tsx`, `arima/page.tsx`, `stress/page.tsx`, `jump-diffusion/page.tsx`, `options/page.tsx` — verified all data shapes and state management patterns
- Codebase direct read — `frontend/app/app/layout.tsx` — verified sidebar `<aside>` and mobile header structure
- Codebase direct read — `frontend/app/globals.css` — confirmed no existing `@media print` rules
- Codebase direct read — `frontend/package.json` — confirmed stack: Next.js 16.2, React 19, shadcn, Tailwind v4, lucide-react 0.577
- REQUIREMENTS.md — confirmed `html2canvas + jsPDF` is explicitly OUT OF SCOPE

### Secondary (MEDIUM confidence)
- MDN Web Docs pattern for Blob download: `URL.createObjectURL` + anchor click is standard cross-browser pattern (2015+, no polyfill needed)
- Radix UI / shadcn known behavior: disabled buttons suppress tooltip — `<span>` wrapper workaround is widely documented in shadcn GitHub issues

### Tertiary (LOW confidence)
- Recharts SVG print behavior: based on known CSS reflow behavior and Phase 14 project decision to use explicit height wrappers. Not independently verified against Recharts 2.15 changelog.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed from package.json; no new dependencies
- Architecture: HIGH — data shapes confirmed from direct codebase read; patterns are standard browser APIs
- Pitfalls: HIGH for pitfalls 1–4 (code-verified); MEDIUM for pitfalls 5–6 (require backend verification)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack; no fast-moving dependencies involved)
