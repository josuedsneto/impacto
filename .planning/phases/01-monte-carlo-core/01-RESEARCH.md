# Phase 1: Monte Carlo Core - Research

**Researched:** 2026-03-20
**Domain:** Numerical simulation — Geometric Brownian Motion, Streamlit state management, Plotly fan charts
**Confidence:** HIGH (all findings are from direct code inspection of the existing implementation)

## Summary

Phase 1 fixes three concrete, well-localized bugs in `pages/09_Monte_Carlo.py`. The bugs are visible in the source code without ambiguity: (1) `simulacao_monte_carlo()` ignores the user-provided starting price and always reads `data['Close'].iloc[-1]` internally, (2) price clipping bounds are computed as `last_close ± 10` — a fixed absolute offset that is meaningless at different price scales, and (3) the fan chart shape issue is a consequence of the hard clipping — clipping truncates the tails of the distribution, making the cone appear artificially flat or inverted near the bounds.

All three requirements (MC-01, MC-02, MC-03) resolve to changes in the same ~10-line block of the simulation function and the lines that call it. No new libraries are needed. The fix is surgical: pass `valor_simulado` into the simulation function, compute bounds as a percentage of current price, and verify the fan chart widens monotonically.

**Primary recommendation:** Fix `simulacao_monte_carlo()` to accept `preco_inicial` as an explicit parameter, compute bounds as `preco_atual * (1 ± pct)`, and verify the Plotly fan chart visually produces a cone shape. Three targeted edits, no new dependencies.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MC-01 | Monte Carlo simulation uses the user-provided starting price (`valor_simulado`), not always the last close | Bug confirmed at line 27: `preco_inicial = float(data['Close'].iloc[-1])` inside the function, ignoring the `valor_simulado` input from the widget |
| MC-02 | Price clipping bounds are asset-relative (percentage of current price), not a fixed ±10 | Bug confirmed at lines 53–54: `limite_inferior = float(data['Close'].iloc[-1]) - 10` and `limite_superior = float(data['Close'].iloc[-1]) + 10` |
| MC-03 | Fan chart percentile bands (P5–P95) visually match expected GBM cone shape | Consequence of MC-02: aggressive clipping collapses the tails; fixing bounds fixes the cone. Additionally, the simulation uses arithmetic returns (`np.cumprod(1 + retornos)`) which is correct GBM discretization |
</phase_requirements>

---

## Standard Stack

### Core (already in use — no new installs needed)

| Library | Version in use | Purpose | Note |
|---------|---------------|---------|------|
| numpy | current | Random sampling, percentile computation, cumprod | All simulation math |
| pandas | current | yfinance data frames, business day offsets | Data handling |
| plotly | current | Fan chart rendering via `go.Scatter` with `fill='tonexty'` | Chart output |
| streamlit | current | UI widgets, session state, `st.cache_data` | App framework |
| yfinance | current | Historical price download | Data source |

### No New Dependencies
This phase requires zero new library installations. All fixes are algorithmic changes to existing code.

---

## Architecture Patterns

### Current Structure (relevant lines)

```
pages/09_Monte_Carlo.py
├── baixar_dados_mc()          # @st.cache_data, downloads via yfinance
├── simulacao_monte_carlo()    # Pure numpy function — THE bug is here (line 27)
├── calcular_dias_uteis()      # Business day count
└── UI block
    ├── valor_simulado widget  # User input — currently ignored by simulation
    ├── limite_inferior/superior computation  # Bug: fixed ±10 (lines 53–54)
    └── Simular button → calls simulacao_monte_carlo() → Plotly chart
```

### Pattern: Fix function signature, pass value explicitly

The function already accepts all parameters from the outside except `preco_inicial`. The fix is to remove the hardcoded read inside the function and accept it as a parameter — matching the pattern already used for `media`, `std`, `dias_simulados`, etc.

**Current (broken):**
```python
def simulacao_monte_carlo(data, media, std, dias_simulados, num_simulacoes, limite_inferior, limite_superior):
    retornos = np.random.normal(media, std, (dias_simulados, num_simulacoes))
    preco_inicial = float(data['Close'].iloc[-1])  # BUG: ignores user input
    fator = np.cumprod(1 + retornos, axis=0)
    precos_simulados = np.clip(preco_inicial * fator, limite_inferior, limite_superior)
    return precos_simulados
```

**Fixed:**
```python
def simulacao_monte_carlo(preco_inicial, media, std, dias_simulados, num_simulacoes, limite_inferior, limite_superior):
    retornos = np.random.normal(media, std, (dias_simulados, num_simulacoes))
    fator = np.cumprod(1 + retornos, axis=0)
    precos_simulados = np.clip(preco_inicial * fator, limite_inferior, limite_superior)
    return precos_simulados
```

The `data` parameter can be dropped from the signature entirely once `preco_inicial` is passed from outside.

### Pattern: Asset-relative bounds as percentage of current price

**Current (broken):**
```python
limite_inferior = float(data['Close'].iloc[-1]) - 10   # meaningless for sugar at 19 vs dollar at 5.8
limite_superior = float(data['Close'].iloc[-1]) + 10
```

**Fixed:**
```python
preco_atual = float(data['Close'].iloc[-1])
PCT_BOUND = 0.50  # ±50% of current price — generous enough to not clip realistic paths
limite_inferior = preco_atual * (1 - PCT_BOUND)
limite_superior = preco_atual * (1 + PCT_BOUND)
```

The percentage should be generous (40–60%) so bounds are a safety rail for degenerate paths only, not a distribution truncator. At ±50%, sugar at 19 gives bounds [9.5, 28.5]; dollar at 5.8 gives [2.9, 8.7]. These are realistic stress limits that don't clip the central GBM distribution.

### Pattern: GBM cone verification

The fan chart already computes P5/P25/P50/P75/P95 via `np.percentile(simulacoes, q, axis=1)` and renders them with Plotly `fill='tonexty'`. The cone shape will emerge automatically once bounds are wide enough to not truncate the distribution. No chart code changes are required for MC-03 — the fix is upstream in the bounds computation.

A visual sanity check: P95 - P5 must increase monotonically with time. This can be asserted in code as `np.all(np.diff(p95 - p5) >= 0)` (approximately — small violations from random noise are acceptable, but systematic narrowing is not).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GBM path generation | Custom Euler-Maruyama loop | `np.cumprod(1 + retornos)` already in use | Vectorized, correct, fast for 10k paths |
| Percentile fan chart | Manual polygon drawing | `np.percentile(..., axis=1)` + Plotly `fill='tonexty'` already in use | Correct, readable |
| Business day counting | Manual calendar math | `pd.date_range(freq=BDay())` already in use | Handles holidays correctly |

**Key insight:** The existing implementation is architecturally sound. The bugs are parameter-passing errors and a hardcoded constant, not design flaws. Do not refactor beyond the minimal fix.

---

## Common Pitfalls

### Pitfall 1: Removing `data` from function signature breaks the call site
**What goes wrong:** If you remove `data` from `simulacao_monte_carlo()` but forget to update the `st.button` call block, you get a TypeError at runtime.
**How to avoid:** Update both the function definition and the `simulacao_monte_carlo(data, ...)` call on line 61 in the same edit.
**Warning signs:** `TypeError: simulacao_monte_carlo() got an unexpected keyword argument` or argument count mismatch.

### Pitfall 2: Bounds percentage too tight clips the GBM distribution
**What goes wrong:** A ±10% or ±20% bound will clip the tails of long simulations (60+ business days), producing a truncated distribution — same symptom as the current bug, just less severe.
**How to avoid:** Use ±40–60% as the default. Bounds are a degenerate-path safety rail, not a domain constraint.
**Warning signs:** Fan chart narrows or plateaus at the bound values for longer simulation horizons.

### Pitfall 3: `valor_simulado` session state initialized from last close — not a bug
**What goes wrong:** The session state default `st.session_state["valor_simulado_mc"] = float(data['Close'].iloc[-1])` is intentional and correct. Do not change it while fixing MC-01.
**How to avoid:** Only change the function internals and the call site. The widget initialization is correct behavior.

### Pitfall 4: `preco_atual` vs `valor_simulado` — two different concepts
**What goes wrong:** Confusing the market's last close price (used for bounds) with the user's hypothetical starting price (used for simulation paths). Fixing MC-01 requires keeping these separate.
- `preco_atual = float(data['Close'].iloc[-1])` — used for bounds (MC-02)
- `valor_simulado` — the user input, passed as `preco_inicial` to the simulation (MC-01)
**How to avoid:** Name them clearly and keep them as separate variables.

---

## Code Examples

### MC-01 + MC-02 combined fix

```python
# Source: direct analysis of pages/09_Monte_Carlo.py

def simulacao_monte_carlo(preco_inicial, media, std, dias_simulados, num_simulacoes, limite_inferior, limite_superior):
    retornos = np.random.normal(media, std, (dias_simulados, num_simulacoes))
    fator = np.cumprod(1 + retornos, axis=0)
    precos_simulados = np.clip(preco_inicial * fator, limite_inferior, limite_superior)
    return precos_simulados

# In the UI block:
preco_atual = float(data['Close'].iloc[-1])
PCT_BOUND = 0.50
limite_inferior = preco_atual * (1 - PCT_BOUND)
limite_superior = preco_atual * (1 + PCT_BOUND)

# In the button handler — pass valor_simulado, not data:
simulacoes = simulacao_monte_carlo(
    valor_simulado,
    media_retornos_diarios,
    desvio_padrao_retornos_diarios,
    dias_simulados,
    10000,
    limite_inferior,
    limite_superior
)
```

### MC-03 cone shape sanity check (optional assertion)

```python
# After computing percentiles, verify cone widens over time
spread = p95 - p5
is_widening = np.all(np.diff(spread) >= -0.01 * spread[:-1])  # 1% tolerance for noise
if not is_widening:
    st.warning("Atenção: o cone de simulação não está se alargando — verifique os limites de preço.")
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Fixed absolute bounds (±10) | Percentage-of-price bounds (±50%) | Bounds scale with asset price — meaningful for both sugar (~19) and dollar (~5.8) |
| `preco_inicial` hardcoded inside function | Pass `preco_inicial` as explicit parameter | User price input actually affects simulation output |
| Implicit tightly-clipped distribution | Wide bounds as safety rail only | GBM cone shape emerges naturally from the distribution |

---

## Open Questions

1. **What PCT_BOUND value is best for the user experience?**
   - What we know: ±50% is financially conservative (almost no asset moves 50% in 60 days under normal conditions)
   - What's unclear: Whether domain experts (sugar hedgers) have a preference for displaying wider or narrower default bounds
   - Recommendation: Use ±50% as default. The planner can expose this as a configurable constant `PCT_BOUND = 0.50` in the code for easy future adjustment.

2. **Should `config.py` ATIVOS bounds be updated too?**
   - What we know: `config.py` still has hardcoded `limite_inferior: 15, limite_superior: 35` for sugar and `4, 6` for dollar. These are used by other pages (23_Opções.py).
   - What's unclear: Whether other pages should share the same fix or be left for Phase 2.
   - Recommendation: Phase 1 fixes only `09_Monte_Carlo.py`. Leave `config.py` bounds for Phase 2 (OPT-01 scope).

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `pages/09_Monte_Carlo.py` — bugs confirmed at lines 27, 53–54, 61
- Direct code inspection of `config.py` — ATIVOS bounds structure confirmed
- `.planning/REQUIREMENTS.md` — requirement definitions confirmed

### Secondary (MEDIUM confidence)
- GBM discretization pattern (`np.cumprod(1 + returns)`) is standard arithmetic-return Monte Carlo — consistent with CLAUDE.md documentation and existing codebase patterns

---

## Metadata

**Confidence breakdown:**
- Bug locations: HIGH — confirmed by direct code inspection
- Fix approach: HIGH — minimal, surgical, matches existing code style
- PCT_BOUND value (50%): MEDIUM — financially reasonable but not validated against domain expert preference
- No chart code changes needed for MC-03: HIGH — cone shape is a consequence of bounds, not chart logic

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable domain — no external library changes affect this analysis)
