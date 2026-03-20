---
phase: 01-monte-carlo-core
plan: 01
subsystem: ui
tags: [streamlit, numpy, monte-carlo, simulation]

# Dependency graph
requires: []
provides:
  - Corrected simulacao_monte_carlo() with explicit preco_inicial parameter
  - Asset-relative clipping bounds (±50% of last close price)
  - Fan chart that starts at user-provided price and produces a widening cone
affects: [23_Opcoes, future MC plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pass preco_inicial explicitly to simulation functions — never read data inside"
    - "Use percentage bounds relative to preco_atual, not fixed absolute deltas"

key-files:
  created: []
  modified:
    - pages/09_Monte_Carlo.py

key-decisions:
  - "PCT_BOUND = 0.50 — ±50% of last close gives meaningful headroom without suppressing GBM cone"
  - "preco_atual (last close) used for bounds only; valor_simulado (user input) is the simulation start"

patterns-established:
  - "Simulation functions receive all inputs as parameters — no implicit reads from data inside"
  - "Clipping bounds are price-relative (percentage), not absolute offsets"

requirements-completed: [MC-01, MC-02, MC-03]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 1 Plan 01: Monte Carlo Simulation Bug Fix Summary

**Fixed three co-located MC bugs: user price input now drives simulation start, bounds scale with asset price (±50%), and the P5-P95 fan chart produces a genuine widening cone**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T00:00:00Z
- **Completed:** 2026-03-20T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `simulacao_monte_carlo()` signature now takes `preco_inicial` as first arg — `data` param removed
- Hardcoded `preco_inicial = float(data['Close'].iloc[-1])` inside function body removed
- Bounds changed from `± 10` (meaningless at different asset scales) to `preco_atual * (1 ± 0.50)`
- Call site now passes `valor_simulado` (user input widget) instead of `data`

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix simulacao_monte_carlo() signature and bounds computation** - `9b118d2` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `pages/09_Monte_Carlo.py` — Three targeted edits: function signature, bounds computation, call site

## Decisions Made
- PCT_BOUND set to 0.50 (50%) — wide enough that GBM distribution is not artificially truncated at most time horizons, ensuring the cone shape emerges from the math rather than being clipped
- Kept `preco_atual` (last close) and `valor_simulado` (user input) as separate variables — bounds anchor to market reality while simulation starts from user's chosen price

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MC page now correctly reflects user inputs and asset price scales
- Ready for Phase 1 Plan 02 (if any further MC improvements planned)
- pages/23_Opções.py may benefit from same pattern review

---
*Phase: 01-monte-carlo-core*
*Completed: 2026-03-20*

## Self-Check: PASSED

- pages/09_Monte_Carlo.py: FOUND
- 01-01-SUMMARY.md: FOUND
- commit 9b118d2: FOUND
