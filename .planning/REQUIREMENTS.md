# Requirements: Impacto v2.1 UX Polish & Reliability

**Defined:** 2026-04-04
**Core Value:** Simulações corretas e confiáveis, acessíveis a 20–100 usuários internos simultaneamente, com dados persistidos e autenticação robusta.

## v2.1 Requirements

### Mobile Responsiveness (MOB)

- [x] **MOB-01**: User can navigate the app on 375px viewport without horizontal scroll or overflow
- [x] **MOB-02**: Sidebar collapses to Sheet drawer triggered by hamburger icon on mobile
- [ ] **MOB-03**: All `/app/*` pages render content correctly at mobile viewport (no truncated text or charts)

### Reliability (REL)

- [x] **REL-01**: Backend returns structured JSON `{"error": "...", "code": "..."}` on all 500 responses — never raw tracebacks
- [x] **REL-02**: All backend errors are logged via loguru with request ID for correlation
- [ ] **REL-03**: User sees skeleton placeholders while data is fetching (no blank screen or "Carregando..." text)
- [ ] **REL-04**: User sees error message + retry button when any API call fails
- [ ] **REL-05**: Retry cancels the previous in-flight request (AbortController pattern)

### Export (EXP)

- [ ] **EXP-01**: User can download simulation results as CSV from the simulation page
- [ ] **EXP-02**: User can download VaR analysis as CSV from the VaR page
- [ ] **EXP-03**: User can download breakeven analysis as CSV from the breakeven page
- [ ] **EXP-04**: User can print/save simulation page to PDF via browser print dialog (`@media print` strategy)

### Simulation History (HIST)

- [ ] **HIST-01**: User can view a paginated list of their past simulations (last 50)
- [ ] **HIST-02**: User can replay a past simulation fan chart from stored percentiles (no re-run needed)
- [ ] **HIST-03**: User can filter history by asset (Açúcar / Dólar)

### Comparative Scenarios (COMP)

- [ ] **COMP-01**: User can view two simulation fan charts side by side with shared Y-axis
- [ ] **COMP-02**: User selects two simulations from history to compare
- [ ] **COMP-03**: Each comparison panel has independent loading, error, and result state

### Email Alerts (ALERT)

- [ ] **ALERT-01**: User can create a price alert (ticker + threshold + direction: above/below)
- [ ] **ALERT-02**: User receives email when tracked ticker crosses configured threshold
- [ ] **ALERT-03**: User can view and delete their active alerts
- [ ] **ALERT-04**: Alert is idempotent — user is not emailed repeatedly while price stays above threshold

### Security (SEC)

- [x] **SEC-01**: All `/api/*` endpoints that return user data enforce `user_id` isolation at query level (no cross-user data access)
- [x] **SEC-02**: Error responses never expose stack traces, SQL statements, or internal system details
- [x] **SEC-03**: All API input parameters are validated (no injection vectors in ticker names, simulation params, alert thresholds)
- [x] **SEC-04**: Rate limiting is applied to simulation and market data endpoints

### Testing (TEST)

- [ ] **TEST-01**: E2E smoke test verifies login flow completes successfully
- [ ] **TEST-02**: E2E smoke test verifies simulation submit returns fan chart
- [ ] **TEST-03**: E2E smoke test verifies CSV download triggers file
- [ ] **TEST-04**: E2E tests run automatically in GitHub Actions CI on every push to main

## Future Requirements

### v2.2+

- Real-time price updates via WebSocket — yfinance doesn't support streaming; 60s polling is sufficient for v2.1
- Bulk history export — background job with download link; rarely used in practice
- In-app push notifications — Web Push Protocol complexity disproportionate for 20-100 internal users
- Simulation reproducibility (random seed) — already out of scope; saved percentiles serve the same need
- SMS alerts — email covers 95% of use case for internal users

## Out of Scope

| Feature | Reason |
|---------|--------|
| html2canvas + jsPDF | Breaks with Recharts SVG gradients and oklch CSS variables; use `@media print` instead |
| Celery + Redis | Incompatible with Oracle Always Free single-VM constraint |
| TanStack Query / SWR | Overkill for current API surface; AbortController pattern is sufficient |
| OAuth social login | Email/password + magic link already sufficient for internal users |
| Mobile native app | Web-first; mobile-responsive web is sufficient |
| Multi-tenancy | Single company — no org isolation needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOB-01 | Phase 14 | Complete |
| MOB-02 | Phase 14 | Complete |
| MOB-03 | Phase 14 | Pending |
| REL-01 | Phase 13 | Complete |
| REL-02 | Phase 13 | Complete |
| REL-03 | Phase 15 | Pending |
| REL-04 | Phase 15 | Pending |
| REL-05 | Phase 15 | Pending |
| EXP-01 | Phase 16 | Pending |
| EXP-02 | Phase 16 | Pending |
| EXP-03 | Phase 16 | Pending |
| EXP-04 | Phase 16 | Pending |
| HIST-01 | Phase 17 | Pending |
| HIST-02 | Phase 17 | Pending |
| HIST-03 | Phase 17 | Pending |
| COMP-01 | Phase 18 | Pending |
| COMP-02 | Phase 18 | Pending |
| COMP-03 | Phase 18 | Pending |
| ALERT-01 | Phase 19 | Pending |
| ALERT-02 | Phase 19 | Pending |
| ALERT-03 | Phase 19 | Pending |
| ALERT-04 | Phase 19 | Pending |
| SEC-01 | Phase 13 | Complete |
| SEC-02 | Phase 13 | Complete |
| SEC-03 | Phase 13 | Complete |
| SEC-04 | Phase 13 | Complete |
| TEST-01 | Phase 20 | Pending |
| TEST-02 | Phase 20 | Pending |
| TEST-03 | Phase 20 | Pending |
| TEST-04 | Phase 20 | Pending |

**Coverage:**
- v2.1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after v2.1 milestone kickoff*
