# Roadmap: Impacto — Plataforma Escalável

## Milestones

- ✅ **v1.0 Streamlit Audit & Fix** - Phases 1-3 (shipped 2026-03-20)
- 🚧 **v2.0 Plataforma Escalável** - Phases 1-8 (in progress)

## Phases

<!-- v1.0 Streamlit Audit & Fix (SHIPPED 2026-03-20)
  v1-Phase-1 Monte Carlo Core: Fixed simulacao_monte_carlo() signature, bounds, call site (commit 9b118d2)
  v1-Phase-2 Options Pricing: deferred (superseded by v2.0 platform)
  v1-Phase-3 Quant Audit: deferred (superseded by v2.0 platform)
-->

---

## 🚧 v2.0 Plataforma Escalável (In Progress)

**Milestone Goal:** Transform the Streamlit app into a multi-user web platform with Next.js + FastAPI + Supabase, deployed on Oracle Cloud.

## Phase Details

### Phase 1: Infra & Schema
**Goal**: The database schema is version-controlled and applied, and the Oracle Cloud VM serves HTTPS traffic through Nginx for both the Next.js frontend and FastAPI backend.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Running `supabase db push` applies all migrations with no errors and all tables and RLS policies exist in Supabase.
  2. Visiting `https://<domain>/` returns the Next.js app over HTTPS with a valid Let's Encrypt certificate.
  3. Sending a request to `https://<domain>/api/health` reaches the FastAPI process and returns a 200 response.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

### Phase 2: Auth
**Goal**: Users can log in with email and password, stay logged in across browser sessions, and be redirected to /login when unauthenticated; FastAPI validates the JWT locally without contacting Supabase.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):
  1. User submits email and password on /login and is redirected to the app dashboard.
  2. User closes the browser and reopens it; the session is still active without logging in again.
  3. User visits `/app/dashboard` without a session and is redirected to /login.
  4. FastAPI rejects a tampered JWT with 401 without making any external network call to Supabase.
  5. An admin user can reach an admin-only route; a regular user receives 403 on the same route.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

### Phase 3: Market Cache
**Goal**: Price data is served from a PostgreSQL cache so repeated queries for the same ticker and range do not call yfinance, and users can suggest new tickers for admin review.
**Depends on**: Phase 2
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04
**Success Criteria** (what must be TRUE):
  1. Fetching SB=F for a date range already in the database returns prices without a yfinance network call.
  2. Extending the range by one day causes exactly one new row to be inserted; all prior rows remain unchanged.
  3. Submitting an invalid ticker symbol returns a visible error message before anything is saved to the database.
  4. A ticker whose yfinance history starts after 2013-01-01 is backfilled from its earliest available date without error.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

### Phase 4: MC Simulation
**Goal**: Users can run a Monte Carlo simulation through the API, see the fan chart and metrics, and find past simulations in a history tab; simulations from other users are never visible.
**Depends on**: Phase 3
**Requirements**: SIM-01, SIM-02, SIM-03, SIM-04
**Success Criteria** (what must be TRUE):
  1. Clicking "Simular" renders the fan chart and summary metrics in under 15 seconds with no prior cache.
  2. The completed simulation appears in the "Histórico" tab without a page reload.
  3. Clicking a past simulation in Histórico replays the exact fan chart from saved JSONB percentiles.
  4. Logged in as User B, the simulations created by User A are not listed or accessible.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

### Phase 5: Options & Pricing
**Goal**: Users can build a multi-leg options payoff diagram, price European calls with custom volatility via Black-Scholes, and price calls via risk-neutral MC.
**Depends on**: Phase 4
**Requirements**: OPT-01, OPT-02, OPT-03
**Success Criteria** (what must be TRUE):
  1. User adds two or more option legs and the payoff diagram updates to reflect the combined strategy.
  2. User changes the volatility input and the Black-Scholes price recalculates immediately with the new value.
  3. The European call MC pricer uses the risk-free rate as drift and returns a price consistent with Black-Scholes at ATM.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

### Phase 6: Params & Watchlist
**Goal**: Users can persist per-asset simulation parameters and a personal watchlist across sessions, and the dashboard shows live prices for watched tickers.
**Depends on**: Phase 3
**Requirements**: PARAM-01, PARAM-02, PARAM-03, PARAM-04
**Success Criteria** (what must be TRUE):
  1. User sets volatility, risk-free rate, and pct_bound for SB=F; values are pre-filled when the user returns in a new session.
  2. User adds USDBRL=X to the watchlist, closes the browser, reopens it, and the ticker is still listed.
  3. User removes a ticker from the watchlist and it disappears from the dashboard immediately.
  4. The dashboard displays the current market price for each ticker in the user's watchlist.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

### Phase 7: Admin
**Goal**: Admins can review the ticker suggestion queue, approve tickers triggering automatic backfill, and reject tickers with an explanatory note.
**Depends on**: Phase 6
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04
**Success Criteria** (what must be TRUE):
  1. Admin navigates to the admin panel and sees all tickers with status "pending".
  2. Admin clicks "Aprovar" on a ticker and its status changes to "approved" in the list without a page reload.
  3. Within 60 seconds of approval the ticker's backfill_status changes from "pending" to "done".
  4. Admin clicks "Rejeitar", types a note, and the ticker status updates to "rejected" with the note visible.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

### Phase 8: CI/CD & Polish
**Goal**: Every merge to main triggers an automatic deploy to the Oracle Cloud VM, and the user's dark/light theme preference survives browser restarts.
**Depends on**: Phase 7
**Requirements**: INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Merging a PR to main causes the GitHub Actions workflow to SSH into the VM, pull, rebuild, and restart services with no manual steps.
  2. User switches to light mode, closes the browser, reopens it, and the app loads in light mode.
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Supabase migrations: 6 tables + RLS policies
- [ ] 01-02-PLAN.md — App scaffolding: Next.js frontend + FastAPI health endpoint
- [ ] 01-03-PLAN.md — Nginx config + VM bootstrap + apply migrations

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infra & Schema | 0/TBD | Not started | - |
| 2. Auth | 0/TBD | Not started | - |
| 3. Market Cache | 0/TBD | Not started | - |
| 4. MC Simulation | 0/TBD | Not started | - |
| 5. Options & Pricing | 0/TBD | Not started | - |
| 6. Params & Watchlist | 0/TBD | Not started | - |
| 7. Admin | 0/TBD | Not started | - |
| 8. CI/CD & Polish | 0/TBD | Not started | - |
