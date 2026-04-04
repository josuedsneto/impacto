# Architecture Research

**Domain:** Financial analytics platform — UX Polish & Reliability (v2.1)
**Researched:** 2026-04-04
**Confidence:** HIGH (based on direct codebase analysis)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Oracle Cloud VM (Nginx)                        │
│                                                                      │
│  ┌──────────────────────────┐  ┌────────────────────────────────┐   │
│  │   Next.js 16 (port 3000) │  │   FastAPI uvicorn (port 8000)  │   │
│  │   App Router + shadcn/ui │  │   Python quant engine          │   │
│  │                          │  │                                │   │
│  │  [proxy.ts]  ← Supabase  │  │  [auth.py]  ← JWT RS256       │   │
│  │  auth guard              │  │  [main.py]  ← route handlers  │   │
│  │                          │  │  [simulation.py]               │   │
│  │  /app/* (protected)      │  │  [market_cache.py]             │   │
│  │  /(auth)/* (public)      │  │  [options.py]                  │   │
│  └──────────┬───────────────┘  └─────────────┬──────────────────┘   │
│             │  browser fetch /api/*            │                     │
│             └──────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────────┘
              │                         │
              ▼                         ▼
     Supabase Cloud              yfinance / BCB API
     (PostgreSQL + Auth)         (external market data)
```

### Component Responsibilities (Existing v2.0)

| Component | Responsibility | Location |
|-----------|----------------|----------|
| `proxy.ts` | Auth middleware — redirects unauthenticated requests from `/app/*` to `/login` | `frontend/proxy.ts` |
| App layout | Fixed sidebar nav (w-56, dark `#111827`), `main` with flex-1 — no mobile breakpoints | `frontend/app/app/layout.tsx` |
| Dashboard page | Server component — parallel fetches prices/focus/market-status; inline px/style props throughout | `frontend/app/app/dashboard/page.tsx` |
| Simulation page | Client component — MC form + fan chart + history tab; ad-hoc `<p>Carregando...</p>` spinner | `frontend/app/app/simulation/page.tsx` |
| Cenarios page | Client component — breakeven distribution chart with recharts; ad-hoc error `<p>` | `frontend/app/app/cenarios/page.tsx` |
| FastAPI main | All API routes; `logging.getLogger` only; no global exception handler; per-route `try/except` | `backend/main.py` |
| Supabase tables | `simulations`, `breakeven_simulations`, `risco_simulations`, `cenarios_simulations`, `market_prices`, `watchlist`, `tickers_catalog`, `user_parameters`, `admin_config` — all with RLS | `supabase/migrations/` |

---

## v2.1 Integration Points

### 1. Mobile Responsiveness

**What must change:** The sidebar layout is fixed at `w-56` with no breakpoint. The dashboard uses inline `gridTemplateColumns: "1fr 1fr"` and `"1fr 1fr 1fr"` with no media queries. The `main` element uses `padding: "32px 40px"` as inline style.

**Integration pattern:** Modify `app/app/layout.tsx` to use a collapsible drawer on mobile (Tailwind `md:` breakpoints). Replace all inline `style={}` grid props in dashboard with Tailwind grid classes. The sidebar can be converted to a slide-out sheet using the existing shadcn Sheet component (already in the Radix UI dependency tree via `radix-ui ^1.4.3`).

**New components needed:**
- `components/layout/MobileSidebar.tsx` — Sheet-based drawer triggered by hamburger button
- `components/layout/NavBar.tsx` — Top bar shown only on mobile (`md:hidden`) with hamburger + brand

**Modified components:**
- `app/app/layout.tsx` — Add `md:block hidden` to sidebar, add MobileSidebar for small screens
- `app/app/dashboard/page.tsx` — Replace inline style grid with `grid-cols-1 sm:grid-cols-2` and `grid-cols-1 sm:grid-cols-3`

**Tailwind breakpoint convention:** Use `sm:` (640px) for single-column → two-column transitions. The sidebar collapses below `md:` (768px).

---

### 2. Loading Skeletons

**What must change:** All loading states are plain text strings (`"Carregando..."`, `<p className="text-sm text-muted-foreground">Carregando...</p>`). No structural placeholders exist.

**Integration pattern:** shadcn Skeleton is the correct primitive — it is already part of the shadcn/ui system the project uses. Add `components/ui/skeleton.tsx` via `npx shadcn add skeleton`. Use Next.js `loading.tsx` convention for route-level skeletons (server component routes), and inline `<Skeleton>` inside client components that control their own loading state.

**New components needed:**
- `components/ui/skeleton.tsx` — shadcn primitive (one command to add)
- `components/simulation/SimulationHistorySkeleton.tsx` — placeholder list for history tab
- `components/dashboard/DashboardSkeleton.tsx` — placeholder for PriceCards + widgets

**Where to add `loading.tsx`:**
- `app/app/simulation/loading.tsx` — server render fallback
- `app/app/dashboard/loading.tsx` — already a server component, benefits from route-level loading

**Modified components:**
- `components/dashboard/NewsFeed.tsx` — replace `loading &&` text with `<Skeleton>` rows
- `components/admin/AdminConfig.tsx`, `SuggestionQueue.tsx` — same replacement

---

### 3. Error States with Retry

**What must change:** Error handling is inconsistent — some components show a red `<p>` with no retry button; client components swallow errors silently in `catch {}` blocks (e.g., `handleHistoryItemClick` in simulation page).

**Integration pattern:** Two mechanisms for two contexts:
1. **Per-component error UI** — a reusable `<ApiError>` component that shows the message and a "Tentar novamente" button, wired to a retry callback. This covers all client-side fetch failures.
2. **React error boundaries** — for unexpected JS errors that crash a subtree. Use `error.tsx` files (Next.js convention) at the route segment level. These are React error boundary wrappers generated automatically by Next.js.

**New components needed:**
- `components/ui/api-error.tsx` — reusable `{ message, onRetry }` error display
- `app/app/error.tsx` — segment-level error boundary for all `/app/*` routes
- `app/app/simulation/error.tsx` — optional finer-grained boundary for simulation route

**Modified components:**
- `app/app/simulation/page.tsx` — replace `{historyError && <p>}` with `<ApiError message={historyError} onRetry={...} />`
- `app/app/cenarios/page.tsx` — replace `{error && <p>}` pattern
- `components/dashboard/NewsFeed.tsx` — add retry on fetch failure

---

### 4. Export to PDF and CSV

**What must change:** No export infrastructure exists. The simulation results, VaR results, and breakeven outputs are rendered-only — no download path.

**Integration pattern:**

**CSV export** — pure client-side, no new dependencies needed. A utility function converts a JS array of objects to a CSV blob and triggers a download via `URL.createObjectURL`. This is synchronous and works in any client component.

```typescript
// lib/export.ts
export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  const headers = Object.keys(rows[0]);
  const body = rows.map(r => headers.map(h => r[h]).join(",")).join("\n");
  const blob = new Blob([headers.join(",") + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

**PDF export** — two options:
- `jsPDF + html2canvas`: captures the rendered DOM region as a canvas, then embeds it as an image in a PDF. Simple, works with recharts charts, no backend needed. Limitation: image quality at print resolution.
- `@react-pdf/renderer`: generates PDF from a React component tree. Output is vector/text, higher quality. Does not capture recharts charts directly — requires re-rendering data as react-pdf primitives.

**Recommendation:** Use `jsPDF + html2canvas` for v2.1. It captures the existing fan chart and distribution charts without re-implementing them. Add `@react-pdf/renderer` only if users need print-quality reports later. Both libraries are browser-only — import with `dynamic(() => import(...), { ssr: false })` inside Next.js client components.

**New components needed:**
- `lib/export.ts` — `downloadCSV()` and `downloadPDF(elementId, filename)` utilities
- `components/simulation/ExportButtons.tsx` — "Exportar CSV" and "Exportar PDF" buttons, client-only
- `components/ui/export-menu.tsx` — optional dropdown variant for pages with multiple export targets

**Modified components:**
- `app/app/simulation/page.tsx` — add `<ExportButtons>` below `<SimulationMetrics>` when result is active
- `app/app/breakeven/page.tsx`, `app/app/var/page.tsx` — similar export button placement

**Backend change:** None required. All export logic runs client-side.

---

### 5. Email Alerts

**What must change:** No alert infrastructure exists. The database has no `price_alerts` table. There is no background polling or cron job.

**Integration pattern:** This feature has three sub-components:

**A. Database table** — `price_alerts` in Supabase:
```sql
CREATE TABLE price_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ticker      TEXT NOT NULL,
  threshold   NUMERIC NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  email       TEXT NOT NULL,
  triggered   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**B. Alert check endpoint** — `POST /api/alerts/check` in FastAPI. Fetches current price from the market cache, compares against all non-triggered alerts for that ticker, marks as triggered, and queues email sends. Must be idempotent (triggered=TRUE prevents duplicate sends).

**C. Email sending** — Two options for Oracle Cloud VM:
- **Resend** (resend.com): HTTP API, generous free tier (3000 emails/month), no SMTP config. Add `resend` Python package. Confidence: MEDIUM (not verified via docs, but widely used pattern).
- **SMTP via Gmail/Sendgrid**: more complex, requires app passwords or API keys.

**Recommendation:** Resend via HTTP API. Single `requests.post` call inside the alert check handler.

**D. Polling trigger** — Two options:
- Frontend polling: a `setInterval` in the dashboard client component that calls `POST /api/alerts/check?ticker=SB=F` every N minutes while the user is on the page. Simple, no cron needed, but only fires while app is open.
- Server-side cron: a PM2 cron job or a dedicated Python script run via `crontab` on the Oracle VM. Fires reliably even when no user is logged in.

**Recommendation:** Server-side cron (`crontab -e` on the VM calling a Python script) for reliable delivery. Frontend polling as a secondary check for immediate feedback.

**New components needed:**
- `components/params/AlertForm.tsx` — form to create/delete price alerts per ticker
- `app/app/params/page.tsx` additions — embed AlertForm in the user parameters page

**New backend files:**
- `backend/alerts.py` — alert CRUD + check + email send logic
- `scripts/check_alerts.py` — standalone script called by cron

**New database migration:**
- `supabase/migrations/[ts]_price_alerts.sql`

---

### 6. Comparative Scenarios

**What must change:** The cenarios page renders a single scenario. There is no side-by-side comparison view.

**Integration pattern:** The cenarios page already runs the full simulation in one API call. Comparative scenarios = running two independent `POST /api/cenarios` calls with different inputs and rendering both results side by side.

**No new API endpoints needed.** The existing `/api/cenarios` endpoint is stateless and can be called twice.

**Layout pattern:** Two-panel grid using `grid-cols-1 lg:grid-cols-2 gap-6`. Each panel is a self-contained `<CenarioPanel>` client component with its own form state and result state.

**New components needed:**
- `components/simulation/CenarioPanel.tsx` — extracted single-scenario UI (form + chart + KPIs). Extract from the existing cenarios page. `CenariosPage` is refactored to render one or two `<CenarioPanel>` instances.
- `app/app/cenarios/page.tsx` — add "Comparar cenário" toggle button that renders a second panel

**Data flow:** Each `CenarioPanel` manages its own `loading`, `error`, `result` state. No shared state between panels. Comparison is purely visual — no new database table needed.

---

### 7. E2E Tests

**What must change:** No test infrastructure exists. No `playwright.config.ts` or `cypress.config.ts` present.

**Integration pattern:** Use Playwright. Rationale: it is the current standard for Next.js E2E tests (Next.js official docs use it), supports multiple browsers, has first-class support for authentication flows (storageState for session reuse), and has better TypeScript support than Cypress.

**Setup location:** Tests live in `e2e/` at repo root (not inside `frontend/`). This is the Playwright convention and keeps test config separate from the Next.js build.

```
e2e/
├── playwright.config.ts
├── auth.setup.ts        — login once, save storageState
├── smoke/
│   ├── dashboard.spec.ts
│   ├── simulation.spec.ts
│   └── cenarios.spec.ts
└── fixtures/
    └── auth.ts          — authenticated page fixture
```

**Authentication pattern:** Use `storageState` to authenticate once in `auth.setup.ts` and reuse the session across all specs. Supabase Auth uses cookies set by the SSR client — Playwright captures these.

**CI integration:** Add a `playwright` job to `.github/workflows/deploy.yml` that runs `npx playwright test` against the staging URL after deploy.

**New files needed:**
- `e2e/playwright.config.ts`
- `e2e/auth.setup.ts`
- `e2e/smoke/*.spec.ts` (3–5 smoke tests)

**New devDependency:** `@playwright/test`

---

### 8. Global Backend Error Handler + Structured Logging

**What must change:** `main.py` uses `logging.getLogger(__name__)` but the logger is never called in route handlers — errors propagate as unhandled exceptions or get swallowed by bare `except Exception`. There is no global exception handler registered on the FastAPI app.

**Integration pattern:**

**Global exception handler** — register a catch-all on the FastAPI app instance before the first route:
```python
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s %s — %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Erro interno. Tente novamente."})
```

This does not replace `HTTPException` handling (FastAPI handles those correctly already). It catches unexpected exceptions that currently return 500 with a stack trace visible in the response body.

**Structured logging** — replace bare `logging` with `structlog`. It formats log records as JSON lines by default (machine-parseable), adds request context (method, path, user_id), and is a drop-in wrapper over the stdlib logger.

```python
import structlog
logger = structlog.get_logger()
# Usage: logger.error("simulation_failed", ticker=ticker, user_id=user["id"], exc_info=True)
```

**Request ID middleware** — add a middleware that generates a `X-Request-ID` UUID per request and injects it into the structlog context. This correlates frontend error reports with backend log lines.

**Modified files:**
- `backend/main.py` — add `@app.exception_handler(Exception)`, replace `logging` import with `structlog`
- `backend/requirements.txt` — add `structlog`

**New file:**
- `backend/logging_config.py` — structlog configuration (JSON renderer for production, console renderer for dev)

---

## Recommended Project Structure Changes

```
frontend/
├── app/
│   ├── app/
│   │   ├── error.tsx              [NEW] — segment error boundary
│   │   ├── layout.tsx             [MODIFIED] — mobile sidebar integration
│   │   ├── dashboard/
│   │   │   ├── loading.tsx        [NEW] — route-level skeleton
│   │   │   └── page.tsx           [MODIFIED] — Tailwind grid classes
│   │   └── simulation/
│   │       ├── loading.tsx        [NEW] — route-level skeleton
│   │       └── page.tsx           [MODIFIED] — ExportButtons + ApiError
├── components/
│   ├── layout/
│   │   ├── MobileSidebar.tsx      [NEW] — Sheet-based drawer
│   │   └── NavBar.tsx             [NEW] — mobile top bar
│   ├── ui/
│   │   ├── skeleton.tsx           [NEW] — shadcn primitive
│   │   ├── api-error.tsx          [NEW] — reusable error + retry
│   │   └── export-menu.tsx        [NEW] — optional export dropdown
│   ├── simulation/
│   │   ├── ExportButtons.tsx      [NEW]
│   │   ├── SimulationHistorySkeleton.tsx  [NEW]
│   │   └── CenarioPanel.tsx       [NEW] — extracted from cenarios page
│   ├── dashboard/
│   │   └── DashboardSkeleton.tsx  [NEW]
│   └── params/
│       └── AlertForm.tsx          [NEW]
└── lib/
    └── export.ts                  [NEW] — CSV + PDF utilities

backend/
├── main.py                        [MODIFIED] — global handler, structlog
├── alerts.py                      [NEW] — alert CRUD + check + email
├── logging_config.py              [NEW] — structlog setup
└── requirements.txt               [MODIFIED] — structlog, resend

supabase/migrations/
└── [ts]_price_alerts.sql          [NEW]

e2e/                               [NEW — at repo root]
├── playwright.config.ts
├── auth.setup.ts
└── smoke/
    ├── dashboard.spec.ts
    ├── simulation.spec.ts
    └── cenarios.spec.ts
```

---

## Architectural Patterns

### Pattern 1: Route-Level Skeleton via `loading.tsx`

**What:** Next.js App Router automatically wraps `loading.tsx` in a Suspense boundary. When the route segment's server component is streaming, Next.js shows `loading.tsx` until the data resolves.

**When to use:** Server component pages that fetch data during render (dashboard, history pages). NOT for client components that initiate fetches after mount — those need inline skeleton logic.

**Trade-offs:** Zero boilerplate for server component routes. Client component routes still need manual `isLoading` state + skeleton rendering.

### Pattern 2: Extracted Panel for Comparative Views

**What:** Rather than building a new "comparison" page, extract the existing single-scenario component into a `<CenarioPanel>` and render it once or twice depending on a toggle. Each panel is fully self-contained with its own state.

**When to use:** Any time an existing analytic page needs a "compare" feature. Avoids lifting state, avoids new routes, avoids new API endpoints.

**Trade-offs:** The page component becomes a thin orchestrator. Two independent API calls fire in parallel (no shared loading state), which is correct behaviour.

### Pattern 3: Client-Side Export (No Backend Round-Trip)

**What:** Simulation results are already in React component state after the API call. CSV and PDF generation happens entirely in the browser using the cached state — no second API call needed.

**When to use:** When the data to export is already present in client state. If the user needs to export historical data not currently loaded, a backend `/api/export` endpoint may be needed in v2.2+.

**Trade-offs:** No server load. PDF quality limited by canvas capture (jsPDF + html2canvas). Large datasets (> 10k rows) may cause brief UI freeze — use `requestIdleCallback` wrapper.

### Pattern 4: Idempotent Alert Check

**What:** The alert check endpoint marks `triggered = TRUE` before sending the email. On retry (network failure), the email is not re-sent. A daily cron job resets triggered status at midnight so alerts can fire again next day if the condition persists.

**When to use:** Any polling-triggered side effect where duplicate sends are worse than missed sends.

**Trade-offs:** One missed email per transient network error. Acceptable for price alert use case.

---

## Data Flow

### v2.1 Export Flow

```
User clicks "Exportar CSV"
    ↓
ExportButtons (client) reads activeResult from parent state
    ↓
lib/export.ts: downloadCSV(percentiles_series, "mc_result.csv")
    ↓
Browser: Blob → URL.createObjectURL → anchor click → download
    (no fetch, no backend)
```

### v2.1 Alert Flow

```
User creates alert in AlertForm
    ↓
POST /api/alerts — FastAPI inserts row into price_alerts table
    ↓
cron (5-min interval) → scripts/check_alerts.py
    ↓
Fetch current price from market_prices table (last row per ticker)
    ↓
Compare against all triggered=FALSE alerts
    ↓
For matching alerts: mark triggered=TRUE, call Resend API
    ↓
Resend sends email to alert.email
```

### v2.1 Comparative Scenario Flow

```
User toggles "Comparar"
    ↓
CenariosPage renders <CenarioPanel A> + <CenarioPanel B>
    ↓
User fills Panel B inputs, clicks "Calcular"
    ↓
Panel B: POST /api/cenarios (same endpoint as Panel A)
    ↓
Panel B renders its own result; Panel A unchanged
    (two independent React state machines, no shared state)
```

---

## Build Order (Dependency-Aware)

The recommended build order for v2.1 phases, based on component dependencies:

**Phase 1 — Foundation (no inter-phase deps)**
- Skeleton component (`components/ui/skeleton.tsx`) — used by phases 2 and 3
- ApiError component (`components/ui/api-error.tsx`) — used by phase 3
- Global backend error handler + structlog — standalone, unblocks debugging in all later phases
- `loading.tsx` files for existing server component routes

**Phase 2 — Mobile responsiveness**
- Depends on: nothing. Pure CSS/layout change.
- MobileSidebar + NavBar components
- Fix inline style grids → Tailwind breakpoints in dashboard page
- Risk: dashboard has extensive inline styles; each must be audited manually

**Phase 3 — Error states with retry**
- Depends on: `api-error.tsx` (Phase 1)
- Replace all ad-hoc `{error && <p>}` patterns with `<ApiError>`
- Add `app/app/error.tsx` segment boundary

**Phase 4 — Export PDF/CSV**
- Depends on: nothing from previous phases
- Can be built in parallel with Phase 2 and 3
- Add `lib/export.ts` + `ExportButtons` component
- Dynamic import of jsPDF to avoid SSR

**Phase 5 — Comparative scenarios**
- Depends on: nothing from previous phases (can be built in parallel)
- Extract `CenarioPanel` from cenarios page
- Update `CenariosPage` to support two panels

**Phase 6 — Email alerts**
- Depends on: Phase 1 (structlog already set up for consistent alert logging)
- Requires new DB migration (can deploy independently)
- New `backend/alerts.py` module
- New `AlertForm` frontend component

**Phase 7 — E2E tests**
- Depends on: all previous phases (tests validate the shipped features)
- Build last, or build smoke tests incrementally as each phase ships

---

## Anti-Patterns

### Anti-Pattern 1: Adding Mobile Breakpoints via Inline Styles

**What people do:** Add `style={{ display: isMobile ? 'flex' : 'grid' }}` using a `useWindowSize` hook to fix the mobile layout.

**Why it's wrong:** Causes hydration mismatch (server renders one layout, client re-renders a different one after mount). Produces a visual flash. Harder to maintain than Tailwind breakpoints.

**Do this instead:** Use Tailwind responsive prefixes (`hidden md:flex`, `grid-cols-1 sm:grid-cols-2`). These are resolved at build time in CSS, no JS needed, no hydration issue.

### Anti-Pattern 2: PDF Generation in a Server Action or Route Handler

**What people do:** Attempt to run jsPDF or puppeteer in a FastAPI endpoint to generate PDFs server-side.

**Why it's wrong:** jsPDF is browser-only. Puppeteer would require a browser binary on the Oracle VM (500MB+, 4 vCPUs shared). Results would not include the user's current rendered chart state.

**Do this instead:** Generate PDFs client-side with jsPDF + html2canvas. The chart is already rendered in the browser. Capture the DOM element directly.

### Anti-Pattern 3: Global State for Comparison Panels

**What people do:** Lift scenario comparison state into a React Context or Zustand store when adding the "compare" feature.

**Why it's wrong:** Panels are independent — they share no data. Global state adds complexity without benefit and makes it harder to add a third panel later.

**Do this instead:** Each `CenarioPanel` owns its form state, loading state, and result state. The parent page only tracks "how many panels are visible" (1 or 2).

### Anti-Pattern 4: Polling Alerts from the Frontend Only

**What people do:** Set up a `setInterval` in the dashboard that calls `/api/alerts/check` every 60 seconds.

**Why it's wrong:** Alerts only fire when at least one user has the app open. A user who set an alert and then closed the browser will miss the trigger.

**Do this instead:** Server-side cron job is the primary trigger. Frontend polling is optional UX enhancement (immediate feedback when app is open).

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | `@supabase/ssr` createServerClient in proxy.ts; createBrowserClient in client components | Cookie-based session; JWT RS256 validated locally in FastAPI |
| Supabase PostgreSQL | Direct via Supabase Python client in FastAPI (service role for writes); RLS enforced on all user-owned tables | Never expose service role key to frontend |
| yfinance | FastAPI market_cache.py; custom requests.Session with browser User-Agent (Oracle IPs blocked by Yahoo) | Cache-aside in market_prices table; ttl-based refresh |
| Resend (new) | HTTP POST from `backend/alerts.py` using `resend` Python package | Free tier: 3000 emails/month; needs RESEND_API_KEY env var |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Next.js frontend ↔ FastAPI | fetch() with `Authorization: Bearer <JWT>` header | All API calls go through Nginx proxy; CORS locked to origin |
| Dashboard server component ↔ FastAPI | Server-side fetch with `next: { revalidate: N }` | Runs on Node.js runtime, not Edge; cookies available via createServerSupabaseClient |
| Client components ↔ FastAPI | Browser fetch with token from `supabase.auth.getSession()` | Token fetched fresh before each request; no token refresh loop needed (Supabase handles it) |
| `loading.tsx` ↔ page.tsx | Next.js Suspense boundary (automatic) | Only works for server components; client components need manual skeleton logic |
| E2E tests ↔ staging app | Playwright browser → Nginx → Next.js + FastAPI | Use `storageState` from auth.setup.ts to reuse Supabase session |

---

## Scaling Considerations

This app targets 20–100 internal users on Oracle Cloud Always Free (4 vCPUs, 24GB RAM).

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (20–100 users) | Single VM with Nginx + PM2 is correct. No changes needed for v2.1 features. |
| 100–1k users | Add Redis for alert state (avoid DB polling per alert check). Consider caching simulation results in Redis with short TTL. |
| 1k+ users | Split FastAPI to multiple uvicorn workers behind Nginx `upstream`. Offload MC simulation to a task queue (Celery/Redis) to avoid blocking workers on 10k-path simulations. |

**First bottleneck at current scale:** MC simulation endpoint blocks a uvicorn worker for ~1–3 seconds (10k paths, numpy). With 4 workers (PM2 cluster mode), this supports ~4 concurrent simulation requests. Acceptable for 20–100 users.

**Email alert cron:** The `check_alerts.py` script makes N database queries (one per alert row) + 1 yfinance call + M Resend API calls. At 100 users with 5 alerts each, this is 500 DB rows + 500 potential emails per cron run. PostgreSQL handles this trivially; Resend rate limits at 10 req/s (batch if needed).

---

## Sources

- Direct codebase analysis: `frontend/`, `backend/`, `supabase/migrations/`
- Existing component patterns: all `frontend/components/` directories
- Infrastructure: `nginx/impacto.conf`, `scripts/setup-vm.sh`
- Database schema: all `supabase/migrations/*.sql` files
- Next.js 16 App Router conventions: `loading.tsx`, `error.tsx` file system patterns (HIGH confidence — used consistently in existing codebase)
- shadcn/ui Skeleton: existing shadcn component system (`components.json` config, radix-ui dependency present)
- PDF export pattern (jsPDF + html2canvas): MEDIUM confidence — standard browser-side approach, not verified against 2025 release notes
- Playwright + Next.js: MEDIUM confidence — standard pattern, official Next.js docs recommend Playwright for E2E

---
*Architecture research for: Impacto v2.1 UX Polish & Reliability*
*Researched: 2026-04-04*
