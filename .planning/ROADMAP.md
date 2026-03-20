# Roadmap: Impacto — Formula Audit & Fix

## Overview

Three phases correct the quantitative foundation of Impacto. Phase 1 fixes the Monte Carlo simulation engine that all simulation pages depend on. Phase 2 fixes the options pricing pages that depend on a correct MC baseline. Phase 3 audits the remaining statistical pages and documents improvement opportunities against OSS/academic benchmarks.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Monte Carlo Core** - Fix the MC simulation engine so outputs are numerically correct and user-controlled (completed 2026-03-20)
- [ ] **Phase 2: Options Pricing** - Fix options pricing pages to use financially correct drift and decouple parameters
- [ ] **Phase 3: Quant Audit** - Audit all remaining statistical pages and document findings and improvement opportunities

## Phase Details

### Phase 1: Monte Carlo Core
**Goal**: Users can run Monte Carlo simulations where the starting price, path distribution, and visual output are correct
**Depends on**: Nothing (first phase)
**Requirements**: MC-01, MC-02, MC-03
**Success Criteria** (what must be TRUE):
  1. User-provided starting price is used as the simulation's first value — changing the input changes the fan chart origin
  2. Price bounds automatically scale with the asset's current price rather than being fixed at ±10
  3. The P5–P95 fan chart widens over time in a cone shape consistent with geometric Brownian motion
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — Fix simulacao_monte_carlo() signature, bounds, and call site in 09_Monte_Carlo.py

### Phase 2: Options Pricing
**Goal**: Options pricing outputs use risk-neutral drift and correctly separated parameters so prices are financially defensible
**Depends on**: Phase 1
**Requirements**: OPT-01, OPT-02, OPT-03
**Success Criteria** (what must be TRUE):
  1. Strike range on 23_Opções.py can be set independently of the price clipping bounds without affecting each other
  2. Options MC uses risk-free rate as drift, not historical mean — the call price curve reflects risk-neutral valuation
  3. User can enter a custom volatility value on the Black-Scholes page rather than seeing a hardcoded 0.2573
**Plans**: TBD

### Phase 3: Quant Audit
**Goal**: All remaining statistical pages have been reviewed for formula correctness and a findings report documents what works, what is suspect, and what OSS/academic benchmarks suggest for future improvement
**Depends on**: Phase 2
**Requirements**: AUD-01, AUD-02, AUD-03, AUD-04, AUD-05
**Success Criteria** (what must be TRUE):
  1. ARIMA pages (20, 21) have a written finding — either confirmed correct or documented defect with recommended fix
  2. VaR page (15) has a written finding covering methodology and any formula issues
  3. Volatility (06) and Jump Diffusion (07) pages each have written findings
  4. Stress Test page (18) has a written finding
  5. A findings report exists that references at least one OSS or academic benchmark and lists prioritized improvement opportunities
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Monte Carlo Core | 1/1 | Complete    | 2026-03-20 |
| 2. Options Pricing | 0/TBD | Not started | - |
| 3. Quant Audit | 0/TBD | Not started | - |
