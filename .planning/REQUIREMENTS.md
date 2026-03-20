# Requirements: Impacto — Formula Audit & Fix

**Defined:** 2026-03-20
**Core Value:** Correct, trustworthy simulation outputs users can rely on for hedging decisions

## v1 Requirements

### Monte Carlo

- [x] **MC-01**: Monte Carlo simulation uses the user-provided starting price (`valor_simulado`), not always the last close
- [x] **MC-02**: Price clipping bounds are asset-relative (percentage of current price), not a fixed ±10
- [x] **MC-03**: Fan chart percentile bands (P5–P95) visually match expected GBM cone shape

### Options

- [ ] **OPT-01**: 23_Opções.py decouples strike range from price clipping bounds (currently conflated)
- [ ] **OPT-02**: Options MC (23_Opções.py) uses risk-neutral drift (risk-free rate) not historical mean
- [ ] **OPT-03**: Black-Scholes page exposes volatility input so user can update it (currently hardcoded 0.2573)

### Audit

- [ ] **AUD-01**: ARIMA pages (20, 21) reviewed — documented findings of formula correctness
- [ ] **AUD-02**: VaR page (15) reviewed — documented findings
- [ ] **AUD-03**: Volatility page (06) and Jump Diffusion page (07) reviewed — documented findings
- [ ] **AUD-04**: Stress test page (18) reviewed — documented findings
- [ ] **AUD-05**: OSS/academic benchmarks surveyed and improvement opportunities documented in a findings report

## v2 Requirements

### Future improvements (not this milestone)

- **MC-V2-01**: Quasi-random (Sobol/Halton) sampling for faster convergence
- **MC-V2-02**: Antithetic variates variance reduction
- **OPT-V2-01**: Greeks calculation and display (Delta, Gamma, Vega, Theta)
- **OPT-V2-02**: Implied volatility surface from market prices
- **STAT-V2-01**: GARCH volatility model replacing constant sigma assumption

## Out of Scope

| Feature | Reason |
|---------|--------|
| UI redesign | Not this milestone — formula quality only |
| New pages | Audit existing, not expand |
| Real-time market data streaming | Beyond current architecture |
| Portfolio optimization | Separate domain, future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MC-01 | Phase 1 | Complete |
| MC-02 | Phase 1 | Complete |
| MC-03 | Phase 1 | Complete |
| OPT-01 | Phase 2 | Pending |
| OPT-02 | Phase 2 | Pending |
| OPT-03 | Phase 2 | Pending |
| AUD-01 | Phase 3 | Pending |
| AUD-02 | Phase 3 | Pending |
| AUD-03 | Phase 3 | Pending |
| AUD-04 | Phase 3 | Pending |
| AUD-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after initial definition*
