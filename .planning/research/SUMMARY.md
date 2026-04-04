# Project Research Summary

**Project:** Impacto v2.1 — UX Polish & Reliability
**Domain:** Financial analytics web platform (sugar futures, FX, Monte Carlo, options pricing)
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

Impacto v2.1 is a targeted UX polish and reliability release for an existing Next.js 16 + FastAPI + Supabase platform used by sugar market participants (traders, mill managers, risk analysts). The existing v2.0 stack is sound and validated; this release adds nine features across mobile responsiveness, loading and error states, data export, simulation history, comparative analysis, email alerts, and automated testing. The research is based on direct codebase inspection and is therefore high confidence — findings reflect the actual state of the code, not assumptions.

The recommended approach is to sequence work foundation-first: fix the broken mobile layout and missing error infrastructure before building higher-level features that depend on those patterns being correct. The architecture research confirms that most v2.1 features can be built using existing dependencies — only five new libraries are required. Feature dependency analysis shows a clear build order where phases 1-2 unblock phases 3-5, and email alerts and E2E tests are independent enough to be sequenced last without blocking anything else.

The primary risk in this release is the mobile responsiveness fix: the entire layout shell (`app/app/layout.tsx`) uses hardcoded inline pixel styles with no responsive breakpoints, and every page in the app renders inside this shell. Getting the sidebar-to-drawer conversion right early is critical because every subsequent feature must be validated at mobile viewports. The secondary risk is PDF export: the natural approach (html2canvas + jsPDF) fails reliably with Recharts SVG gradients and CSS custom properties (oklch colors). The research firmly recommends `@react-pdf/renderer` for structured data export and `@media print` CSS as the path of least resistance for chart capture.

## Key Findings

### Recommended Stack

The existing stack requires only five new dependencies for v2.1. On the frontend: `@react-pdf/renderer@^4.3.2` (React 19 compatible) for PDF generation, `papaparse@^5.5.3` for CSV serialization, `react-intersection-observer@^10.0.3` for skeleton reveal transitions, and `@playwright/test@^1.59.1` as a dev dependency for E2E tests. On the backend: `loguru>=0.7.3` for structured logging, `APScheduler>=3.11.2` for in-process alert scheduling, and `resend>=2.0.0` for email delivery via HTTP API (Oracle Cloud blocks SMTP port 25). The shadcn `Skeleton` component requires only `npx shadcn add skeleton` — no npm package.

Critically: do not add `jsPDF` + `html2canvas` (breaks with Recharts SVG gradients and oklch CSS variables), do not add Celery + Redis (incompatible with Oracle Always Free single-VM constraint), and do not add TanStack Query or SWR (overkill for the current API surface area).

**Core new technologies:**
- `@react-pdf/renderer@4.3.2`: PDF export — only React-native PDF library compatible with React 19 and Next.js App Router without DOM hacks
- `papaparse@5.5.3`: CSV export — zero-dependency, streaming capable, correct handling of numeric data
- `APScheduler@3.11.2` (AsyncIOScheduler): alert polling — runs inside FastAPI process, survives PM2 restarts when started via lifespan context manager
- `resend>=2.0.0`: email delivery — HTTP API, no SMTP config, free tier covers 3,000 emails/month, avoids Oracle's blocked port 25
- `loguru>=0.7.3`: structured logging — drop-in, JSON sink, simpler than structlog for this codebase size
- `@playwright/test@1.59.1`: E2E tests — Next.js official recommendation, storageState for session reuse, better App Router support than Cypress

### Expected Features

**Must have (table stakes) — users will consider the platform broken without these:**
- Mobile responsiveness — traders check positions on phones; the current fixed-px sidebar makes every page unusable below 768px
- Loading skeletons — blank screens feel like crashes; currently all loading states are plain `"Carregando..."` text
- Error states with retry — API calls to yfinance fail regularly; errors currently surface as blank content or unhandled rejections
- Global backend error handler — FastAPI currently returns Python tracebacks on 500s; production apps must sanitize and log
- Export to CSV — traders copy simulation results to Excel; non-negotiable for any financial tool

**Should have (competitive differentiators):**
- Export to PDF — managers need formatted reports; PDF via `@media print` CSS is the pragmatic v2.1 approach
- Saved simulations history page — Supabase already stores results; a replay UI differentiates from stateless tools
- Comparative scenarios (side-by-side) — high value for risk managers running "what if" analyses
- E2E tests (Playwright) — smoke tests prevent regressions in auth and simulation flows

**Defer to v2.2+:**
- Email alerts — highest complexity in the release (DB migration + scheduler + SMTP service + UI); independent of all other features, can be cut if timeline is tight
- Real-time price websockets — yfinance doesn't support streaming; 60-second polling is sufficient
- Bulk history export — rarely used in practice; implement as background job later
- Simulation reproducibility (seed) — already out of scope in PROJECT.md; saved percentiles serve the same need

### Architecture Approach

The v2.1 architecture adds a thin layer of infrastructure components on top of the existing v2.0 system without changing the core data flow. The major architectural additions are: a mobile-responsive layout shell with a Sheet-based drawer sidebar, a shared `lib/export.ts` utility for client-side CSV/PDF generation, a `backend/alerts.py` module with APScheduler initialized via FastAPI lifespan, a `supabase/migrations/` entry for the `price_alerts` table, and an `e2e/` directory at repo root with Playwright configuration. All other features (skeletons, error states, comparative scenarios) are component-level changes to existing pages.

**Major components:**
1. `components/layout/MobileSidebar.tsx` + `NavBar.tsx` — Sheet-based drawer triggered by hamburger; shares `NavContent` with desktop aside to avoid duplication
2. `lib/export.ts` — `downloadCSV()` and `downloadPDF()` utilities; pure client-side, no backend round-trip; PDF via `@react-pdf/renderer` not html2canvas
3. `components/simulation/CenarioPanel.tsx` — extracted from `cenarios/page.tsx`; each panel is self-contained with own state; parent renders 1 or 2 panels
4. `backend/alerts.py` + `APScheduler AsyncIOScheduler` — alert CRUD, price comparison, Resend email dispatch; cron every 15 minutes; idempotent (triggered=TRUE before send)
5. `e2e/` directory — Playwright config, `auth.setup.ts` (single login → storageState reuse), smoke specs for dashboard/simulation/cenarios/export

### Critical Pitfalls

1. **Fixed sidebar eats mobile screen space** — `app/app/layout.tsx` renders `w-56 flex-shrink-0` with no breakpoint; on 375px this leaves ~150px for content. Fix: convert aside to `hidden md:flex` + add Sheet drawer for mobile. Do not use `overflow-x: hidden` as a workaround — it breaks sticky/fixed positioning.

2. **html2canvas + Recharts SVG gradients produce blank boxes in PDF** — `cenarios/page.tsx` uses `linearGradient id="colorRisk"` in its chart; html2canvas does not serialize SVG `<defs>`. The app also uses `oklch()` CSS custom properties which html2canvas cannot resolve. Fix: use `@react-pdf/renderer` for structured data export. Accept text-only PDF for v2.1 or use `@media print` CSS for chart pages (Recharts SVG prints natively via browser).

3. **Retry button without AbortController stacks inflight requests** — client-side pages (`var`, `simulation`, `cenarios`) use plain `fetch` with no signal. Clicking retry while a slow yfinance call is in-flight queues multiple requests, causing state flicker. Fix: every fetch function must hold a `useRef<AbortController>`; abort previous on each invocation.

4. **APScheduler alert job dies silently on PM2 restart if initialized at module import** — `asyncio.create_task` at startup is fragile across restarts. Fix: initialize `AsyncIOScheduler` exclusively inside the FastAPI `@asynccontextmanager` lifespan; configure job error callbacks to log at ERROR level (captured by PM2).

5. **FastAPI global `@app.exception_handler(Exception)` can break existing SlowAPI rate limit responses** — `SlowAPIMiddleware` raises `RateLimitExceeded` which bypasses router-level exception handlers; adding a generic handler may make rate limit responses non-JSON. Fix: register an explicit `RateLimitExceeded` handler after the general one; test by exceeding the rate limit and asserting `Content-Type: application/json`.

6. **Skeleton height mismatch causes visible layout shift (CLS)** — rough `h-24` skeletons that don't mirror the actual Card DOM structure will jump when content loads. Fix: build skeleton components using the same Card wrapper with skeleton internals, not a raw height approximation.

7. **E2E test JWT expiry mid-suite on CI** — Supabase access tokens expire in 1 hour; a suite running 45+ minutes will hit 401s that look like app bugs. Fix: authenticate once in `globalSetup` via `storageState`; never log in via UI in individual tests.

## Implications for Roadmap

Based on research, the dependency graph is clear: mobile layout and backend error infrastructure must come before everything else, exports and history are mid-tier, and email alerts and E2E tests come last. Seven phases are suggested.

### Phase 1: Foundation — Backend Error Handler + Structured Logging
**Rationale:** The global error handler is a prerequisite for meaningful frontend error states (frontend error UI is useless if the backend returns unstructured 500 tracebacks). This is also the lowest-effort, highest-payoff item in the release — one file change in `main.py`. Do this first so all subsequent phases benefit from structured logs and correlation IDs during development.
**Delivers:** `@app.exception_handler(Exception)` returning structured JSON; `loguru` replacing stdlib logging; request ID middleware; `RateLimitExceeded` handler preserved
**Addresses:** Table-stakes "global backend error handler" feature
**Avoids:** Pitfall 5 (SlowAPI rate limit handler conflict — must be set up correctly from the start)
**Research flag:** None — standard FastAPI pattern, well-documented

### Phase 2: Mobile Responsiveness
**Rationale:** Every page renders inside the layout shell. If the sidebar is broken on mobile, every other feature is broken on mobile. Fix the shell before adding new features to pages.
**Delivers:** Collapsible sidebar (`hidden md:flex` + Sheet drawer), `NavBar.tsx` with hamburger for mobile, all inline `style={}` grid props on dashboard converted to Tailwind responsive classes
**Addresses:** Table-stakes "mobile responsiveness" feature
**Avoids:** Pitfall 1 (fixed sidebar), Pitfall 2 (Recharts clip on mobile — fix chart margins in this phase)
**Research flag:** Low risk — Tailwind + shadcn Sheet are standard; the work is systematic and auditable

### Phase 3: Loading Skeletons and Error States
**Rationale:** These two features share the same fetch lifecycle. Skeletons require knowing where async boundaries are; error states require knowing what error payloads look like (now standardized by Phase 1). Building them together avoids touching the same files twice.
**Delivers:** `skeleton.tsx` primitive; `api-error.tsx` reusable error + retry component; `loading.tsx` files for dashboard and simulation routes; `app/app/error.tsx` segment boundary; AbortController pattern applied to all client-side fetch functions
**Addresses:** Table-stakes "loading skeletons" and "error states with retry" features
**Avoids:** Pitfall 3 (skeleton shape mismatch — build skeleton components with same DOM structure as real content), Pitfall 4 (AbortController — implement alongside retry UI)
**Research flag:** None — shadcn Skeleton + Next.js loading.tsx are standard patterns

### Phase 4: Export (CSV and PDF)
**Rationale:** Simulation result data is already in frontend React state after v2.0. This is a pure client-side addition with no backend dependencies. Can technically be parallelized with Phase 3, but sequencing it after Phase 3 ensures error handling is in place before export buttons are wired up.
**Delivers:** `lib/export.ts` with `downloadCSV()` and `downloadPDF()`; `ExportButtons.tsx` component; export buttons added to simulation, breakeven, and VaR pages; `@react-pdf/renderer` installed for structured PDF; `@media print` CSS as primary chart export strategy
**Addresses:** "Export CSV" (P1) and "Export PDF" (P2) features
**Avoids:** Pitfall 5 (html2canvas + SVG gradient failure — explicitly ruled out; use `@react-pdf/renderer` and `@media print` instead)
**Research flag:** MEDIUM — `@react-pdf/renderer` v4 React 19 peer dependency needs verification before install (`npm show @react-pdf/renderer@4.3.2 peerDependencies`)

### Phase 5: Saved Simulations History Page
**Rationale:** The Supabase `simulations` table with JSONB percentiles already exists from v2.0. This is primarily a frontend UI task. History page is required before comparative scenarios can be built (users select simulations to compare from history).
**Delivers:** `app/historico/page.tsx` with paginated list (limit 50), replay links that pre-fill simulation form, CSV export from history rows
**Addresses:** "Saved simulations history page" feature
**Avoids:** Pitfall on cross-user RLS — verify `api/simulations/{id}` enforces `user_id = auth.uid()` before exposing to users
**Research flag:** None — straightforward CRUD + list UI against existing Supabase table

### Phase 6: Comparative Scenarios
**Rationale:** Depends on history page (Phase 5) for simulation selection. Uses the `CenarioPanel` extraction pattern to avoid global state. Two independent API calls fire in parallel via `Promise.all`.
**Delivers:** `CenarioPanel.tsx` extracted from `cenarios/page.tsx`; `CenariosPage` updated to render 1 or 2 panels; grid is `grid-cols-1 md:grid-cols-2`; each panel has independent loading/error/result state
**Addresses:** "Comparative scenarios" feature
**Avoids:** Pitfall 7 (doubled CPU load — document expected latency; use `Promise.all` not sequential; add result cache via existing `/api/simulations/{id}`)
**Research flag:** None — panel extraction is a standard React pattern

### Phase 7: Email Alerts
**Rationale:** Highest complexity in the release. Fully independent of all other v2.1 features — it touches a new DB table, new backend module, external SMTP service, and a scheduler. Placing it last avoids its complexity blocking other features.
**Delivers:** `supabase/migrations/[ts]_price_alerts.sql`; `backend/alerts.py` with CRUD + APScheduler job + Resend dispatch; `AlertForm.tsx` embedded in user parameters page; idempotent alert check (triggered=TRUE before send)
**Addresses:** "Email alerts for price thresholds" feature
**Avoids:** Pitfall 6 (APScheduler initialized inside lifespan context manager, not at module import; log ERROR on job failure; use Resend HTTP API not SMTP port 25)
**Research flag:** HIGH — test on Oracle Cloud VM before building UI; verify Resend free tier limits; verify APScheduler + FastAPI lifespan integration against FastAPI 0.115 docs

### Phase 8: E2E Tests (Playwright)
**Rationale:** Tests validate the complete shipped feature set. Writing tests before features are stable wastes effort on rewrites.
**Delivers:** `e2e/` directory with `playwright.config.ts`; `auth.setup.ts` with storageState; smoke specs for login, simulation submit, fan chart visibility, CSV download, comparative scenarios; CI job in GitHub Actions
**Addresses:** "E2E tests" feature
**Avoids:** Pitfall 8 (JWT expiry — single `globalSetup` login with storageState; never log in via UI in individual tests; run suite with `--workers 4` to stay under 1-hour token TTL)
**Research flag:** MEDIUM — CI integration requires test Supabase project credentials in GitHub Secrets; Playwright's `webServer` option needs verification against Next.js 16.2 dev server startup time

### Phase Ordering Rationale

- Phase 1 before everything else: backend error handler makes all subsequent debugging across phases more productive and is required by Phase 3's error state UI
- Phase 2 before feature additions: broken mobile layout means any new page feature is validated incorrectly until the shell is fixed
- Phase 3 paired with Phase 2 validation: error states and skeletons are per-page additions that need the correct responsive shell to test against
- Phase 4 independent but after Phase 3: export buttons should handle error states correctly; simpler to add them after error UI patterns are established
- Phase 5 before Phase 6: comparative scenarios require history page for simulation selection
- Phase 7 last among features: highest complexity, external dependencies, testable independently
- Phase 8 last: validates the full release

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 7 (Email Alerts):** External service integration (Resend), Oracle Cloud network policy (port 25 blocked), APScheduler + FastAPI 0.115 lifespan API — verify before writing any UI
- **Phase 8 (E2E Tests):** CI environment setup (Playwright + Supabase test credentials + Next.js `webServer` startup time) — prototype the GitHub Actions job before writing tests
- **Phase 4 (Export PDF):** `@react-pdf/renderer` v4 peer dependency with React 19 — verify before install

Phases with standard patterns (skip research):
- **Phase 1:** FastAPI `@app.exception_handler` + loguru — stable, well-documented API
- **Phase 2:** Tailwind responsive classes + shadcn Sheet — established pattern, existing components available
- **Phase 3:** shadcn Skeleton + Next.js `loading.tsx` — file-system convention, zero configuration
- **Phase 5:** Supabase table + paginated list UI — straightforward CRUD
- **Phase 6:** React panel extraction — standard component composition pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm registry and PyPI; existing stack confirmed from package.json and requirements.txt; "what not to add" list is well-reasoned |
| Features | HIGH | Based on direct codebase audit; inline style issues and missing error handling confirmed in actual files; feature dependency graph verified against actual code structure |
| Architecture | HIGH | Based on direct inspection of layout.tsx, cenarios/page.tsx, main.py, and migration files; component boundaries reflect actual file structure |
| Pitfalls | HIGH | All critical pitfalls traced to specific lines in real files (SVG gradient in cenarios, silent catch in simulation, fixed sidebar in layout); not hypothetical |

**Overall confidence:** HIGH

### Gaps to Address

- **`@react-pdf/renderer` React 19 peer dependency:** STACK.md flags this as MEDIUM confidence — run `npm show @react-pdf/renderer@4.3.2 peerDependencies` before Phase 4 begins and verify no breaking constraint
- **Resend free tier limits:** 3,000 emails/month is assumed from training knowledge; verify current pricing at resend.com before committing to it in Phase 7
- **APScheduler + FastAPI 0.115 lifespan specifics:** The `@asynccontextmanager` lifespan hook changed between FastAPI versions; verify the exact pattern against FastAPI 0.115.6 docs before Phase 7 implementation
- **Oracle Cloud VM port availability:** SMTP port 25 is documented as blocked; ports 587 (submission) and 465 (SMTPS) status is unverified — moot if using Resend HTTP API, but relevant if fallback SMTP is considered
- **Supabase Auth rate limits for E2E:** Free tier limits to 10 logins/hour per IP; the `storageState` pattern avoids this, but CI parallel workers may still hit it if `auth.setup.ts` runs per-worker — verify Playwright `globalSetup` is shared, not per-worker

## Sources

### Primary (HIGH confidence)
- `frontend/app/app/layout.tsx` — confirmed fixed sidebar, inline px styles, no mobile breakpoints
- `frontend/app/app/cenarios/page.tsx` — confirmed SVG linearGradient, silent catch blocks
- `frontend/app/app/var/page.tsx` — confirmed ad-hoc skeleton, missing AbortController
- `frontend/app/app/simulation/page.tsx` — confirmed silent catch on history click
- `backend/main.py` — confirmed no global exception handler, bare logging import
- `supabase/migrations/` — confirmed existing table schema and RLS policies
- `frontend/package.json` — confirmed existing frontend dependencies
- `requirements.txt` — confirmed existing backend dependencies
- npm registry (`npm show <package> version`) — versions verified 2026-04-04
- PyPI (`pip index versions`) — Python versions verified 2026-04-04

### Secondary (MEDIUM confidence)
- `@react-pdf/renderer` React 19 compatibility — based on v4 changelog; needs pre-install verification
- APScheduler + FastAPI lifespan integration — community pattern, not tested against FastAPI 0.115.6 specifically
- Playwright + Next.js 16 App Router E2E — official Next.js docs recommendation; CI specifics need verification
- `jsPDF + html2canvas` SVG gradient failure — training knowledge + known production issue pattern; not tested specifically on this codebase

### Tertiary (LOW confidence)
- Resend free tier pricing/limits — training knowledge, verify before Phase 7 commitment
- Oracle Cloud port 587/465 availability — extrapolated from port 25 policy; unverified

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
