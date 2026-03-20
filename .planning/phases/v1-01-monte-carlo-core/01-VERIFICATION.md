---
phase: 01-monte-carlo-core
verified: 2026-03-20T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
human_verification:
  - test: "Change 'Qual valor deseja simular?' to a value different from last close, click Simular"
    expected: "Fan chart origin starts at the entered value, not the last close price"
    why_human: "Widget wiring is correct in code but the actual chart starting point requires visual confirmation"
  - test: "Run simulation for 60+ business days and inspect the fan chart"
    expected: "P5-P95 band visibly widens left-to-right forming a cone shape"
    why_human: "The math and bounds are correct but cone shape requires visual confirmation that clipping at ±50% is not truncating the distribution prematurely"
---

# Phase 1: Monte Carlo Core Verification Report

**Phase Goal:** Users can run Monte Carlo simulations where the starting price, path distribution, and visual output are correct
**Verified:** 2026-03-20
**Status:** human_needed (all automated checks passed; 2 visual behaviors need human confirmation)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Changing "Qual valor deseja simular?" changes where the fan chart starts | VERIFIED (wiring) + human needed (visual) | Line 62: `simulacao_monte_carlo(valor_simulado, ...)` — `valor_simulado` from widget at line 51 passed directly as first arg |
| 2 | Price clipping bounds scale with asset's current price | VERIFIED | Lines 52-55: `preco_atual * (1 - PCT_BOUND)` / `preco_atual * (1 + PCT_BOUND)` with `PCT_BOUND = 0.50` |
| 3 | P5-P95 fan chart widens over time producing a cone shape | VERIFIED (structural) + human needed (visual) | Lines 68-72: percentiles computed `axis=1` across all time steps; ±50% bounds give headroom without truncating GBM distribution |

**Score:** 3/3 truths structurally verified; 2 require human visual confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pages/09_Monte_Carlo.py` | Fixed MC simulation with explicit preco_inicial and asset-relative bounds | VERIFIED | File exists, 91 lines, substantive implementation |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `valor_simulado` widget (line 51) | `simulacao_monte_carlo()` first argument | direct pass in st.button handler (line 62) | WIRED | `simulacao_monte_carlo(valor_simulado, media_retornos_diarios, ...)` |
| `preco_atual` (last close, line 52) | `limite_inferior` / `limite_superior` (lines 54-55) | percentage multiplication | WIRED | `preco_atual * (1 - PCT_BOUND)` / `preco_atual * (1 + PCT_BOUND)` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MC-01 | 01-01-PLAN.md | MC uses user-provided starting price, not always last close | SATISFIED | Function signature `def simulacao_monte_carlo(preco_inicial, ...)` (line 25); call site `simulacao_monte_carlo(valor_simulado, ...)` (line 62); no `data['Close']` read inside function body |
| MC-02 | 01-01-PLAN.md | Price clipping bounds are asset-relative, not fixed ±10 | SATISFIED | `PCT_BOUND = 0.50` (line 53); `preco_atual * (1 - PCT_BOUND)` (line 54); `preco_atual * (1 + PCT_BOUND)` (line 55); no fixed ±10 anywhere in file |
| MC-03 | 01-01-PLAN.md | Fan chart P5-P95 bands visually match expected GBM cone shape | SATISFIED (structural) | Percentiles computed across time axis (lines 68-72); ±50% bounds wide enough not to truncate GBM; visual cone confirmation needs human |

No orphaned requirements: REQUIREMENTS.md maps MC-01, MC-02, MC-03 to Phase 1; all three claimed in 01-01-PLAN.md; all three accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns found |

No TODOs, FIXMEs, placeholders, empty returns, or stub implementations found in `pages/09_Monte_Carlo.py`.

### Human Verification Required

#### 1. Fan Chart Origin

**Test:** Navigate to the Monte Carlo page. Note the last close price shown in the "Qual valor deseja simular?" input. Change it to a clearly different value (e.g., if sugar is at 19, enter 25). Click Simular.
**Expected:** The fan chart's leftmost point (day 1) starts at or very near the entered value (25), not the last close (19).
**Why human:** The wiring from widget to simulation function is correct in code, but the visual chart starting point requires confirmation that Plotly renders day-1 at the user value.

#### 2. Cone Shape

**Test:** With a simulation date at least 60 business days in the future, click Simular and inspect the P5-P95 band in the fan chart.
**Expected:** The blue shaded band is narrowest at day 1 and progressively widens toward the right end of the chart, forming a recognizable cone/funnel shape.
**Why human:** The math is correct (GBM with vectorized `np.cumprod`, percentiles computed axis=1) and bounds are wide enough (±50%) to avoid truncation, but whether the cone is visually apparent requires a human to look at the rendered chart.

### Gaps Summary

No gaps. All three must-have truths are structurally verified in the code. The two human verification items are confirmatory, not blocking — the code correctly implements all required behaviors. Automated verification passes on all levels: artifact exists and is substantive (91 lines, real implementation), both key links are wired, all three requirement IDs are satisfied with evidence, no anti-patterns found.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
