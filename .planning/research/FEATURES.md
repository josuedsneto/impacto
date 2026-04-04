# Feature Research

**Domain:** Financial risk analysis web platform (sugar futures, FX, Monte Carlo, options)
**Researched:** 2026-04-04
**Confidence:** HIGH (based on codebase audit + domain knowledge of financial web apps)

---

## Feature Landscape — v2.1 UX Polish & Reliability

This research covers the nine features planned for v2.1, categorized by their nature in financial web apps: table stakes (expected), differentiators (competitive advantage), and anti-features (traps to avoid).

---

### Table Stakes (Users Expect These)

Features that internal traders and mill managers expect in any professional tool. Missing these makes the platform feel unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Mobile responsiveness | Traders check positions on phones; broken layouts lose trust immediately | MEDIUM | Current `page.tsx` uses inline `style={}` objects with pixel values — no responsive breakpoints at all. Requires systematic conversion to Tailwind responsive classes across all app pages. shadcn/ui is mobile-ready; the gap is layout structure. |
| Loading skeletons | Any web app fetching data must show progress. Blank screens feel like crashes. | LOW | shadcn/ui ships `<Skeleton />` component. Pattern: replace conditional renders with skeleton placeholders sized to match content dimensions. Applied to: fan chart, prices table, analytics KPIs. |
| Error states with retry | API calls to FastAPI and yfinance fail. Users need to know why and what to do. | LOW | Currently errors likely surface as blank content or unhandled promise rejections. Need: error boundary at route level + inline error UI with retry button per data section. FastAPI already returns structured errors; frontend must consume them. |
| Global backend error handler | Unhandled FastAPI exceptions currently return 500 with Python tracebacks. Production apps must sanitize errors and log them. | LOW | FastAPI `@app.exception_handler(Exception)` + logging. Replaces raw tracebacks with `{"error": "...", "code": "..."}`. Single phase, minimal surface area. |
| Export to CSV | Traders copy simulation results to Excel. This is non-negotiable for any financial tool. | LOW | Browser-side: build CSV string from response JSON + trigger download via `Blob` + `URL.createObjectURL`. No server-side work needed for simulation, VaR, breakeven data. |

### Differentiators (Competitive Advantage)

Features that make the platform genuinely more useful than a generic finance tool for sugar market participants specifically.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Export to PDF | Managers need formatted reports for board meetings and client presentations. CSV is for analysts; PDF is for decision-makers. | MEDIUM | Two viable approaches: (1) `window.print()` with a `@media print` stylesheet — zero dependencies, works for simple layouts; (2) `@react-pdf/renderer` for fully programmatic PDFs. For fan chart (SVG/canvas), approach (1) is simpler: Recharts renders to SVG which prints cleanly. Recommend `@media print` first; `react-pdf` only if layout control is needed. |
| Saved simulations history page | Supabase already persists simulation results (v2.0). A dedicated history page with search/filter lets users replay past analyses without re-running. Differentiates from stateless tools. | MEDIUM | Backend: already stores JSONB percentiles per simulation. Frontend: query `simulations` table, render list with replay link. Key UX: click row → pre-fill form → show stored fan chart from saved percentiles (no re-run needed). Avoid fetching all rows at once — paginate or limit to last 50. |
| Comparative scenarios (side-by-side) | Sugar mills run "what if" analyses: "what if price drops 10%?" vs. "what if volatility spikes?" Side-by-side comparison of two fan charts is high value for risk managers. | MEDIUM | Approach: load two saved simulations from history (or run two concurrently) and render them in a split-pane layout with synchronized axes. Recharts supports rendering two `<LineChart>` or `<AreaChart>` side by side with shared domain. Key constraint: axes must use the same Y scale for comparison to be valid. |
| Email alerts for price thresholds | Traders want to be notified when sugar crosses a price level (e.g., SB=F > 20 cents). Keeps them in the app ecosystem even when not actively logged in. | HIGH | Most complex feature in v2.1. Requires: (1) alert config UI (ticker, threshold, direction, email); (2) backend storage of alert rules; (3) scheduler (APScheduler or cron) to poll prices against rules; (4) email sending (SMTP or Supabase email via Resend/SendGrid). Oracle Cloud has no managed scheduler — APScheduler in-process or a separate cron script. Email delivery needs an external SMTP service. |
| E2E tests (Playwright) | Automated smoke tests catch regressions before they reach users. Especially important for auth flows and simulation submission, which are stateful. | MEDIUM | Playwright is the standard for Next.js E2E. Tests needed: login flow, simulation submit + fan chart render, export button, admin approve ticker. Run in GitHub Actions CI. Requires a test Supabase project or mocked credentials — can use env var overrides. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time price websockets | "Live" price display sounds impressive | yfinance does not support streaming; Oracle Always Free has no managed WebSocket gateway; adds connection management complexity for 20-100 users | Poll `/api/market/status` every 60 seconds on the dashboard. Sufficient for commodity futures which update infrequently during trading hours. |
| In-browser PDF with complex chart layouts | Users want pixel-perfect PDF with embedded fan charts | `html2canvas` + `jsPDF` is brittle (CORS issues with images, font rendering differences, async timing bugs, canvas DPI mismatch). High maintenance cost. | Use `@media print` CSS for the fan chart page (Recharts SVG prints natively). For structured reports without charts, `@react-pdf/renderer` is reliable. Never combine html2canvas + jsPDF for production use. |
| Simulation reproducibility (seed) | "Run the same simulation again and get the same result" | Already marked out of scope in PROJECT.md. Seeded numpy random adds API surface, complicates caching, and the value is low for risk analysis (you want distribution, not a single path). | Show the saved percentiles from history — this gives stable reference without reproducibility complexity. |
| Push notifications (browser) | Traders want alerts in-browser | Requires service worker registration, push subscription management, a push server (Web Push Protocol), and ongoing subscription renewal. Disproportionate complexity for 20-100 internal users. | Email alerts (SMTP) cover 95% of the use case with 10% of the complexity. |
| Bulk export of all history | "Export everything" button | Generates potentially large files, blocks the UI, and rarely used in practice. Risk of timeout on Oracle Cloud. | Export individual simulation results. If bulk is needed later, implement as a background job with download link. |

---

## Feature Dependencies

```
[Mobile Responsiveness]
    -- foundation for --> [All other UI features]

[Loading Skeletons]
    -- requires --> [identified async data-fetch boundaries in each page]

[Error States with Retry]
    -- enhances --> [Loading Skeletons] (same fetch lifecycle)
    -- requires --> [Global Backend Error Handler] (structured error payloads to display)

[Global Backend Error Handler]
    -- required by --> [Error States with Retry]
    -- independent of all other features]

[Export CSV]
    -- requires --> [simulation result data in frontend state] (already exists in v2.0)
    -- enhances --> [Saved Simulations History Page]

[Export PDF]
    -- requires --> [Export CSV] to be implemented first (same trigger point in UI)
    -- requires --> [fan chart renders as SVG] (already true with Recharts)

[Saved Simulations History Page]
    -- requires --> [Supabase simulations table with JSONB percentiles] (already exists v2.0)
    -- required by --> [Comparative Scenarios]
    -- required by --> [Export from history]

[Comparative Scenarios]
    -- requires --> [Saved Simulations History Page] (to select two simulations)
    -- enhances --> [Export PDF] (comparison view is high-value export target)

[Email Alerts]
    -- requires --> [market price polling mechanism] (market_cache.py already fetches prices)
    -- requires --> [user alert config storage] (new table in Supabase)
    -- requires --> [external SMTP service] (Resend or SendGrid)
    -- independent of --> all other v2.1 features

[E2E Tests]
    -- requires --> [all other features stable] (tests verify existing functionality)
    -- enhances --> [CI/CD pipeline] (already exists via GitHub Actions)
    -- depends on --> [Mobile Responsiveness] being done (test on mobile viewport too)
```

### Dependency Notes

- **Error States require Global Backend Error Handler:** The frontend error UI is useless if the backend returns unstructured 500 tracebacks. Backend handler must ship first (or in the same phase).
- **Comparative Scenarios requires Saved Simulations History:** The selection mechanism for "pick two simulations to compare" depends on the history page existing. Cannot be built in isolation.
- **Email Alerts is independent:** It has no dependencies on other v2.1 features and has the highest complexity. It can be phased last or in parallel.
- **Export (CSV/PDF) requires existing frontend state:** The simulation result object is already in React state in `simulation/page.tsx`. Both exports are client-side operations on existing data — no new backend endpoints needed for basic export.
- **E2E Tests should be last:** Tests validate the complete stack. Writing them before features are stable wastes effort.

---

## MVP Definition for v2.1

### Launch With (Phase 1-2 of v2.1)

Minimum viable improvements — highest user-visible impact, lowest risk.

- [ ] Global backend error handler — blocks correct error display in frontend; low effort, high payoff
- [ ] Error states with retry — currently broken UX on any API failure; matches backend handler
- [ ] Loading skeletons — immediate perceived performance improvement; low effort
- [ ] Mobile responsiveness — inline styles in `page.tsx` are broken on mobile; critical for trust

### Add After Foundation (Phase 3-4 of v2.1)

Features that require the foundation to be stable first.

- [ ] Export CSV — high demand from traders; client-side only, low risk
- [ ] Export PDF — requires CSS print strategy decision; medium effort
- [ ] Saved simulations history page — data is already in Supabase; needs UI + pagination

### High Value, Higher Effort (Phase 5-6 of v2.1)

- [ ] Comparative scenarios — requires history page; high analytical value
- [ ] E2E tests — validates all of the above; should cover auth, simulation, export flows
- [ ] Email alerts — highest complexity; external dependency (SMTP); schedule last

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Mobile responsiveness | HIGH | MEDIUM | P1 |
| Loading skeletons | HIGH | LOW | P1 |
| Error states + retry | HIGH | LOW | P1 |
| Global backend error handler | HIGH | LOW | P1 |
| Export CSV | HIGH | LOW | P1 |
| Saved simulations history page | MEDIUM | MEDIUM | P2 |
| Export PDF | MEDIUM | MEDIUM | P2 |
| Comparative scenarios | HIGH | MEDIUM | P2 |
| E2E tests | MEDIUM | MEDIUM | P2 |
| Email alerts | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have — directly fixes broken/missing UX
- P2: Should have — significant analytical value, moderate effort
- P3: Nice to have — high complexity relative to internal user base size (20-100 users)

---

## Implementation Notes by Feature

### Mobile Responsiveness
The homepage `page.tsx` uses inline `style={}` objects throughout with pixel dimensions (e.g., `padding: '56px 48px'`, `fontSize: 36`). This will break on mobile (320-768px viewports). The app pages under `/app/` likely have similar issues given the same code style.

Approach: systematic conversion to Tailwind responsive utility classes (`sm:`, `md:`, `lg:` breakpoints). shadcn/ui components are already mobile-ready. The layout `app/app/layout.tsx` sidebar likely collapses to a hamburger on mobile.

### Loading Skeletons
shadcn/ui `<Skeleton />` component is already available (it's part of the new-york theme). Pattern per page:
```
if (loading) return <SkeletonVariant />
return <ActualContent data={data} />
```
Size skeletons to approximate actual content height to avoid layout shift.

### Error States
FastAPI currently raises `HTTPException` with detail strings. The global handler should standardize to `{"error": "human-readable", "code": "MACHINE_CODE"}`. Frontend: each data-fetching component wraps in try/catch, shows `<ErrorAlert message={error} onRetry={refetch} />`.

### Export CSV
No library needed. Build CSV string:
```typescript
const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
const blob = new Blob([csv], { type: 'text/csv' })
const url = URL.createObjectURL(blob)
// trigger <a download> click
```

### Export PDF
Use `@media print` + `window.print()` as first approach. Add a `print:hidden` class to navigation and controls, keep chart and metrics visible. Recharts SVG renders cleanly to print. This avoids all library dependencies.

### Email Alerts
Requires a decision on SMTP provider. Resend is recommended: modern API, free tier (3,000 emails/month), Python SDK. APScheduler (already likely in requirements or easy to add) handles the polling loop inside FastAPI on startup. Alert rules stored in a new `price_alerts` table in Supabase with RLS.

### E2E Tests (Playwright)
Playwright is the right choice for Next.js 16 + Supabase auth. Test file structure:
- `tests/auth.spec.ts` — login, magic link redirect
- `tests/simulation.spec.ts` — submit form, wait for fan chart
- `tests/export.spec.ts` — click CSV download, verify file
- `tests/admin.spec.ts` — approve ticker

GitHub Actions: add `playwright` job to CI after build step. Use test Supabase project credentials from GitHub Secrets.

---

## Competitor Feature Analysis

| Feature | Bloomberg Terminal | Generic Fintech SaaS | Our Approach |
|---------|-------------------|---------------------|--------------|
| Mobile support | Native app (separate) | Fully responsive | Responsive web (sufficient for internal tool) |
| Export | CSV + Excel + PDF | CSV standard, PDF premium | CSV free, PDF via print stylesheet |
| Alerts | Real-time (push) | Email + SMS | Email only (fits 20-100 internal users) |
| Scenario comparison | Multi-scenario workspace | Rarely offered | Side-by-side fan charts, shared Y-axis |
| Simulation history | Saved workbooks | Audit log | Replay from stored percentiles in Supabase |

---

## Sources

- Codebase audit: `/c/Users/netin/OneDrive/Documentos/Code/impacto/frontend/` and `/c/Users/netin/OneDrive/Documentos/Code/impacto/backend/` (HIGH confidence — direct inspection)
- `.planning/PROJECT.md` — feature requirements and out-of-scope list (HIGH confidence)
- shadcn/ui component availability: `frontend/package.json` + `components.json` confirms shadcn/ui new-york theme installed (HIGH confidence)
- FastAPI exception handling pattern: FastAPI official docs, `@app.exception_handler` (HIGH confidence — stable API since FastAPI 0.63)
- Playwright for Next.js: official Playwright docs, well-established pattern as of 2025 (HIGH confidence)
- `@react-pdf/renderer` vs `html2canvas+jsPDF` tradeoffs: training knowledge + known production issues with canvas-based PDF (MEDIUM confidence — verify library versions before implementation)
- Resend as SMTP provider: training knowledge, free tier and Python SDK available (MEDIUM confidence — verify current pricing/limits before committing)

---

*Feature research for: Impacto v2.1 UX Polish & Reliability*
*Researched: 2026-04-04*
