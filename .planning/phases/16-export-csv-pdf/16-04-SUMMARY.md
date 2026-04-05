---
phase: 16-export-csv-pdf
plan: "04"
subsystem: api
tags: [fastapi, numpy, var, jump-diffusion, monte-carlo, csv-export]

# Dependency graph
requires:
  - phase: 16-export-csv-pdf
    provides: CONTEXT.md with locked CSV export formats for VaR and Jump Diffusion
provides:
  - returns array (~252 daily log-returns) in /api/var response
  - percentile_series (p5/p25/p50/p75/p95 arrays of length steps+1) in /api/jump-diffusion response
affects: [16-02-frontend-var-export, 16-03-frontend-jump-diffusion-export]

# Tech tracking
tech-stack:
  added: []
  patterns: [additive-field-extension, vectorized-N1000-paths, percentile-series-structure]

key-files:
  created: []
  modified: [backend/main.py]

key-decisions:
  - "VaR returns rounded to 8 decimal places — sufficient precision for display while keeping JSON payload manageable"
  - "Jump Diffusion vectorized to N=1000 paths; jump magnitude loop retained for per-cell sampling (only ~25 non-zero cells per path at default lambda=0.1, steps=252)"
  - "mean in /api/jump-diffusion now computed across all 1000 final prices instead of single path — more statistically correct"
  - "prices field kept as path index 0 (not median) for backward compatibility with existing frontend consumers"

patterns-established:
  - "Additive-field-extension: add new fields to response dict without removing or renaming existing ones to preserve backward compatibility"
  - "Percentile-series structure: {p5, p25, p50, p75, p95} each as array of length steps+1 (includes s0) — matches Monte Carlo structure for consistent CSV export"

requirements-completed: [EXP-02, EXP-01]

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 16 Plan 04: VaR and Jump Diffusion Backend Extensions Summary

**VaR endpoint now returns full historical returns array; Jump Diffusion upgraded to N=1000 vectorized paths with p5/p25/p50/p75/p95 percentile series — both purely additive changes enabling CSV export**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-05T15:21:00Z
- **Completed:** 2026-04-05T15:29:51Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added `returns` array (~252 float values, rounded to 8dp) to `/api/var` response enabling the two-section CSV export format
- Replaced single-path jump-diffusion loop with vectorized N=1000 path simulation preserving backward-compatible `prices` field
- Added `percentile_series` with p5/p25/p50/p75/p95 arrays of length steps+1 to `/api/jump-diffusion` response matching Monte Carlo structure

## Task Commits

Each task was committed atomically:

1. **Task 1: Add returns field to /api/var response** - `6dcc062` (feat)
2. **Task 2: Extend /api/jump-diffusion with N=1000 paths and percentile_series** - `2d4515c` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `backend/main.py` - Added `returns` field to /api/var return dict; replaced single-path loop with vectorized N=1000 simulation and added `percentile_series` to /api/jump-diffusion return dict

## Decisions Made
- VaR `returns` rounded to 8 decimal places — sufficient for display precision while keeping payload manageable
- Jump diffusion jump magnitude sampling uses a Python loop per cell (not a 3D tensor) — with default `lambda_jumps=0.1` and `steps=252`, only ~25 non-zero cells per path, so the loop is fast enough
- `mean` in jump-diffusion response now uses all 1000 final prices (`price_paths[:, -1]`) instead of the single representative path — more statistically meaningful
- `prices` field uses path index 0 (not median path) so existing frontend code consuming integer-indexed steps continues to work without change

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 16-02 and 16-03 (frontend VaR and Jump Diffusion CSV export) can now consume the new response fields
- Both changes are purely additive — existing frontend code continues to work unchanged

---
*Phase: 16-export-csv-pdf*
*Completed: 2026-04-05*
