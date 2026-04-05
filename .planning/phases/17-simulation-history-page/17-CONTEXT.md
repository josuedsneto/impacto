# Phase 17: Simulation History Page - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A dedicated history page where users browse their last 50 simulations, replay any fan chart from stored percentiles without re-running the simulation, and filter by asset (Açúcar / Dólar). Creating simulations and the Monte Carlo engine are outside this phase's scope.

</domain>

<decisions>
## Implementation Decisions

### List layout
- Dense table (compact rows), not card-based layout
- Columns: Data (DD/MM/YYYY HH:MM) | Ativo (badge) | Preço Inicial | P50 | Ações
- Asset displayed as colored badge: yellow for Açúcar, green for Dólar
- Timestamp uses local date format DD/MM/YYYY HH:MM (not relative, not UTC)

### Replay experience
- Clicking a row expands inline below it — no modal, no navigation
- Only one row expanded at a time; expanding a new row closes the previous one
- Expanded view shows: fan chart (P5–P95 from stored percentiles) + parameter table (preço inicial, número de dias, número de simulações, drift, volatilidade)
- Expanded row also shows CSV download button + print button (reusing Phase 16 export patterns)

### Pagination
- Numbered pagination, 10 rows per page (up to 5 pages for 50 simulations)
- Empty state: friendly message ("Nenhuma simulação ainda") + button linking to Monte Carlo page

### Row actions
- Delete icon (trash) always visible in last "Ações" column — not hover-only
- Delete confirmation via inline popover ("Tem certeza? Sim / Cancelar") near the icon
- No other row actions beyond replay (expand) and delete

### Claude's Discretion
- Loading skeleton design for table rows while fetching
- Exact spacing, typography, and color tokens (follow existing shadcn/ui new-york/zinc patterns)
- Error state if history fetch fails (follow Phase 15 error state patterns)
- Filter control placement and style (top of table, above pagination)

</decisions>

<specifics>
## Specific Ideas

- Filter control should update the list immediately (no submit button) — from roadmap success criteria
- The fan chart replay must visually match the original run (same percentile series, no re-execution)
- Export from history row reuses the same CSV/print patterns established in Phase 16

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-simulation-history-page*
*Context gathered: 2026-04-05*
