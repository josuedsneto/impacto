# Phase 15: Loading Skeletons + Error States - Research

**Researched:** 2026-04-04
**Domain:** React client-side loading UX — skeleton placeholders, error boundaries, AbortController request cancellation
**Confidence:** HIGH

## Summary

Phase 15 adds three behaviors to every client-side data-fetching page: (1) skeleton card placeholders replace blank screens and "Carregando..." text during fetches, (2) a human-readable error message plus "Tentar novamente" button appears on API failure, and (3) clicking retry cancels any in-flight request via AbortController before starting a new one.

The codebase has 12 pages with `loading` state. Six auto-fetch on mount (focus, noticias, var, volatilidade, breakeven, stress) — skeletons show on first page visit. Six are form-triggered (market, metas, risco, simulation, arima, cenarios, jump-diffusion) — skeletons show while calculating. The dashboard page is a Next.js Server Component that fetches server-side; it does not need client-side skeleton or retry logic. The VaR page already has a hand-rolled `animate-pulse` div approach — this gets replaced with the standard Skeleton component as part of this phase.

No skeleton component exists in `components/ui/` yet. It must be installed via `npx shadcn@latest add skeleton`. AbortController is not used anywhere in app code — all pages need it added. The REQUIREMENTS.md explicitly rules out TanStack Query and SWR as out of scope; AbortController with `useRef` is the mandated pattern.

**Primary recommendation:** Install `shadcn skeleton`, create a shared `useApiCall` hook that wraps fetch with AbortController + loading/error state, then apply it to all 12 data-fetching pages.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REL-03 | User sees skeleton placeholders while data is fetching (no blank screen or "Carregando..." text) | shadcn Skeleton component installed via CLI; applied to all 12 pages per their card layout shape |
| REL-04 | User sees error message + retry button when any API call fails | Error state already exists on all pages; needs standardized ErrorState component with "Tentar novamente" button wired to re-invoke the fetch |
| REL-05 | Retry cancels the previous in-flight request (AbortController pattern) | `useRef<AbortController>` pattern; abort previous before creating new; confirmed as the project-mandated pattern (TanStack Query/SWR explicitly out of scope) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn skeleton | (added via CLI) | Animated placeholder UI during loading | Project already uses shadcn new-york/zinc; consistent with existing Card, Button, etc. |
| AbortController | Browser built-in | Cancel in-flight fetch requests | Web standard; no install needed; project REQUIREMENTS.md mandates this pattern |
| React useRef | React 19.2.4 | Hold AbortController across renders without re-render | Standard React hook for mutable values |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 (already installed) | AlertCircle / RefreshCw icons in error state | Error state UI visual affordance |
| shadcn Button | already installed | "Tentar novamente" button | Already used on all pages |
| shadcn Card | already installed | Skeleton card layout wrapper | Matches the result card shape |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AbortController + useRef | TanStack Query / SWR | Explicitly out of scope in REQUIREMENTS.md — overkill for current API surface |
| shadcn Skeleton | hand-rolled `animate-pulse div` | VaR page already does this; inconsistent sizing and no semantic wrapper; Skeleton is 3-line install |
| inline error JSX | Error Boundary | Error boundaries catch render errors, not fetch errors; async fetch errors must be caught in try/catch — boundaries don't apply here |

**Installation:**
```bash
cd frontend && npx shadcn@latest add skeleton
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── components/
│   ├── ui/
│   │   └── skeleton.tsx          # added by shadcn CLI
│   └── shared/
│       └── ErrorState.tsx        # reusable error message + retry button
├── hooks/
│   └── useApiCall.ts             # shared AbortController + loading/error wrapper
└── app/app/
    ├── focus/page.tsx            # apply hook
    ├── noticias/page.tsx         # apply hook
    ├── var/page.tsx              # apply hook (replace hand-rolled pulse)
    ├── volatilidade/page.tsx     # apply hook
    ├── breakeven/page.tsx        # apply hook
    ├── stress/page.tsx           # apply hook
    ├── market/page.tsx           # apply hook
    ├── metas/page.tsx            # apply hook
    ├── risco/page.tsx            # apply hook
    ├── simulation/page.tsx       # apply hook
    ├── arima/page.tsx            # apply hook
    ├── cenarios/page.tsx         # apply hook
    └── jump-diffusion/page.tsx   # apply hook
```

### Pattern 1: useApiCall Hook
**What:** A custom hook that wraps `fetch` calls with AbortController, loading state, and error state. Returns `{ loading, error, execute }` where `execute` is a stable async function that cancels any prior request before issuing a new one.
**When to use:** Every client-side page that calls `/api/*` endpoints.
**Example:**
```typescript
// hooks/useApiCall.ts
import { useRef, useState, useCallback } from "react";

export function useApiCall<T>(
  fetcher: (signal: AbortSignal) => Promise<T>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Cancel previous in-flight request (REL-05)
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await fetcher(controller.signal);
      setData(result);
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // cancelled — don't update state
      setError(err instanceof Error ? err.message : "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  return { loading, error, data, execute };
}
```

### Pattern 2: ErrorState Component
**What:** A shared UI component showing a human-readable error message and a "Tentar novamente" button.
**When to use:** Render when `error !== null` in any data-fetching page, replacing inline `<p className="text-sm text-red-600">` patterns.
**Example:**
```typescript
// components/shared/ErrorState.tsx
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
```

### Pattern 3: Skeleton Card Placeholders (REL-03)
**What:** Replace `{loading && <p>Carregando...</p>}` blocks with skeleton cards that mirror the real content shape.
**When to use:** On every page where data has not yet loaded AND an error has not occurred.
**Example — metric card skeleton (used on var, volatilidade pages):**
```typescript
// Source: https://ui.shadcn.com/docs/components/skeleton
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  );
}

// In the page:
{loading && (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
    {Array.from({ length: 6 }).map((_, i) => <MetricCardSkeleton key={i} />)}
  </div>
)}
```

### Pattern 4: AbortController with Signal in fetch
**What:** Pass `signal` from the AbortController into every `fetch` call so the browser cancels the network request.
**Example:**
```typescript
const res = await fetch(`${API}/api/var?${params}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
  signal, // from AbortController — cancels on .abort()
});
```

### Pattern 5: Page Two-Phase States (auto-fetch pages)
**What:** Pages that auto-fetch on mount (focus, noticias, var, volatilidade, breakeven, stress) should initialize `loading: true` so skeletons appear immediately — never a blank screen on first paint.
**Example:**
```typescript
// Initialize loading=true so skeleton shows on first render
const [loading, setLoading] = useState(true);

useEffect(() => {
  execute(); // triggers fetch immediately
}, [execute]);
```

### Page Classification

| Page | Fetch Trigger | Skeleton Shape | AbortController Needed |
|------|--------------|----------------|----------------------|
| focus | auto on mount | 4 metric cards | yes |
| noticias | auto on mount | 5 news card rows | yes |
| var | auto on mount (+ confidence change) | 6 metric cards (already has pulse — replace) | yes |
| volatilidade | auto on mount | 3 metric cards + chart | yes |
| breakeven | auto on mount + form | calc result cards | yes |
| stress | auto on mount | result cards | yes |
| market | form submit | price table rows | yes |
| metas | button click | heatmap + chart cards | yes |
| risco | button click | 3 distribution cards | yes |
| simulation | form submit (SimulationForm) | metrics + chart | yes |
| arima | auto on mount | chart card | yes |
| cenarios | form submit | result cards | yes |
| jump-diffusion | auto on mount | chart card | yes |

### Anti-Patterns to Avoid
- **`{loading && <p>Carregando...</p>}`:** Violates REL-03. Replace with skeleton card placeholders.
- **`{loading ? "Calculando..." : "Calcular"}` in button + no skeleton:** This only disables the button but shows no placeholder for the result area. Keep the button text, AND add skeleton in result area.
- **Setting `loading: false` as initial state on auto-fetch pages:** Causes a flash of "no content" before the fetch starts. Initialize `loading: true`.
- **Updating state after AbortError:** Check `if (err.name === "AbortError") return` before calling `setError`. Otherwise a cancelled request overwrites a new in-flight one's state.
- **Using `useCallback` without stable `fetcher` reference:** The `fetcher` function passed to `useApiCall` should be defined with `useCallback` in the consuming component to prevent infinite effect loops.
- **Not passing `signal` to fetch:** AbortController only works if `signal` is passed into the `fetch` call. Forgetting it means `.abort()` does nothing at the network level.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated placeholder shape | Custom div with `animate-pulse` + manual sizing | shadcn `<Skeleton>` | Already consistent with project's shadcn theme; avoids VaR page's ad-hoc inline approach |
| Request deduplication / caching | Custom Map of in-flight requests | AbortController ref per fetch trigger | Sufficient for single-user-action cancel; TanStack Query explicitly out of scope |
| Global error toast | Custom toast state | `sonner` (already installed) | Sonner is already used on market page for error toasts; keep consistent |

**Key insight:** The project already has AbortSignal.timeout() on the server-side dashboard fetches. The same pattern extended to client-side with `useRef<AbortController>` is the natural fit.

## Common Pitfalls

### Pitfall 1: Stale Closure in fetchCallback
**What goes wrong:** The `fetcher` function captures stale state variables (e.g., `ticker`, `confidence`) from render scope, so retries use old values.
**Why it happens:** `useCallback` dependency array was incomplete.
**How to avoid:** Include all variables used inside `fetcher` in the `useCallback` deps array. The AbortController ref itself does not need to be in deps (it's a ref).
**Warning signs:** Retry always fetches the same data regardless of current form inputs.

### Pitfall 2: Double-fetch on StrictMode
**What goes wrong:** In React 19 StrictMode (development), effects run twice. If `execute()` is called in `useEffect` without abort cleanup, two requests fire.
**Why it happens:** React StrictMode mounts/unmounts/remounts components in dev to detect side effects.
**How to avoid:** Return a cleanup function from `useEffect` that calls `abortRef.current?.abort()`. This ensures the first mount's request is cancelled when StrictMode remounts.
**Warning signs:** Network tab shows duplicate requests in development but not production.

### Pitfall 3: LoadingSkeleton shown during idle (form-triggered pages)
**What goes wrong:** On pages where data is only fetched after a button click (metas, risco, market, simulation), initializing `loading: true` shows skeletons before any user action — confusing.
**Why it happens:** Copying the auto-fetch pattern without distinguishing idle state.
**How to avoid:** For form-triggered pages, use a tri-state: `"idle" | "loading" | "done"`. Show nothing (or a prompt) in idle, skeleton in loading, results in done.
**Warning signs:** Page shows skeleton cards immediately on load with no data ever arriving.

### Pitfall 4: AbortError triggers error state
**What goes wrong:** AbortError is treated as a real API error, showing "Erro de conexão" to the user while a retry is already in progress.
**Why it happens:** Generic `catch` block doesn't distinguish abort from network errors.
**How to avoid:** Always check `if ((err as Error).name === "AbortError") return;` before calling `setError`.
**Warning signs:** Error message flashes briefly when user clicks "Tentar novamente".

### Pitfall 5: VaR page skeleton replacement
**What goes wrong:** VaR page already has `Array.from({ length: 6 }).map(() => <div className="h-24 rounded-lg bg-muted animate-pulse" />)` — leaving it co-existing with the new Skeleton component creates visual inconsistency.
**Why it happens:** Partial migration.
**How to avoid:** In the same task that installs Skeleton, replace the VaR hand-rolled pulse divs with `<MetricCardSkeleton>` components using the new Skeleton primitive.
**Warning signs:** VaR page skeleton looks different from other pages.

## Code Examples

Verified patterns from official sources:

### Skeleton Installation (shadcn CLI)
```bash
# Source: https://ui.shadcn.com/docs/components/skeleton
cd frontend && npx shadcn@latest add skeleton
```
This creates `components/ui/skeleton.tsx` with:
```typescript
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

### AbortController useRef Pattern
```typescript
// Pattern: cancel previous request before issuing new one (REL-05)
const abortRef = useRef<AbortController | null>(null);

async function execute() {
  abortRef.current?.abort();                   // cancel previous
  const controller = new AbortController();
  abortRef.current = controller;

  setLoading(true);
  setError(null);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,               // wire abort
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.detail ?? data.error ?? "Erro ao carregar dados.");
      return;
    }
    setData(data);
  } catch (err) {
    if ((err as Error).name === "AbortError") return; // ignore cancelled
    setError("Erro de conexão com o servidor.");
  } finally {
    setLoading(false);
  }
}
```

### useEffect cleanup for StrictMode safety
```typescript
useEffect(() => {
  execute();
  return () => abortRef.current?.abort(); // cleanup on unmount
}, []); // only on mount
```

### Tri-state for form-triggered pages
```typescript
type FetchState = "idle" | "loading" | "done";
const [fetchState, setFetchState] = useState<FetchState>("idle");

// In JSX:
{fetchState === "loading" && <ResultSkeleton />}
{fetchState === "done" && error && <ErrorState message={error} onRetry={execute} />}
{fetchState === "done" && !error && data && <ResultCards data={data} />}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<p>Carregando...</p>` text | Skeleton card placeholders | This phase | REL-03 satisfied |
| `<p className="text-red-600">{error}</p>` (no retry) | `<ErrorState>` with "Tentar novamente" button | This phase | REL-04 satisfied |
| No request cancellation | `useRef<AbortController>` abort-before-refetch | This phase | REL-05 satisfied |
| VaR hand-rolled animate-pulse | shadcn `<Skeleton>` | This phase | Consistent UI |

**Deprecated/outdated in this codebase:**
- All `{loading && <p>Carregando...</p>}` patterns: replaced with skeleton placeholders
- Inline `<p className="text-sm text-red-600">{error}</p>` without retry: replaced with `<ErrorState>`

## Open Questions

1. **Should SimulationForm.tsx get skeleton treatment for its params fetch?**
   - What we know: `SimulationForm.tsx` has a `useEffect` that fetches `GET /api/params/:ticker` to pre-fill `precoInicial`. This is a pre-form-render fetch, not a result fetch. The loading state currently sets `precoInicial` to 0 until data arrives.
   - What's unclear: Whether showing a skeleton for the price input specifically (vs. the whole form) is needed for REL-03 compliance, or if disabling the input is sufficient.
   - Recommendation: Apply a skeleton to the `precoInicial` input field label area during initial params load; show "—" placeholder; no skeleton for entire form.

2. **Shared `useApiCall` hook vs. inline per-page pattern**
   - What we know: 12 pages all need the same AbortController + loading/error logic. A shared hook eliminates duplication.
   - What's unclear: Whether a generic hook adds enough complexity to warrant extraction vs. inlining the 15-line pattern per page.
   - Recommendation: Extract the hook (`hooks/useApiCall.ts`) — it is straightforward and prevents 12-way drift. Pages that have multiple independent fetches (e.g., simulation page has a history fetch AND a params fetch) will use the hook twice.

3. **Dashboard page scope**
   - What we know: `app/app/dashboard/page.tsx` is a Next.js Server Component. It fetches with `next: { revalidate }` and `AbortSignal.timeout()`. Errors return empty data silently, not visible errors to user.
   - What's unclear: Whether REL-03/REL-04 apply to the server-rendered dashboard.
   - Recommendation: Dashboard is out of scope for this phase. Server Component loading uses Next.js Suspense + `loading.tsx` (separate pattern). The dashboard has no "Tentar novamente" flow. If needed, add a `app/app/dashboard/loading.tsx` skeleton file as a bonus task only.

## Sources

### Primary (HIGH confidence)
- https://ui.shadcn.com/docs/components/skeleton — Skeleton component API, installation command, usage pattern
- Browser Web API (AbortController) — built-in; no version concerns; verified via MDN standard

### Secondary (MEDIUM confidence)
- Codebase audit of all 12 data-fetching pages (direct file reads) — confirmed current loading patterns, no existing Skeleton usage, no existing AbortController usage in app code

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — shadcn skeleton confirmed via official docs; AbortController is a Web Standard; no third-party dependencies needed
- Architecture: HIGH — based on direct codebase reading of all 12 affected pages; patterns are straightforward extensions of existing code
- Pitfalls: HIGH — StrictMode double-effect, AbortError swallowing, and idle-vs-loading tri-state are well-established React patterns with clear mitigations

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable patterns; AbortController and shadcn skeleton API highly stable)
