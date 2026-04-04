# Stack Research

**Domain:** UX Polish & Reliability additions to Next.js 16 + FastAPI + Supabase platform
**Researched:** 2026-04-04
**Confidence:** HIGH (versions verified against npm registry and PyPI; existing stack confirmed from package.json and requirements.txt)

---

## Scope

This document covers only **new dependencies** required for v2.1 features. The existing stack (Next.js 16.2.0, React 19.2.4, shadcn/ui, Tailwind CSS 4, recharts, sonner, FastAPI 0.115.6, Supabase, PostgreSQL) is validated and not re-researched.

---

## Recommended Stack — New Additions

### Frontend Libraries

| Library | Version | Feature Area | Why |
|---------|---------|--------------|-----|
| `@playwright/test` | `^1.59.1` | E2E tests | Industry standard for Next.js E2E; built-in browser management, no config server needed for Next.js via `webServer` option; TypeScript-first |
| `@react-pdf/renderer` | `^4.3.2` | PDF export | Pure React approach; renders to PDF client-side or server-side via React component tree; works in Next.js App Router without document.body hacks; v4 supports React 19 |
| `papaparse` | `^5.5.3` | CSV export | Zero-dependency CSV serializer/parser; simplest correct approach for tabular data; streaming support for large simulation result sets |
| `@types/papaparse` | `^5.3.x` | CSV export | TypeScript types for papaparse |
| `react-intersection-observer` | `^10.0.3` | Skeleton / lazy load | Thin wrapper around IntersectionObserver for triggering skeleton-to-content transitions; no polling, no scroll listeners |

### Backend Libraries (Python)

| Library | Version | Feature Area | Why |
|---------|---------|--------------|-----|
| `loguru` | `>=0.7.3` | Structured logging | Drop-in replacement for stdlib logging; JSON sink with one line; structured fields via `bind()`; FastAPI middleware integration is well-documented; simpler than `structlog` for this codebase size |
| `APScheduler` | `>=3.11.2` | Price alert scheduler | Persistent job store (PostgreSQL backend via `SQLAlchemyJobStore`) means alert jobs survive server restarts; cron/interval triggers; already used in similar FastAPI deployments |
| `resend` | — | Email alerts | Python SDK available (`pip install resend`); best deliverability for transactional email at low volume; free tier covers ~3,000 emails/month |
| `httpx` | `>=0.28.1` | Internal HTTP (already installed) | Already at 0.27.2 in venv; only a version bump needed |

> Note: `resend` Python SDK version — checked PyPI, current is `2.x`. Use `resend>=2.0.0`.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `jspdf` + `html2canvas` | Screenshot-based PDF approach captures the browser's rendered DOM at pixel level; breaks on dark mode, custom fonts (Geist), and non-latin characters in chart labels; produces unselectable text; no semantic structure | `@react-pdf/renderer` with explicit layout components |
| `@tanstack/react-query` | Adds a large context provider and cache layer; the app already uses standard `fetch` + `useEffect` patterns for a small number of routes; TanStack Query's value is maximized with many endpoints and complex caching strategies. Overkill for v2.1 scope | Native `fetch` + `useState`/`useEffect`, wrap error states locally; revisit if endpoint count grows past ~20 |
| `swr` | Same rationale as TanStack Query; another cache layer on top of an already-working pattern; introduces refetch-on-focus behavior that can surprise users mid-simulation | Native `fetch` |
| `Cypress` | Heavier setup than Playwright; requires separate process management; slower CI times; Playwright has better Next.js App Router support | `@playwright/test` |
| `nodemailer` / `sendgrid` | nodemailer requires SMTP credentials on Oracle VM; SendGrid has more complex onboarding; Resend is developer-first, zero SMTP config | `resend` |
| `structlog` | More powerful than needed; configuration is verbose for a FastAPI app of this scale; `loguru` achieves JSON structured output with far less boilerplate | `loguru` |
| `celery` + `redis` | APScheduler with AsyncIOScheduler runs in the same FastAPI process; adding Celery requires a Redis broker and separate worker process — incompatible with Oracle Always Free single-VM constraint | `APScheduler` |

---

## Integration Points

### Mobile Responsiveness
No new library needed. shadcn/ui components already use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). The work is layout-level: replace fixed-width containers with `max-w-full`, add `overflow-x-auto` to data tables, and use Tailwind's `grid-cols-1 md:grid-cols-2` patterns for side-by-side scenarios. The shadcn `Sheet` component (already available) replaces modal dialogs on mobile.

### Loading Skeletons
shadcn/ui ships a `Skeleton` component (`npx shadcn add skeleton`). No external library needed. Combine with React `Suspense` boundaries at the page level and a dedicated loading state per data-fetching component.

### Error States with Retry
Pattern: wrap each API call with a local `error`/`retry` state. A shared `<ApiErrorCard error={err} onRetry={refetch} />` component renders a message and retry button. No library needed — this is a UI pattern, not a dependency.

### PDF Export (`@react-pdf/renderer`)
- Create a `SimulacaoPDF` React component that takes simulation result props
- Render server-side via a Next.js Route Handler (`/api/export/pdf`) using `renderToStream()` for better memory profile on ARM
- Return `Content-Type: application/pdf` with inline or attachment disposition
- Integration concern: `@react-pdf/renderer` uses its own font and layout engine — Geist font must be registered separately via `Font.register()`. Use the static `.woff` files already in `/public`

### CSV Export (papaparse)
- Client-side: `Papa.unparse(rows)` → `Blob` → `URL.createObjectURL` → programmatic `<a>` click
- No server round-trip needed; simulation data is already in the browser after the fan chart renders
- Row format: `{ data, p5, p25, p50, p75, p95 }` for MC results; `{ strike, payoff }` for options

### Email Alerts (Resend + APScheduler)
- New FastAPI router `alerts.py`: POST to create alert (asset, threshold, direction, user email)
- Alerts stored in a new `price_alerts` table in Supabase PostgreSQL (RLS: user owns their alerts)
- APScheduler `AsyncIOScheduler` starts with `lifespan` event in `main.py`
- Scheduler job polls current price (already cached in PostgreSQL by `yfinance` layer) every 15 min
- Resend sends HTML email when `current_price >= threshold` (or `<=`)
- Alert deactivated after trigger to avoid spam; user can re-enable from UI

### Saved Simulations History Page
- Backend `/api/simulations` route already exists (from v2.0)
- Frontend work: new page `app/historico/page.tsx`, calls existing endpoint, renders table with replay links
- Each row links back to the simulation fan chart with prefilled parameters from stored JSONB

### Comparative Scenarios
- No library needed. Recharts already installed; render two `<ComposedChart>` components in a `grid grid-cols-1 lg:grid-cols-2` layout
- Shared state (selected scenario A, selected scenario B) in a page-level `useState`
- Both scenarios fetched from `/api/simulations/{id}` using existing endpoint

### E2E Tests (Playwright)
- Install as dev dependency
- `playwright.config.ts` at `frontend/` root; `webServer.command = 'npm run dev'`
- Test files in `frontend/e2e/` (separate from `app/`)
- Smoke test scope: login flow, MC simulation submit + fan chart visible, PDF download triggers
- CI: add `npx playwright install --with-deps chromium` step in GitHub Actions before test run (chromium only is sufficient; skip webkit/firefox for CI speed)

### Global Backend Error Handler (FastAPI)
- Add `@app.exception_handler(Exception)` in `main.py` using loguru `logger.exception()`
- Return structured JSON: `{ "error": "internal_server_error", "message": str(exc), "request_id": uuid }`
- Inject `request_id` via middleware that sets a context var before each request
- No new library beyond loguru

---

## Installation

```bash
# Frontend — dev dependency (tests only)
cd frontend
npm install -D @playwright/test@^1.59.1
npx playwright install chromium

# Frontend — production dependencies
npm install @react-pdf/renderer@^4.3.2
npm install papaparse@^5.5.3
npm install @types/papaparse@^5.3.0 -D
npm install react-intersection-observer@^10.0.3

# shadcn components (no new npm packages)
npx shadcn add skeleton

# Backend
pip install loguru>=0.7.3 APScheduler>=3.11.2 resend>=2.0.0
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@react-pdf/renderer@4.3.2` | React 19.x | v4 explicitly targets React 18+/19; confirmed via changelog |
| `@playwright/test@1.59.1` | Next.js 16, Node 18+ | webServer integration works with App Router dev server |
| `APScheduler@3.11.2` | FastAPI 0.115.6, Python 3.11+ | Use `AsyncIOScheduler`; avoid `BackgroundScheduler` (thread-based, conflicts with uvicorn event loop) |
| `loguru@0.7.3` | FastAPI 0.115.6 | Intercept stdlib logging via `logging.basicConfig(handlers=[InterceptHandler()])` to capture uvicorn logs too |
| `papaparse@5.5.3` | React 19, TypeScript 5 | No React dependency; pure JS module |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@react-pdf/renderer` | `jspdf` + `html2canvas` | Only if you need exact pixel-match of an existing screen (screenshots); never for financial data export |
| `@react-pdf/renderer` | Puppeteer server-side PDF | If PDF needs full Next.js CSS rendering (charts as HTML); Puppeteer adds 150MB+ to server; too heavy for Oracle Always Free ARM |
| `loguru` | `structlog` | If team is already invested in structlog patterns from another service; functionally equivalent |
| `APScheduler` | Supabase Edge Functions + pg_cron | Viable if using Supabase Pro (pg_cron available); free tier doesn't include pg_cron; Edge Functions have cold starts |
| `resend` | AWS SES | If AWS account already exists and team manages IAM; resend is zero-infrastructure for this scale |
| Playwright | Cypress | If team has existing Cypress knowledge; Playwright is faster on CI and has better App Router support |

---

## Sources

- npm registry — `npm show <package> version` — versions verified 2026-04-04 (HIGH confidence)
- PyPI `pip index versions` — Python library versions verified 2026-04-04 (HIGH confidence)
- `/c/Users/netin/OneDrive/Documentos/Code/impacto/frontend/package.json` — existing frontend dependencies (HIGH confidence)
- `/c/Users/netin/OneDrive/Documentos/Code/impacto/requirements.txt` — existing backend dependencies (HIGH confidence)
- APScheduler AsyncIOScheduler + FastAPI pattern — well-established community pattern, flagged MEDIUM confidence for lifespan hook specifics (verify against FastAPI 0.115 lifespan docs)
- `@react-pdf/renderer` React 19 compatibility — based on v4 changelog notes; verify with `npm show @react-pdf/renderer@4.3.2 peerDependencies` before install (MEDIUM confidence)

---

*Stack research for: Impacto v2.1 — UX Polish & Reliability*
*Researched: 2026-04-04*
