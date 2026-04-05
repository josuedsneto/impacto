# Roadmap: Impacto — Plataforma Escalável

## Milestones

- ✅ **v1.0 Streamlit Audit & Fix** — Phases v1-1 to v1-3 (shipped 2026-03-20)
- ✅ **v2.0 Plataforma Escalável** — Phases 1–12 (shipped 2026-04-01)
- 🚧 **v2.1 UX Polish & Reliability** — Phases 13–20 (started 2026-04-04)

## Phases

<details>
<summary>✅ v1.0 Streamlit Audit & Fix — SHIPPED 2026-03-20</summary>

- [x] v1-Phase-1: Monte Carlo Core — Fixed simulacao_monte_carlo() signature, bounds, call site
- [x] v1-Phase-2: Options Pricing — deferred (superseded by v2.0)
- [x] v1-Phase-3: Quant Audit — deferred (superseded by v2.0)

</details>

<details>
<summary>✅ v2.0 Plataforma Escalável — SHIPPED 2026-04-01</summary>

- [x] Phase 1: Infra & Schema (3/3 plans) — completed 2026-03-20
- [x] Phase 2: Auth (3/3 plans) — completed 2026-03-20
- [x] Phase 3: Market Cache (3/3 plans) — completed 2026-03-21
- [x] Phase 4: MC Simulation (3/3 plans) — completed 2026-03-21
- [x] Phase 5: Options & Pricing (2/2 plans) — completed 2026-03-21
- [x] Phase 6: Params & Watchlist (3/3 plans) — completed 2026-03-21
- [x] Phase 7: Admin (2/2 plans) — completed 2026-03-21
- [x] Phase 8: CI/CD & Polish (1/1 plan) — completed 2026-03-22
- [x] Phase 9: Fix MKT-03 + PARAM-01 (2/2 plans) — completed 2026-03-22
- [x] Phase 10: CI/CD Artifacts + ADM-01 + FOUC Fix (3/3 plans) — completed 2026-04-01
- [x] Phase 11: Login + Auth (1/1 plan) — completed 2026-04-01
- [x] Phase 12: Feature Pages (3/3 plans) — completed 2026-04-01

Full archive: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### v2.1 UX Polish & Reliability

- [x] **Phase 13: Backend Error Handler + Security** - Structured error responses, structured logging, and security hardening across all API endpoints (completed 2026-04-04)
- [x] **Phase 14: Mobile Responsiveness** - Responsive layout shell with collapsible sidebar drawer; all pages usable at 375px (completed 2026-04-05)
- [x] **Phase 15: Loading Skeletons + Error States** - Skeleton placeholders during fetch and retry-capable error UI on all client pages (completed 2026-04-05)
- [ ] **Phase 16: Export CSV/PDF** - Download simulation, VaR, and breakeven results as CSV; print-to-PDF via browser
- [ ] **Phase 17: Simulation History Page** - Paginated history list with replay and asset filter
- [ ] **Phase 18: Comparative Scenarios** - Side-by-side fan chart comparison of two simulations with independent panel state
- [ ] **Phase 19: Email Alerts** - Configurable price threshold alerts delivered via email with idempotent trigger logic
- [ ] **Phase 20: E2E Tests** - Playwright smoke tests for login, simulation, export, and CI integration

## Phase Details

### Phase 13: Backend Error Handler + Security
**Goal**: The backend never exposes internals to clients and all API endpoints enforce user isolation and input validation
**Depends on**: Nothing (foundation for all v2.1 phases)
**Requirements**: REL-01, REL-02, SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. A deliberately triggered 500 error returns `{"error": "...", "code": "..."}` JSON — never a Python traceback
  2. Every backend error log entry contains a correlation request ID visible in both server logs and the response header
  3. An authenticated user requesting another user's simulation data receives a 403, not the data
  4. A request with a malformed ticker name (e.g., SQL injection payload) is rejected with a 422 validation error
  5. Exceeding the rate limit on the simulation endpoint returns a structured JSON 429 response, not a raw SlowAPI exception
**Plans**: 2 plans

Plans:
- [ ] 13-01-PLAN.md — loguru + RequestIDMiddleware + global exception handlers (REL-01, REL-02, SEC-01, SEC-02)
- [ ] 13-02-PLAN.md — RiscoSaveRequest validation + rate limiting backfill on 9 endpoints (SEC-03, SEC-04)

### Phase 14: Mobile Responsiveness
**Goal**: Every page of the app is fully usable on a 375px mobile viewport with no horizontal overflow
**Depends on**: Phase 13
**Requirements**: MOB-01, MOB-02, MOB-03
**Success Criteria** (what must be TRUE):
  1. On a 375px viewport, the page renders without a horizontal scrollbar on any `/app/*` route
  2. A hamburger icon is visible in the top bar on mobile; tapping it opens the navigation as a Sheet drawer
  3. All chart labels, table columns, and form inputs are fully visible at mobile viewport — no truncation or clipping
**Plans**: 3 plans

Plans:
- [ ] 14-01-PLAN.md — Layout shell: Sheet drawer + NavContent (MOB-01, MOB-02)
- [ ] 14-02-PLAN.md — Dashboard grids: inline gridTemplateColumns to responsive Tailwind classes (MOB-03)
- [ ] 14-03-PLAN.md — Per-page grids + Recharts heights + visual verification (MOB-03)

### Phase 15: Loading Skeletons + Error States
**Goal**: Users always see meaningful feedback during data fetches and can recover from API failures without a page reload
**Depends on**: Phase 13 (structured error responses required), Phase 14 (mobile shell must be correct before per-page validation)
**Requirements**: REL-03, REL-04, REL-05
**Success Criteria** (what must be TRUE):
  1. Navigating to any data-fetching page shows skeleton card placeholders — not a blank screen or "Carregando..." text — before data arrives
  2. When an API call fails, the page displays a human-readable error message and a "Tentar novamente" button
  3. Clicking "Tentar novamente" while a previous request is still in-flight cancels the previous request before starting a new one (no request stacking)
**Plans**: TBD

### Phase 16: Export CSV/PDF
**Goal**: Users can download simulation, VaR, and breakeven results as files without leaving the app
**Depends on**: Phase 15 (export buttons must handle error states correctly)
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04
**Success Criteria** (what must be TRUE):
  1. Clicking "Exportar CSV" on the simulation page triggers a browser file download containing the percentile series data
  2. Clicking "Exportar CSV" on the VaR page downloads a file with the VaR analysis results
  3. Clicking "Exportar CSV" on the breakeven page downloads a file with the breakeven analysis results
  4. Using the browser print function on the simulation page renders a clean printable layout with the fan chart visible (no blank boxes or broken styles)
**Plans**: 3 plans

Plans:
- [ ] 16-01-PLAN.md — lib/export.ts shared utilities + @media print CSS + mobile-header class (EXP-04)
- [ ] 16-02-PLAN.md — CSV + print buttons on simulation, VaR, breakeven pages (EXP-01, EXP-02, EXP-03)
- [ ] 16-03-PLAN.md — CSV + print buttons on ARIMA, stress, jump-diffusion, BSPricer + print-only buttons on remaining pages (EXP-01, EXP-04)

### Phase 17: Simulation History Page
**Goal**: Users can browse all their past simulations and replay any fan chart without re-running the simulation
**Depends on**: Phase 16 (export patterns in place before history adds its own CSV export)
**Requirements**: HIST-01, HIST-02, HIST-03
**Success Criteria** (what must be TRUE):
  1. A dedicated history page shows the user's last 50 simulations with date, asset, and key parameters visible in a paginated list
  2. Clicking any row replays the fan chart from stored percentiles — the chart matches the original run without re-executing the simulation
  3. A filter control lets users show only Açúcar or only Dólar simulations, and the list updates immediately
**Plans**: TBD

### Phase 18: Comparative Scenarios
**Goal**: Users can compare two simulation fan charts side by side with a shared Y-axis to evaluate different market scenarios
**Depends on**: Phase 17 (simulation selection comes from history page)
**Requirements**: COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. The scenarios page renders two fan chart panels side by side on desktop and stacked on mobile, sharing the same Y-axis scale
  2. Users can select which two simulations to compare by picking from their simulation history in each panel
  3. If one panel's data load fails, the other panel continues to display its result independently — neither panel blocks the other
**Plans**: TBD

### Phase 19: Email Alerts
**Goal**: Users receive a single email notification when a tracked asset's price crosses a configured threshold
**Depends on**: Phase 13 (input validation + security patterns required before adding alert CRUD endpoints)
**Requirements**: ALERT-01, ALERT-02, ALERT-03, ALERT-04
**Success Criteria** (what must be TRUE):
  1. A user can create a price alert by specifying a ticker, a threshold price, and a direction (above / below) from within the app
  2. When the tracked ticker's price crosses the configured threshold, the user receives an email notification at their registered address
  3. A user can view a list of their active alerts and delete any of them from the same page
  4. While a price stays above/below the threshold (no re-crossing), the user receives exactly one email — not repeated notifications on every polling cycle
**Plans**: TBD

### Phase 20: E2E Tests
**Goal**: Critical user flows are verified automatically on every push to main, preventing regressions in auth, simulation, and export
**Depends on**: Phase 13–19 (tests validate the complete shipped feature set)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. The Playwright login smoke test authenticates with valid credentials and confirms the dashboard is visible
  2. The simulation smoke test submits a simulation form and confirms a fan chart appears on the page
  3. The export smoke test clicks the CSV download button and confirms a file download is triggered
  4. All smoke tests run automatically in GitHub Actions on every push to main and report pass/fail on the PR check
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infra & Schema | v2.0 | 3/3 | Complete | 2026-03-20 |
| 2. Auth | v2.0 | 3/3 | Complete | 2026-03-20 |
| 3. Market Cache | v2.0 | 3/3 | Complete | 2026-03-21 |
| 4. MC Simulation | v2.0 | 3/3 | Complete | 2026-03-21 |
| 5. Options & Pricing | v2.0 | 2/2 | Complete | 2026-03-21 |
| 6. Params & Watchlist | v2.0 | 3/3 | Complete | 2026-03-21 |
| 7. Admin | v2.0 | 2/2 | Complete | 2026-03-21 |
| 8. CI/CD & Polish | v2.0 | 1/1 | Complete | 2026-03-22 |
| 9. Fix MKT-03 + PARAM-01 | v2.0 | 2/2 | Complete | 2026-03-22 |
| 10. CI/CD Artifacts + FOUC | v2.0 | 3/3 | Complete | 2026-04-01 |
| 11. Login + Auth | v2.0 | 1/1 | Complete | 2026-04-01 |
| 12. Feature Pages | v2.0 | 3/3 | Complete | 2026-04-01 |
| 13. Backend Error Handler + Security | 2/2 | Complete    | 2026-04-04 | - |
| 14. Mobile Responsiveness | 3/3 | Complete    | 2026-04-05 | - |
| 15. Loading Skeletons + Error States | 2/2 | Complete    | 2026-04-05 | - |
| 16. Export CSV/PDF | v2.1 | 0/3 | Not started | - |
| 17. Simulation History Page | v2.1 | 0/? | Not started | - |
| 18. Comparative Scenarios | v2.1 | 0/? | Not started | - |
| 19. Email Alerts | v2.1 | 0/? | Not started | - |
| 20. E2E Tests | v2.1 | 0/? | Not started | - |
