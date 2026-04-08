---
phase: 16-correcoes-pontuais
plan: 02
subsystem: ui
tags: [streamlit, breakeven, black-scholes, options-pricing, sugar-futures]

# Dependency graph
requires: []
provides:
  - Breakeven page with user-configurable fixed and variable cost inputs
  - Black-Scholes page updated to non-expired SBN26/SBV26 contracts with editable volatility
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "st.number_input for user-configurable parameters replacing hardcoded values"
    - "Expose model inputs (sigma) before action button for immediate interactivity"

key-files:
  created: []
  modified:
    - pages/12_Breakeven.py
    - pages/13_Black_Scholes.py

key-decisions:
  - "Breakeven gasto_fixo_total default set to 152723235 (sum of 88704735+43732035+20286465) to preserve previous behavior"
  - "gasto_variavel_por_unidade defaults to 0.0 — no behavioral change unless user adjusts"
  - "Black-Scholes SBK26 (expires 2026-04-30) replaced with SBN26 (2026-06-30) and SBV26 (2026-09-30)"
  - "Sigma exposed as editable input before Simular button — same volatility (0.2573) as default"
  - "Strike range widened from 16-22.25 to 14-24.25 to cover current market price of ~17-18 cents"

patterns-established:
  - "User-editable inputs placed in dedicated subheader section before variable parameter inputs"

requirements-completed:
  - BREAK-01
  - BS-01

# Metrics
duration: 15min
completed: 2026-04-07
---

# Phase 16 Plan 02: Correcoes Pontuais Summary

**Breakeven hardcoded costs replaced with configurable R$ inputs; Black-Scholes updated from expiring SBK26 to SBN26/SBV26 contracts with editable sigma field**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-07T00:00:00Z
- **Completed:** 2026-04-07T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Breakeven page now accepts "Gasto Fixo Total" (default R$ 152,723,235) and "Gasto Variavel por Unidade" (default R$ 0) as user inputs — no code edits needed to adjust costs
- Black-Scholes page fully updated: SBK26 (expires 2026-04-30) removed, SBN26.NYB (Jun 2026) and SBV26.NYB (Sep 2026) added as selectable contracts
- Volatility exposed as editable number_input before the Simular button, enabling immediate adjustment without modifying code
- Strike range widened (14 to 24.25) to keep current sugar price (~17-18 cents) within the visible table range

## Task Commits

Each task was committed atomically:

1. **Task 1: Adicionar campos de Gasto Fixo e Gasto Variavel na pagina Breakeven** - `0c67d25` (feat)
2. **Task 2: Atualizar contrato e volatilidade na pagina Black-Scholes** - `6e52266` (feat)

## Files Created/Modified
- `pages/12_Breakeven.py` - Added gasto_fixo_total and gasto_variavel_por_unidade inputs; updated custo() signature; replaced 3 hardcoded constant sums
- `pages/13_Black_Scholes.py` - Replaced SBK26 with SBN26/SBV26 contracts; moved sigma to editable input before button; widened strike range

## Decisions Made
- Default for gasto_fixo_total is 152723235.0 (exact sum of prior hardcoded values) so existing behavior is preserved out of the box
- gasto_variavel_por_unidade defaults to 0.0 — purely additive, no behavioral regression
- Kept volatility at 0.2573 as default; user can override via input
- Both SBN26 and SBV26 added for forward coverage (Jun + Sep 2026)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both pages are functional and ready for use
- Black-Scholes will remain valid through September 2026 (SBV26 expiry)
- No blockers

---
*Phase: 16-correcoes-pontuais*
*Completed: 2026-04-07*
