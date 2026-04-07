# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Correct, trustworthy simulation outputs accessible to 20-100 internal users simultaneously, with persisted data and robust authentication.
**Current focus:** Phase 15 — Regressão Açúcar (v2.1 Client Necessities)

## Current Position

Milestone: v2.1 — Client Necessities
Phase: 15-regressao-acucar (IN PROGRESS)
Plan: 15-01 (COMPLETE) — 15-02 (COMPLETE, awaiting Task 3 human-verify)
Status: Frontend done (/regressao-acucar page + AcucarForm/Metrics/Charts components + nav link); checkpoint Task 3 awaiting user verification
Last activity: 2026-04-07 — 15-02 tasks 1+2 complete, checkpoint reached

Progress: [████████░░░░] 67% (2/3 phases)

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0)
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-infra-schema | 3 | ~60 min | ~20 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~10 min)
- Trend: -

*Updated after each plan completion*
| Phase 02-auth P01 | 8 | 2 tasks | 5 files |
| Phase 02-auth P03 | 20 | 2 tasks | 3 files |
| Phase 03-market-cache P01 | 5 | 1 tasks | 1 files |
| Phase 03-market-cache P02 | 5 | 1 tasks | 1 files |
| Phase 03-market-cache P03 | 15 | 3 tasks | 3 files |
| Phase 04-mc-simulation P01 | 8 | 2 tasks | 2 files |
| Phase 04-mc-simulation P02 | 8 | 2 tasks | 6 files |
| Phase 04-mc-simulation P03 | 8 | 1 tasks | 2 files |
| Phase 05-options-pricing P01 | 8 | 2 tasks | 2 files |
| Phase 05-options-pricing P02 | 10 | 2 tasks | 5 files |
| Phase 06-params-watchlist P01 | 10 | 1 tasks | 1 files |
| Phase 06-params-watchlist P02 | 8 | 2 tasks | 2 files |
| Phase 06-params-watchlist P02 | 8 | 2 tasks | 2 files |
| Phase 06-params-watchlist P03 | 2 | 2 tasks | 2 files |
| Phase 09-fix-mkt03-param01 P01 | 5 | 2 tasks | 2 files |
| Phase 12-feature-pages P01 | 2 | 10 tasks | 3 files |
| Phase 12-feature-pages P02 | 2 | 4 tasks | 4 files |
| Phase 12-feature-pages P03 | 2 | 5 tasks | 6 files |
| Phase 13-navigation-cleanup P01 | 5 | 2 tasks | 1 files |
| Phase 15-regressao-acucar P01 | 18 | 2 tasks | 3 files |
| Phase 15-regressao-acucar P02 | 4 | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Carried forward from v1.0:

- Audit-first then fix approach confirmed in v1.0
- Risk-neutral drift for options MC (financially correct for derivatives)
- PCT_BOUND=0.50: bounds are 50% of last close to avoid truncating GBM cone
- FastAPI validates JWT locally (PyJWT + RS256 public key) — no round-trip to Supabase [IMPLEMENTED 02-02]
- Role sourced from app_metadata.role in JWT (set by Supabase admin), not top-level role claim [02-02]
- Auth dependency chain: verify_jwt -> get_current_user -> require_admin via FastAPI Depends [02-02]
- Cache-aside incremental in PostgreSQL — reduces yfinance calls, history persisted
- Oracle Cloud Always Free for deploy — zero cost, 4 vCPUs / 24GB sufficient for 100 users
- Next.js App Router + shadcn/ui new-york — modern React ecosystem
- Supabase Auth with JWT RS256 — managed auth, RLS on all user-owned tables
- market_coverage has no RLS — accessed exclusively by FastAPI via service role key
- tickers_catalog write enforced in FastAPI (not RLS) to keep policies simple
- simulations stores JSONB percentiles_series alongside scalar p5/p50/p95 for flexible querying
- All user-owned table FKs use ON DELETE CASCADE from auth.users
- FastAPI routes use full /api/health prefix — Nginx proxies without stripping prefix (proxy_pass no rewrite)
- shadcn style locked to new-york/zinc per design spec
- Nginx does NOT strip /api prefix — proxy_pass http://localhost:8000 with no rewrite (FastAPI routes include /api/)
- setup-vm.sh accepts domain as ### Decisions

; SSL setup skipped with warning if omitted
- PM2 ecosystem.config.js uses interpreter=none for uvicorn (it is the executable, not a Python script)
- VM and Supabase provisioning deferred to infrastructure availability; all local artifacts validated
- [Phase 02-auth]: Used @supabase/ssr factories for cookie-based session persistence across SSR and client renders
- [Phase 02-auth]: Token auto-refresh delegated to @supabase/ssr library — no custom timer code needed
- [Phase 02-auth]: Used proxy.ts (Next.js 16 convention) instead of deprecated middleware.ts — export function named proxy
- [Phase 02-auth]: getUser() not getSession() in proxy — forces server-side token validation and triggers silent refresh
- [Phase 03-market-cache]: coverage boundary extended to gap_end even on empty yfinance response to prevent repeated re-queries
- [Phase 03-market-cache]: Route prefixes kept as /api/* per existing Nginx-no-strip architectural decision
- [Phase 03-market-cache]: TickerSuggestForm fetches access token inline via createBrowserClient — no global auth store
- [Phase 04-mc-simulation]: User isolation enforced at query level (.eq user_id) in all simulation read routes alongside RLS
- [Phase 04-mc-simulation]: SimulationResult interface defined in SimulationForm.tsx and re-imported by SimulationMetrics to avoid duplication
- [Phase 04-mc-simulation]: Input and Label ui stubs created as native HTML wrappers (no @base-ui/react equivalent)
- [Phase 04-mc-simulation]: ui/tabs.tsx created as native HTML stub with React context — API matches shadcn Tabs surface
- [Phase 04-mc-simulation]: History fetch deferred to first Histórico tab activation — avoids API call on every page load
- [Phase 05-01]: Risk-neutral drift (r - 0.5*sigma^2) used in mc_call_price — not historical mu — per no-arbitrage pricing theory
- [Phase 05-options-pricing]: useRef + setTimeout/clearTimeout for 300ms debounce in BSPricer — no external library
- [Phase 06-01]: User isolation enforced at query level (.eq user_id) matching SIM-04 pattern
- [Phase 06-01]: Watchlist POST uses upsert with ignore_duplicates=True for idempotent add
- [Phase 07-admin]: Approval of ticker suggestion calls backfill_ticker() synchronously within the PATCH request (ADM-03 sync pattern)
- [Phase 07-admin]: Admin page guards only against unauthenticated access server-side — backend enforces admin role on every API call (returns 403), avoiding JWT role check duplication in Next.js
- [Phase 09-fix-mkt03-param01]: Used Literal enum for tipo field to enforce DB CHECK constraint at API layer
- [Phase 12-feature-pages]: feedparser for Google News RSS — avoids XML parsing complexity
- [Phase 12-feature-pages]: ARIMA CI rendered via stacked Area fill trick (ci_upper filled, ci_lower fills with background color)
- [Phase 12-feature-pages]: AdminConfig extracted as client component — admin page stays server component for auth guard
- [Phase 13-navigation-cleanup]: Comment out nav items (not delete) to satisfy NAV-01 (hidden from sidebar) and NAV-02 (routes remain accessible)
- [Phase 14-regressao-dolar P01]: Lazy bcb import inside functions (matches /api/focus pattern; avoids top-level import side-effects)
- [Phase 14-regressao-dolar P01]: regression_runs tipo CHECK includes 'acucar' now so Phase 15 reuses same table without a new migration
- [Phase 14-regressao-dolar P01]: SUPABASE_SERVICE_ROLE_KEY used in dolar_run route (plan had SUPABASE_SERVICE_KEY — wrong var name)
- [Phase 14-regressao-dolar P02]: react-plotly.js imported dynamically (next/dynamic ssr:false) to prevent SSR hydration mismatch with Plotly
- [Phase 14-regressao-dolar P02]: History fetch deferred to first Histórico tab activation — avoids API call on every page load (same pattern as simulation page)
- [Phase 14-regressao-dolar P02]: DolarForm owns DolarDefaults and DolarResult interface definitions — imported by DolarMetrics and DolarCharts to avoid duplication
- [Phase 15-regressao-acucar]: XGBoost fixed hyperparameters (no grid search) — only 11 training rows, CV would overfit
- [Phase 15-regressao-acucar]: historico returned in API response but excluded from DB resultado to keep Supabase payload lean
- [Phase 15-regressao-acucar]: from __future__ import annotations added to main.py to fix pre-existing forward-reference NameError on Pydantic models defined after routes
- [Phase 15-regressao-acucar]: AcucarForm owns all interface definitions (AcucarDefaults, AcucarResult, HistoricoPoint) — imported by AcucarMetrics and AcucarCharts to avoid duplication
- [Phase 15-regressao-acucar]: Plotly imported via next/dynamic with ssr:false in AcucarCharts — prevents SSR hydration mismatch

### Pending Todos

- Provision Oracle Cloud VM and run scripts/setup-vm.sh
- Link Supabase CLI and run supabase db push
- Phase 2 (Auth) COMPLETE — begin Phase 3 (Data API)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-07
Stopped at: Session resumed, proceeding to execute 15-02 (Next.js Regressão Açúcar frontend)
Resume file: None
