# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-04)

**Core value:** Correct, trustworthy simulation outputs accessible to 20-100 internal users simultaneously, with persisted data and robust authentication.
**Current focus:** Phase 15 — Loading Skeletons + Error States (v2.1 UX Polish & Reliability)

## Current Position

Phase: 15 — Loading Skeletons + Error States
Plan: 01 (complete)
Status: Phase 15 in progress — Plan 01 complete; skeleton.tsx installed, useApiCall hook and ErrorState component created; REL-03, REL-04, REL-05 shared infrastructure ready
Last activity: 2026-04-05 — 15-01: installed shadcn Skeleton, created useApiCall (AbortController hook), created ErrorState component

```
v2.1 Progress: [████░░░░] 4/8 phases complete (Phase 13 done, Phase 14 complete, Phase 15 P01 done)
```

## Performance Metrics

**Velocity (v2.0 reference):**
- Total plans completed: 29 (v2.0)
- Average duration: ~7 min/plan
- Total execution time: ~200 min

**By Phase (v2.0 historical):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-infra-schema | 3 | ~60 min | ~20 min |
| 02-auth P01 | 8 | 2 tasks | 5 files |
| 02-auth P03 | 20 | 2 tasks | 3 files |
| 03-market-cache P01 | 5 | 1 tasks | 1 files |
| 03-market-cache P02 | 5 | 1 tasks | 1 files |
| 03-market-cache P03 | 15 | 3 tasks | 3 files |
| 04-mc-simulation P01 | 8 | 2 tasks | 2 files |
| 04-mc-simulation P02 | 8 | 2 tasks | 6 files |
| 04-mc-simulation P03 | 8 | 1 tasks | 2 files |
| 05-options-pricing P01 | 8 | 2 tasks | 2 files |
| 05-options-pricing P02 | 10 | 2 tasks | 5 files |
| 06-params-watchlist P01 | 10 | 1 tasks | 1 files |
| 06-params-watchlist P02 | 8 | 2 tasks | 2 files |
| 06-params-watchlist P03 | 2 | 2 tasks | 2 files |
| 09-fix-mkt03-param01 P01 | 5 | 2 tasks | 2 files |
| 12-feature-pages P01 | 2 | 10 tasks | 3 files |
| 12-feature-pages P02 | 2 | 4 tasks | 4 files |
| 12-feature-pages P03 | 2 | 5 tasks | 6 files |

**Recent Trend:**
- v2.0 shipped: 12 phases, 29 plans, all complete
- v2.1 not started

*Updated after each plan completion*
| Phase 13-backend-error-handler-security P02 | 12 | 2 tasks | 1 files |
| Phase 14-mobile-responsiveness P01 | 12 | 2 tasks | 3 files |
| Phase 14-mobile-responsiveness P02 | 5 | 2 tasks | 2 files |
| Phase 14-mobile-responsiveness P03 | 15 | 2 tasks | 9 files |
| Phase 15-loading-skeletons-error-states P01 | 5 | 2 tasks | 3 files |
| Phase 15 P02 | 7 | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Carried forward from v1.0 and v2.0:

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
- setup-vm.sh accepts domain as argument; SSL setup skipped with warning if omitted
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
- [Phase 13-01]: loguru replaces stdlib logging; logger.remove() prevents duplicate output then adds single stderr sink
- [Phase 13-01]: RequestIDMiddleware registered last (LIFO = executes first) — request_id injected before rate-limit and CORS middleware
- [Phase 13-01]: RateLimitExceeded handler registered before global Exception handler to ensure 429s are not caught as 500s
- [Phase 13-01]: No traceback, str(exc), or repr(exc) in JSON response body — exception logged server-side only (SEC-02)
- [Phase 13-02]: model_validator mode=after for RiscoSaveRequest dict size limits (10KB inputs, 50KB results); dict[str, Any] typed to close injection surface
- [Phase 13-02]: request: Request added as first positional param to 9 unrated endpoints per SlowAPI IP extraction requirement; no REST semantic change
- [Phase 13-02]: /api/health intentionally exempt from rate limiting; all other non-health endpoints now covered (38 total @limiter.limit)
- [Phase 14-mobile-responsiveness]: NavContent accepts onNavigate prop; all Links call onClick={onNavigate} to close Sheet on mobile navigation
- [Phase 14-mobile-responsiveness]: Desktop aside uses hidden md:flex so sidebar has display:none below md breakpoint (no layout space consumed on mobile)
- [Phase 14-mobile-responsiveness]: min-w-0 on flex wrapper div and main element prevents horizontal overflow at 375px viewport
- [Phase 14-mobile-responsiveness]: Inline gridTemplateColumns styles must be fully removed (not coexist) with Tailwind grid-cols-* to avoid specificity override on all breakpoints
- [Phase 14-mobile-responsiveness]: Card hover onMouseEnter/onMouseLeave inline styles are acceptable (visual-only, not layout) — only layout-critical gridTemplateColumns needed replacement
- [Phase 14-mobile-responsiveness P03]: Responsive chart heights use wrapper div h-[Xpx] md:h-[Npx] with ResponsiveContainer height='100%' — avoids fixed pixel heights that collapse on mobile
- [Phase 14-mobile-responsiveness P03]: Grid fixes use grid-cols-1 sm:grid-cols-N so single-column layout starts at 375px (sm: breakpoint), not 640px (md: breakpoint)
- [Phase 15-01]: useApiCall checks !controller.signal.aborted before setData and setLoading(false) in finally — prevents stale state updates after intentional cancellation
- [Phase 15-01]: AbortError silently ignored in catch block so user never sees an error flash during retry
- [Phase 15-01]: fetcher receives AbortSignal as argument — each consuming page wires signal into its fetch() call
- [Phase 15]: ARIMA lazy-load anti-pattern converted to proper useEffect with steps as dependency — StrictMode safe and eliminates render-phase side effects
- [Phase 15]: VarPanel ErrorState onRetry uses () => fetchVar(confidence) closure to preserve current confidence selection on retry

### v2.1 Research Flags (resolve before planning affected phase)

- Phase 19 (Email Alerts): Verify Resend free tier limits at resend.com before committing; verify APScheduler + FastAPI 0.115 lifespan hook pattern; test Oracle Cloud port availability (SMTP 25 blocked; use Resend HTTP API)
- Phase 20 (E2E Tests): Verify Playwright globalSetup storageState is shared across workers (not per-worker) to avoid Supabase free-tier login rate limit; verify Next.js 16.2 dev server startup time for webServer config
- Phase 16 (Export PDF): Run `npm show @react-pdf/renderer@4.3.2 peerDependencies` before install to verify React 19 compatibility

### Pending Todos

- Provision Oracle Cloud VM and run scripts/setup-vm.sh
- Link Supabase CLI and run supabase db push
- Phase 13 complete: loguru, RequestIDMiddleware, exception handlers, model_validator dict size limits, Query-bounded params, rate limiting on all non-health endpoints
- Begin next phase (Phase 14 or as defined in ROADMAP)

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-04-05
Stopped at: Completed 15-01-PLAN.md — skeleton primitive, useApiCall hook, ErrorState component created
Resume file: None
