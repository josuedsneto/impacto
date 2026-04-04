# Pitfalls Research

**Domain:** UX Polish & Reliability additions to Next.js 16 App Router + FastAPI + Supabase
**Researched:** 2026-04-04
**Confidence:** HIGH (based on direct codebase inspection + domain knowledge)

---

## Critical Pitfalls

### Pitfall 1: Fixed Sidebar Breaks Mobile — No Toggle Mechanism

**What goes wrong:**
The `app/app/layout.tsx` renders a hard-coded `w-56 flex-shrink-0` `<aside>` in a `flex min-h-screen` container with inline `style={{ background: "#111827" }}`. On narrow viewports this sidebar never collapses — it eats 224px of a 375px screen, leaving the `<main>` with ~150px, making every analytic page unusable. There is no hamburger button, no `md:hidden`, no `translate-x` toggle, no drawer.

**Why it happens:**
Desktop-first development. The sidebar was styled with inline px values rather than Tailwind responsive prefixes, making it invisible to a global "find all fixed widths" grep. Developers add `md:hidden` on the content but forget the sidebar is still visually present and taking space.

**How to avoid:**
The sidebar must become a drawer on mobile. The pattern is: `hidden md:flex` on the aside (desktop-permanent), plus a `Sheet` (shadcn) triggered by a hamburger button visible only on `<md`. The hamburger lives in the `<main>` header bar. State is managed with `useState` in the layout (already a `"use client"` component). The sidebar content is shared via a `NavContent` component to avoid duplication between the drawer and the fixed aside.

Do not try to retrofit `overflow-x: hidden` on `<body>` as a fix — it hides the problem without solving it and breaks sticky/fixed positioning.

**Warning signs:**
- Chrome DevTools mobile emulation (375px) shows layout overflow or a 100%+ body width
- `overflow-x: auto` appearing on `<main>` as a workaround
- Any `style={{ width: NNNpx }}` on structural layout elements (not chart containers)

**Phase to address:**
Phase 1 (Mobile Responsiveness) — must be the first task because every other page depends on the layout shell.

---

### Pitfall 2: Recharts Charts Clip or Overflow on Mobile

**What goes wrong:**
`FanChart` and the distribution chart in `cenarios/page.tsx` use `<ResponsiveContainer width="100%" height={400}>` and `height={260}`. On mobile, `ResponsiveContainer` correctly reads the container width, but if the container has padding, the chart tries to render tick labels (XAxis, YAxis) that are wider than the available space, causing text overflow outside the SVG boundary or label collisions. The `margin={{ left: 10 }}` values that look fine on 1280px fail completely at 375px.

**Why it happens:**
`ResponsiveContainer` makes width adaptive but height is fixed. Axis labels are not responsive. Developers assume Recharts handles all edge cases — it doesn't. Labels are rendered in SVG with fixed character widths and no wrapping.

**How to avoid:**
- Use `height={300}` on mobile, `height={400}` on desktop via a custom hook that reads `window.innerWidth` (already behind `"use client"`).
- Or use a fixed ratio: `aspect={16/9}` on `ResponsiveContainer` instead of fixed `height`.
- Set `tick={{ fontSize: 10 }}` on both axes explicitly.
- Remove YAxis `width` so Recharts auto-sizes it, or set `width={40}` to prevent truncation.
- For the fan chart, set `margin={{ top: 10, right: 10, left: 0, bottom: 30 }}` on mobile to give the X label room.

**Warning signs:**
- SVG overflowing its parent `div` (visible as a horizontal scroll on the chart card)
- X-axis labels overlapping each other or being cut off
- Chart appearing correctly on desktop DevTools mobile emulation but broken on real device (because DevTools DPR scaling doesn't match SVG layout)

**Phase to address:**
Phase 1 (Mobile Responsiveness), specifically after the layout shell is done.

---

### Pitfall 3: Skeleton Shape Mismatch Causes Layout Shift on Load

**What goes wrong:**
shadcn `Skeleton` components are added as placeholders, but their dimensions don't match the actual loaded content. For example, `var/page.tsx` already has an ad-hoc pulse skeleton (`h-24 rounded-lg bg-muted animate-pulse`) but the real `MetricCard` is `Card > CardHeader > CardTitle + CardContent > p.text-2xl`. If the skeleton height (96px) differs from the actual card height (~100px+), the page jumps on hydration — Cumulative Layout Shift (CLS) above 0.1 will be visible and will feel broken.

**Why it happens:**
Skeletons are added quickly by matching a rough visual height. The actual component height depends on padding, font-size, and line-height of the shadcn Card variant, which changes if the shadcn theme is updated.

**How to avoid:**
Build skeleton components that mirror the exact DOM structure of the real component, not just the approximate height. For `MetricCard`: `<Card><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>`. The skeleton uses the same Card wrapper, so padding and border are identical. Height is determined by the same box model as the real content.

Also: never use `h-24` as a skeleton for a card — use the actual card with skeleton internals.

**Warning signs:**
- Visible "jump" when data loads in (elements shift position)
- Different number of skeleton items vs actual items (e.g., 6 skeleton cards but only 4 data cards)
- Skeleton and real content have different `gap` values in their parent grid

**Phase to address:**
Phase 2 (Loading Skeletons & Error States).

---

### Pitfall 4: Retry Logic Without Abort Causes Stacked Inflight Requests

**What goes wrong:**
Adding a retry button to fetch calls like `fetchVar` in `var/page.tsx` seems trivial — call `fetchVar(confidence)` again. But if the user clicks retry while a previous request is still inflight (slow Oracle Cloud → yfinance path can take 5-8 seconds), two requests are now pending. Both will set state on completion, causing a race: whichever resolves last wins, and the UI may briefly flash error then success or vice versa. With aggressive retry UI, users can queue 5+ requests.

**Why it happens:**
The existing fetch pattern doesn't use `AbortController`. The dashboard server-side fetches use `AbortSignal.timeout(8000)` correctly (seen in `dashboard/page.tsx`), but the client-side pages (`var`, `simulation`, `cenarios`) use plain `fetch` with no signal.

**How to avoid:**
Every client-side fetch function must hold a `useRef<AbortController>`. On each call (initial and retry): abort the previous controller, create a new one, pass `signal` to `fetch`. On unmount, abort in `useEffect` cleanup.

```typescript
const abortRef = useRef<AbortController | null>(null);

async function fetchData() {
  abortRef.current?.abort();
  abortRef.current = new AbortController();
  try {
    const res = await fetch(url, { signal: abortRef.current.signal, ... });
    // ...
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return; // ignore
    setError("Erro de conexão.");
  }
}
```

**Warning signs:**
- Network tab showing multiple simultaneous requests to the same endpoint after clicking retry
- State flicker: error message appears then disappears on successful retry
- Console warnings about state updates on unmounted components

**Phase to address:**
Phase 2 (Error States with Retry) — implement alongside the retry UI, not after.

---

### Pitfall 5: PDF Export via html2canvas Captures Dark Mode Incorrectly

**What goes wrong:**
The most common React PDF export approach is `html2canvas` + `jsPDF`. On this app, the dashboard uses `dark mode padrão` and components use `oklch()` color variables (seen in `globals.css`). `html2canvas` has known issues with: (a) CSS custom properties — it doesn't always resolve `oklch()` colors correctly, leaving backgrounds transparent or wrong; (b) SVG charts — Recharts `<ResponsiveContainer>` SVGs are often captured as blank rectangles because `html2canvas` doesn't serialize SVG `<defs>` (gradients, clip paths) correctly.

The cenarios page has a `linearGradient` with `id="colorRisk"` in its chart. This will render as a solid color or transparent in html2canvas output.

**Why it happens:**
`html2canvas` works by re-rendering the DOM into a `<canvas>` element using its own CSS parser. It doesn't execute the browser's actual layout engine, so computed values from CSS variables and SVG internals are often wrong.

**How to avoid:**
Use `@react-pdf/renderer` for data-driven exports (tables, metrics, percentile data) rather than screenshotting. For the fan chart, render the chart data as a `<Path>` in react-pdf, or include a static PNG snapshot rendered server-side. Alternatively, use Playwright's screenshot API on the server to capture the page accurately — but that adds infrastructure complexity.

For v2.1 scope (20–100 users, Oracle Cloud), the pragmatic approach is: generate a structured PDF with `@react-pdf/renderer` containing the numeric data (percentiles table, VaR values, breakeven), and attach a chart image only if the chart can be exported to PNG via `chart.toBase64Image()` (Recharts does not support this — Chart.js does). Consider switching the export chart to Chart.js or accepting text-only PDF for v2.1.

CSV export has no such issues — it's pure data serialization.

**Warning signs:**
- White rectangles where charts should be in the PDF
- Colors appearing wrong (dark backgrounds on white cards, or transparent)
- "SecurityError: Failed to read the 'localStorage' property" from html2canvas trying to access browser APIs

**Phase to address:**
Phase 3 (Export PDF/CSV) — explicitly rule out html2canvas in the phase plan.

---

### Pitfall 6: Email Alerts Cron Job Silently Fails on Oracle Cloud Free Tier

**What goes wrong:**
Price threshold alerts require a polling mechanism — a background task that checks current prices against user-configured thresholds and sends email when crossed. On Oracle Cloud Always Free (the current deploy target), there are two failure modes: (a) if alerts run as a background asyncio task inside FastAPI, they die silently when the process restarts or PM2 reloads; (b) if alerts run as a cron job via system cron, they depend on the VM being awake and the environment being correctly configured, and failures produce no notifications.

**Why it happens:**
FastAPI background tasks (`BackgroundTasks`) are per-request and not suitable for recurring jobs. `asyncio.create_task` at startup is fragile across restarts. System cron has no built-in failure alerting.

**How to avoid:**
Use `APScheduler` (`AsyncIOScheduler`) initialized in the FastAPI `lifespan` context manager. This survives PM2 restarts gracefully and integrates with the existing async FastAPI process. Configure dead-letter behavior: if a scheduled job raises an exception more than N times consecutively, log at ERROR level (so PM2/systemd captures it) and disable the job rather than crashing the process.

The email sending itself should use `smtplib` (stdlib) or `sendgrid` SDK — avoid heavy async email libraries. For v2.1, SMTP via Resend (HTTP API, not SMTP) is the most reliable path on a VM with port 25 likely blocked by Oracle's network policy.

**Warning signs:**
- Price alerts configured by users but no emails ever sent (silent job death)
- PM2 logs showing "Worker restarted" around the time alerts should fire
- Jobs that worked in local dev (unrestricted network) failing on Oracle Cloud (SMTP port 25 blocked)

**Phase to address:**
Phase 4 (Email Alerts) — architecture decision must precede implementation. Test on Oracle VM before writing user-facing UI.

---

### Pitfall 7: Comparative Scenarios Side-by-Side Doubles API Load and Breaks Layout

**What goes wrong:**
"Cenários comparativos lado a lado" means running two independent simulation or scenario requests and rendering them in a split view. The naive implementation runs both fetches sequentially, making the UX feel slow (8-16s for two MC simulations). The parallel implementation uses `Promise.all`, which is correct, but doubles the load on FastAPI — two 10,000-path MC simulations concurrently on the same Python process (FastAPI is async but numpy is CPU-bound and releases the GIL only for I/O). Two concurrent simulations will fully saturate one of the 4 ARM vCPUs for several seconds.

On the layout side, two `<ResponsiveContainer width="100%">` in a `grid-cols-2` grid each get 50% of the page width. At 1280px that's 640px per chart — fine. On mobile it must collapse to stacked.

**Why it happens:**
Developers test with small `num_simulacoes` values locally (fast) and don't notice the CPU saturation until production. The grid layout isn't tested below 768px during development.

**How to avoid:**
- Limit comparative mode to 10,000 simulations (already the max default) and document the expected latency (3-5s per simulation on Oracle ARM).
- Use `Promise.all` — do not serialize the two requests.
- Wrap each chart in its own `<Suspense>` boundary with a skeleton so the first result renders as soon as it's ready.
- The comparison grid must be `grid-cols-1 md:grid-cols-2` — never fixed two-column.
- Add a result cache: if the user has already run simulation A, reuse the stored result (already exists via `api/simulations/{id}`) rather than re-running.

**Warning signs:**
- FastAPI response times doubling under comparison load (visible in PM2 logs)
- Charts rendering at less than 300px width on mobile (chart labels become unreadable)
- Users triggering comparison repeatedly because they don't see both results populating

**Phase to address:**
Phase 5 (Comparative Scenarios) — must explicitly plan concurrent fetch + CPU budget in the phase.

---

### Pitfall 8: E2E Tests Break on JWT Expiry Mid-Suite

**What goes wrong:**
Playwright/Cypress E2E tests that authenticate via Supabase JWT will fail unpredictably when the test suite runs longer than the JWT TTL. Supabase access tokens expire in 1 hour by default. A test suite that runs 45 minutes and then hits a test requiring auth will get 401s that look like app bugs, not test infrastructure issues.

Additionally, E2E tests that log in via the UI (filling email + password form) are slow and fragile — they depend on Supabase Auth rate limits (10 logins/hour per IP on the free tier).

**Why it happens:**
E2E tests are written sequentially without considering token lifecycle. Auth via UI is the "obvious" approach when you see a login form.

**How to avoid:**
- Set up a dedicated test user in Supabase with a long-lived service-role token for E2E (never use the service-role key in frontend tests — use it only in test setup scripts to pre-create sessions).
- Use Playwright's `storageState` to save the authenticated session after a single login at the start of the suite, then reuse it across all tests. Refresh the token before tests that take > 45 minutes.
- For the FastAPI side, create a test JWT signed with the RS256 private key (already used in `auth.py`) — this bypasses Supabase entirely and is the fastest approach for API-level tests.
- Do not run full login flow in every test — authenticate once in `globalSetup`, save state, and restore.

**Warning signs:**
- Tests passing locally (short run) but failing in CI (longer run or cold Supabase start)
- Flaky 401 errors in the middle of the test suite with no code changes
- Test logs showing login form being filled 20+ times

**Phase to address:**
Phase 6 (E2E Tests) — authentication strategy must be decided before writing any test.

---

### Pitfall 9: FastAPI Global Error Handler Hides Structured Logging on Uvicorn

**What goes wrong:**
Adding a FastAPI `@app.exception_handler(Exception)` global handler to return structured JSON error responses is correct — but if the handler calls `logger.error(...)` and then returns a `JSONResponse`, uvicorn's access log will show `500` but the structured log entry goes to stderr without a correlation ID or request context. On Oracle Cloud with PM2, stderr and stdout are merged into a rotating log file. Finding which request caused which error requires grep on timestamps — fragile for 20-100 concurrent users.

Additionally, the existing `SlowAPIMiddleware` raises `RateLimitExceeded`, which bypasses exception handlers added after the middleware in the stack, returning a non-JSON response that the Next.js frontend doesn't expect.

**Why it happens:**
FastAPI's exception handler ordering is non-obvious. Middleware exceptions are not caught by `@app.exception_handler`. The `SlowAPIMiddleware` is currently handling `RateLimitExceeded` correctly via `app.state.limiter` but adding a new global handler may break this existing behavior if not ordered correctly.

**How to avoid:**
- Add the global handler using `@app.exception_handler(Exception)` AFTER all middleware is registered (middleware order is LIFO in Starlette, but exception handlers are router-level).
- Generate a `request_id` (UUID) in a request middleware and attach it to the request state. The exception handler reads `request.state.request_id` and includes it in the error JSON and the log entry.
- Use Python's `logging` with a `JSONFormatter` (e.g., `python-json-logger`) so PM2-captured logs are parseable without regex.
- Verify `RateLimitExceeded` handler still returns JSON after adding the global handler — test with a tight rate limit in the test environment.

**Warning signs:**
- Global handler added but rate limit errors still return plain text `"429 Too Many Requests"`
- Log lines without request IDs making error correlation impossible
- Stack traces appearing in uvicorn stdout mixed with access logs

**Phase to address:**
Phase 6 (Global Error Handler) — implement before E2E tests so tests can validate error response shapes.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline `style={{ ... }}` px values in layout components | Quick to write, no class conflicts | Invisible to Tailwind responsive system; can't use `md:` prefixes on inline styles | Never in layout/structural components; acceptable in chart margins |
| Duplicating `getAccessToken()` in every page file | Self-contained pages | 12+ copies to update when Supabase session API changes | Never — extract to `lib/auth.ts` |
| Silent `catch {}` blocks (seen in `handleHistoryItemClick`) | Prevents crashing | Errors are invisible; impossible to know why history replay fails | Only for truly optional UI enhancements where failure is visually ignorable |
| Text-only error state without retry button | Fast to ship | Users must manually reload the page; high drop-off on transient errors | Never on pages that require API data to function |
| `grid-cols-2` without `sm:grid-cols-1` | Desktop looks right | Mobile layout broken by default | Never — always add the mobile-first column count |
| `max-w-md` / `max-w-2xl` cards without responsive margin | Looks clean on desktop | On 375px, `mx-auto` works but leaves no room if padding is removed | Acceptable — `max-w-*` is fine as long as the card is inside a padded container |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth + E2E tests | Logging in via UI form in every test; hitting rate limits | Use `storageState` after a single `globalSetup` login; refresh token before suite timeout |
| Recharts + PDF export | Passing the chart DOM element to html2canvas | Export chart data as structured table in react-pdf; skip chart PNG or use a separate PNG-capable library |
| APScheduler + FastAPI lifespan | Starting scheduler in a global variable at module import | Start in `@asynccontextmanager` lifespan to ensure clean startup/shutdown with PM2 restarts |
| Oracle Cloud + SMTP | Using port 25 (blocked by Oracle) for email alerts | Use Resend HTTP API or SendGrid HTTP API — not raw SMTP; configure via env var |
| FastAPI + SlowAPI + global exception handler | Adding `@app.exception_handler(Exception)` after SlowAPI breaks rate limit JSON responses | Register `RateLimitExceeded` handler explicitly after registering the global handler |
| Supabase RLS + simulation history | Forgetting RLS policy for the new "compare" fetch pattern that joins two simulation IDs | Verify `api/simulations/{id}` already enforces `user_id = auth.uid()` — it should, but test with a cross-user request |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Two concurrent MC simulations (comparative mode) saturating the GIL | P95+ latency spike; other users see slowdowns | Document expected latency; consider `ProcessPoolExecutor` for CPU-bound simulation if needed in v2.2 | At ~5+ simultaneous comparison requests |
| PDF generation on the client with large JSONB percentile data | Browser tab freezes during `@react-pdf/renderer` render of large datasets | Paginate the percentile series; limit PDF to summary data + P5/P50/P95 line | At 252 days × 5 percentiles × 10,000 paths — don't serialize all paths, only the aggregated series |
| E2E test suite running all pages in sequence | CI takes 30+ minutes; JWT expires mid-run | Run auth-dependent tests in parallel workers; use `--workers 4` in Playwright | At 20+ test files |
| `getAccessToken()` called per-render in client components | Redundant Supabase session reads on every re-render | Lift token to context or useSWR with short TTL | At pages with multiple sub-components each calling `getAccessToken()` individually |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sending alert email content from user-supplied threshold label without sanitization | Potential email header injection if label is used as email subject | Strip newlines and cap length on threshold labels before using in email headers |
| Storing alert polling interval as a frontend env var | Users can inspect `NEXT_PUBLIC_*` and know exact polling cadence | Polling logic lives in backend scheduler — frontend only submits threshold config, never timing |
| Comparative scenario accepting arbitrary `simulation_id` pairs | A user could compare their own simulation with another user's ID if RLS is misconfigured | Test cross-user access: `api/simulations/{other_user_id}` must return 403, not 200 |
| E2E test service-role key committed to the test config file | Full database access from any leaked file | Keep test keys in environment variables or `.env.test` (gitignored); never hardcode in test fixtures |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| "Carregando..." text replacing the entire page on retry | Users lose context of what they were looking at | Show skeleton over existing stale data; only clear on success or after 3 retries |
| PDF file named `export.pdf` generically | Users who export multiple simulations can't distinguish files | Name as `{ticker}_{date}_{type}.pdf` e.g. `SBF_2026-04-04_montecarlo.pdf` |
| Alert threshold UI allowing thresholds below current price for "above" direction | Users set impossible alerts that never fire | Validate threshold server-side and warn client-side if threshold is already crossed |
| Comparative view showing two independent error states without context | Users don't know which simulation failed | Label each panel (Simulação A / Simulação B) clearly in the error message |
| Retry button present but disabled during loading | Users click retry while loading and see no response | Disable retry button only during the retry attempt; show spinner on the button, not replace it |
| Mobile nav hidden with no affordance | Users don't know the sidebar exists | Hamburger button must be visible on the first screen load, not hidden until scroll |

---

## "Looks Done But Isn't" Checklist

- [ ] **Mobile sidebar:** Aside visually hidden on mobile — verify it's not just `overflow: hidden` hiding it while it still takes layout space. Check with `display: none` vs `transform: translateX`.
- [ ] **Loading skeletons:** Skeleton height matches actual component height — measure both in DevTools; CLS score below 0.1.
- [ ] **Retry button:** Abort controller cancels the inflight request — verify in Network tab that the previous request shows "cancelled" not "completed" when retry is clicked.
- [ ] **PDF export:** Chart appears in PDF (not a blank box) — test specifically with the fan chart SVG gradient and the cenarios `linearGradient`.
- [ ] **Email alerts:** Alerts fire on Oracle Cloud VM, not just localhost — test with a threshold that's immediately crossed to verify the full path (scheduler → email API → inbox).
- [ ] **Comparative scenarios:** Cross-user RLS still enforced — test with two accounts where user A tries to load user B's simulation ID via the compare UI.
- [ ] **E2E tests:** Suite passes in CI with a cold Supabase Auth start — not just locally where the session is already warm.
- [ ] **Global error handler:** Rate limit responses are still JSON after adding the handler — test `POST /api/simulations` 60+ times/minute.
- [ ] **getAccessToken duplication:** All client pages use a shared `lib/auth.ts` — grep for `supabase.auth.getSession()` and confirm only one definition exists.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Mobile layout broken after sidebar change | MEDIUM | The sidebar is one component (`app/app/layout.tsx`) — fix is isolated but requires retesting all 15+ pages at mobile width |
| PDF export uses html2canvas and charts are blank | HIGH | Requires switching PDF library and rebuilding export components; budget 2-3 days |
| Email alerts silently not sending on Oracle Cloud | LOW | Check PM2 logs for scheduler exceptions; test SMTP port with `nc -zv smtp.host 587`; switch to HTTP email API |
| E2E tests flaking on JWT expiry | LOW | Add `globalSetup` token refresh; re-run suite once to confirm |
| Global error handler broke rate limiting JSON | LOW | Add explicit `RateLimitExceeded` handler before the general handler; 30-minute fix |
| Stacked concurrent simulation requests on comparative mode | MEDIUM | Add request deduplication in the compare component; cache result by simulation params hash |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Fixed sidebar blocks mobile layout | Phase 1 — Mobile Responsiveness | Chrome DevTools at 375px shows no horizontal overflow; `aside` is not in the DOM on mobile (or `display: none`) |
| Recharts clips on mobile | Phase 1 — Mobile Responsiveness | Charts render correctly at 375px with readable axis labels |
| Skeleton shape mismatch / CLS | Phase 2 — Loading Skeletons | Lighthouse CLS score < 0.1; skeleton and loaded card have identical heights |
| Retry without AbortController | Phase 2 — Error States | Network tab shows cancelled previous request on retry click |
| PDF html2canvas + SVG gradient failure | Phase 3 — Export PDF/CSV | PDF contains chart area without blank boxes; test with cenarios and fan chart |
| Email alerts silent on Oracle Cloud | Phase 4 — Email Alerts | End-to-end test: set threshold, cross it with a test price write, verify email received |
| Comparative mode doubles CPU load | Phase 5 — Comparative Scenarios | Load test: 3 concurrent comparison requests; P95 latency < 10s |
| E2E JWT expiry mid-suite | Phase 6 — E2E Tests | Full test suite passes in CI without token refresh errors |
| FastAPI global handler breaks rate limiting | Phase 6 — Global Error Handler | Automated test: exceed rate limit, assert response is `application/json` with `detail` field |

---

## Sources

- Direct inspection of `frontend/app/app/layout.tsx` (fixed sidebar, inline px styles)
- Direct inspection of `frontend/components/simulation/FanChart.tsx` (Recharts usage)
- Direct inspection of `frontend/app/app/cenarios/page.tsx` (SVG linearGradient, silent catch)
- Direct inspection of `frontend/app/app/var/page.tsx` (ad-hoc skeleton, missing AbortController)
- Direct inspection of `frontend/app/app/simulation/page.tsx` (silent catch on history click)
- Direct inspection of `backend/main.py` (SlowAPIMiddleware, no global error handler, logging setup)
- `PROJECT.md` — Oracle Cloud Always Free constraints, deploy via PM2
- shadcn/ui Skeleton component documentation pattern (component-mirrored skeletons)
- FastAPI exception handler ordering — Starlette docs (exception handlers are router-level, not middleware-level)
- Oracle Cloud networking — port 25 (SMTP) is blocked on Always Free tier by default (known Oracle policy)

---
*Pitfalls research for: Next.js 16 + FastAPI + Supabase UX Polish & Reliability (v2.1)*
*Researched: 2026-04-04*
