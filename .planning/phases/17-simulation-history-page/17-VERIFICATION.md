---
phase: 17-simulation-history-page
verified: 2026-04-08T00:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 17: Simulation History Page Verification Report

**Phase Goal:** Revisar os bastidores do cálculo do Monte Carlo (drift, bounds, paths) e validar a implementação atual do VaR.
**Verified:** 2026-04-08
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Simulação GBM usa drift log-correto (mu - 0.5*sigma^2), não a média aritmética bruta | VERIFIED | `drift_gbm = media_retornos_diarios - 0.5 * desvio_padrao_retornos_diarios ** 2` at line 47; function signature accepts `drift` (not `media`) |
| 2 | Métricas exibidas após simulação são P5, P50, P95 — consistentes com fan chart | VERIFIED | `percentil_5`, `percentil_50`, `percentil_95` at lines 67–69; displayed via `col1–col3` at lines 87–89 |
| 3 | PCT_BOUND=0.50 permanece inalterado e documentado | VERIFIED | `PCT_BOUND = 0.50` at line 57; comment present |
| 4 | num_simulacoes=10000 permanece inalterado | VERIFIED | Hard-coded `10000` in call at line 66 |
| 5 | Código passa em leitura estática sem erros de importação | VERIFIED | `ast.parse()` succeeds on both files |
| 6 | Download yfinance está em cache (@st.cache_data) para evitar re-download | VERIFIED | `@st.cache_data(ttl=3600)` on `baixar_dados_var()` at line 16 of 15_VaR.py |
| 7 | Escalonamento de volatilidade usa sqrt(n_days) — correto para VaR paramétrico multi-day | VERIFIED | `data['Scaled_EWMA_Vol'] = data['EWMA_Vol'] * np.sqrt(n_days)` at line 33 |
| 8 | Label exibe EWMA vol diária (não std bruto) | VERIFIED | `"Vol. EWMA Diária"` displays `ewma_vol_final` (the last EWMA obs), not `std_returns` |
| 9 | Metodologia EWMA (lambda=0.94, RiskMetrics) documentada com comentário explícito | VERIFIED | Comment `# EWMA volatility (RiskMetrics, lambda=0.94)` at line 30 |
| 10 | Nível de confiança mapeado para left-tail: z = norm.ppf(1 - confianca/100) | VERIFIED | `z_score = norm.ppf(1 - confianca / 100)` at line 58; explicit left-tail comment at lines 56–57 |
| 11 | VaR exibido como valor positivo (perda esperada) | VERIFIED | `col1.metric("VaR (Perda Máx.)", f"{abs(VaR_EWMA):.2f}")` at line 63 |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pages/09_Monte_Carlo.py` | Monte Carlo com drift GBM correto e métricas consistentes | VERIFIED | Contains `mu - 0.5*sigma^2` drift correction; P5/P50/P95 metrics; 97 lines, substantive implementation |
| `pages/15_VaR.py` | VaR paramétrico EWMA com cache, labels corretos e z-score left-tail | VERIFIED | Contains `@st.cache_data`, `ewma_vol_final`, `abs(VaR_EWMA)`, left-tail z-score; 75 lines, substantive implementation |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `simulacao_monte_carlo()` | `np.random.normal(drift, std, ...)` | `drift = media - 0.5 * std**2` | WIRED | `drift_gbm` computed at call site (line 47), passed as `drift` argument (line 66), used inside function via `np.random.normal(drift, std, ...)` (line 27) |
| Percentis exibidos | fan chart | p5, p50, p95 métricas | WIRED | Both the fan chart traces (lines 73–77) and the metrics block (lines 67–69, 87–89) use P5/P50/P95 — consistent |
| `calcular_var()` | `VaR_EWMA` | z_score negativo * vol positiva = VaR negativo → abs() | WIRED | `VaR_EWMA = z_score * ... * current_price` (line 34); `abs(VaR_EWMA)` displayed (line 63) |
| confianca slider | z_score | `norm.ppf(1 - confianca/100)` | WIRED | `z_score = norm.ppf(1 - confianca / 100)` (line 58) reads directly from slider value |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MC-01 | 17-01-PLAN.md | Revisar drift, bounds, paths; confirmar ou corrigir | SATISFIED | `drift_gbm` correction present; `PCT_BOUND=0.50` and `num_simulacoes=10000` unchanged; P5/P50/P95 metrics aligned with fan chart |
| VAR-01 | 17-02-PLAN.md | Validar metodologia VaR: horizonte, confiança, apresentação | SATISFIED | `@st.cache_data`, EWMA lambda=0.94 documented, sqrt(n_days) scaling, left-tail z-score with comment, `abs(VaR_EWMA)` display, `ewma_vol_final` label |

---

### Anti-Patterns Found

No blockers or warnings found. No TODOs, FIXMEs, placeholder returns, or stub implementations detected in either file.

---

### Human Verification Required

No automated check gaps that require human testing. Both files are fully readable static Python — no UI behavior, real-time output, or external service calls that can't be verified statically.

Optional smoke-test (not blocking):

**Test: VaR slider produces negative z-score and positive displayed VaR**

- Test: Run `streamlit run Painel.py`, navigate to VaR page, move confidence slider to 95%, click Calcular.
- Expected: "VaR (Perda Máx.)" shows a positive number; "Z-Score" shows approximately -1.6449; "Vol. EWMA Diária" shows a small percentage.
- Why human: Verifies the Streamlit widget wiring and actual yfinance data download at runtime.

**Test: Monte Carlo fan chart matches metrics block**

- Test: Navigate to Monte Carlo page, run a simulation.
- Expected: The P5 metric value matches the lower band of the fan chart; P95 matches the upper band; P50 matches the median trace.
- Why human: The chart trace and metric are computed from the same `simulacoes` array in one execution block — visual confirmation only.

---

## Summary

Phase 17 goal is fully achieved. Both `pages/09_Monte_Carlo.py` and `pages/15_VaR.py` contain correct, substantive, and properly wired implementations:

- **MC-01 (Monte Carlo):** The GBM drift correction (`mu - 0.5*sigma^2`) is correctly computed at the call site and passed into `simulacao_monte_carlo()`. `PCT_BOUND=0.50` and `num_simulacoes=10000` are unchanged. The metrics block shows P5/P50/P95, consistent with the fan chart bands. Both files pass AST parsing.

- **VAR-01 (VaR):** The download function is wrapped in `@st.cache_data(ttl=3600)`. The EWMA methodology with `lambda=0.94` is documented. `sqrt(n_days)` scaling is used for the multi-day horizon. The z-score uses `norm.ppf(1 - confianca/100)` with an explicit left-tail comment. VaR is displayed as `abs(VaR_EWMA)`. The "Vol. EWMA Diária" label shows `ewma_vol_final`, not the raw historical std.

No anti-patterns, stubs, orphaned artifacts, or unaccounted requirements found.

---

_Verified: 2026-04-08_
_Verifier: Claude (gsd-verifier)_
