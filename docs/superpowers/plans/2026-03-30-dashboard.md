# Dashboard Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the new Impacto dashboard — light-mode SaaS layout with live price cards, news feed, Focus BCB widget, account summary, and tool navigation cards.

**Architecture:** Server Component page fetches prices + focus + account summary in parallel (with 8 s timeouts to prevent 504s); NewsFeed fetches client-side; all other components receive data as props. Sidebar is updated with grouped dark nav; existing components are restyled for light mode.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS · FastAPI (Python) · `python-bcb` package · Supabase auth

---

## File Map

| File | Action |
|------|--------|
| `backend/requirements.txt` | Add `python-bcb` |
| `backend/main.py` | Add `GET /api/focus` endpoint |
| `frontend/app/app/layout.tsx` | Rewrite sidebar (dark, grouped, no icons) |
| `frontend/app/app/dashboard/page.tsx` | Rewrite page with new layout + all fetches |
| `frontend/components/dashboard/PriceCard.tsx` | Rewrite for light mode + mini bar chart |
| `frontend/components/dashboard/TickerTape.tsx` | Update props to accept focus data |
| `frontend/components/dashboard/NewsFeed.tsx` | Restyle for light mode |
| `frontend/components/dashboard/FocusWidget.tsx` | New component |
| `frontend/components/dashboard/AccountSummary.tsx` | New component |
| `frontend/components/dashboard/ToolGrid.tsx` | New component |

---

## Task 1: Backend — `GET /api/focus` endpoint

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/main.py`

- [ ] **Step 1: Add `python-bcb` to backend requirements**

Open `backend/requirements.txt` and add this line:

```
python-bcb
```

- [ ] **Step 2: Add the `/api/focus` endpoint to `backend/main.py`**

Add this import at the top of `backend/main.py` (after existing imports):

```python
from datetime import timedelta
```

Then add this endpoint **after** the `/api/health` route:

```python
@app.get("/api/focus")
async def get_focus(user: Annotated[dict, Depends(get_current_user)]):
    """
    Returns latest BCB Focus report medians for IPCA, Câmbio, Selic, PIB Total
    for the current calendar year, plus the delta vs the reading from ~7 days ago.
    Falls back to None values if the BCB API is unavailable.
    """
    import asyncio
    from bcb import Expectativas

    current_year = str(date_type.today().year)
    today = date_type.today()
    week_ago = today - timedelta(days=9)  # buffer for weekends

    indicators = ["IPCA", "Câmbio", "Selic", "PIB Total"]
    result = {}

    def fetch_indicator(name: str) -> dict:
        try:
            expec = Expectativas()
            ep = expec.get_endpoint("ExpectativasMercadoAnuais")
            data = (
                ep.query()
                .filter(ep.Indicador == name)
                .filter(ep.DataReferencia == current_year)
                .filter(ep.baseCalculo == 0)
                .filter(ep.Data >= str(week_ago))
                .filter(ep.Data <= str(today))
                .collect()
            )
            if data.empty:
                return {"value": None, "delta": None}
            data = data.sort_values("Data")
            latest = float(data.iloc[-1]["Mediana"])
            if len(data) >= 2:
                prior = float(data.iloc[0]["Mediana"])
                delta = round(latest - prior, 4)
            else:
                delta = None
            return {"value": round(latest, 4), "delta": delta}
        except Exception:
            return {"value": None, "delta": None}

    # Run all indicator fetches in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, fetch_indicator, name)
        for name in indicators
    ]
    values = await asyncio.gather(*tasks)

    key_map = {"IPCA": "ipca", "Câmbio": "cambio", "Selic": "selic", "PIB Total": "pib"}
    for name, val in zip(indicators, values):
        result[key_map[name]] = val

    result["ano_referencia"] = current_year
    return result
```

- [ ] **Step 3: Test the endpoint manually**

SSH into the VM and run:
```bash
curl -s http://localhost:8000/api/focus -H "Authorization: Bearer <any-valid-token>" | python3 -m json.tool
```

Expected shape:
```json
{
  "ipca":   {"value": 5.12, "delta": 0.04},
  "cambio": {"value": 5.90, "delta": 0.10},
  "selic":  {"value": 13.75, "delta": 0.0},
  "pib":    {"value": 2.08, "delta": 0.13},
  "ano_referencia": "2026"
}
```

If BCB is unavailable all values will be `null` — that is expected graceful degradation.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/main.py
git commit -m "feat(backend): add GET /api/focus endpoint with BCB market expectations"
```

---

## Task 2: Sidebar — update `layout.tsx`

**Files:**
- Modify: `frontend/app/app/layout.tsx`

- [ ] **Step 1: Rewrite the sidebar layout**

Replace the entire contents of `frontend/app/app/layout.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Mercado",
    items: [
      { href: "/app/simulation", label: "Monte Carlo" },
      { href: "/app/options", label: "Payoff Opções" },
      { href: "/app/pricing", label: "Precificação" },
      { href: "/app/volatility", label: "Volatilidade" },
    ],
  },
  {
    label: "Risco",
    items: [
      { href: "/app/var", label: "VaR" },
      { href: "/app/breakeven", label: "Breakeven" },
      { href: "/app/stress", label: "Stress Test" },
    ],
  },
  {
    label: "Análise",
    items: [
      { href: "/app/news", label: "Notícias" },
      { href: "/app/focus", label: "Focus BCB" },
      { href: "/app/arima", label: "ARIMA" },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ background: "#111827" }}
      >
        {/* Brand */}
        <div
          className="px-5 py-[22px]"
          style={{ borderBottom: "1px solid #1f2937" }}
        >
          <p
            className="font-extrabold tracking-[2.5px]"
            style={{ color: "#f9fafb", fontSize: 15 }}
          >
            IMPACTO
          </p>
          <p
            className="mt-0.5"
            style={{ color: "#4b5563", fontSize: 10, letterSpacing: "1px" }}
          >
            Análise de Mercado
          </p>
        </div>

        {/* Dashboard link */}
        <Link
          href="/app/dashboard"
          className="flex items-center gap-2.5 px-5 py-2.5"
          style={{
            color: pathname === "/app/dashboard" ? "#f9fafb" : "#9ca3af",
            background:
              pathname === "/app/dashboard" ? "#1f2937" : "transparent",
            borderLeft:
              pathname === "/app/dashboard"
                ? "2px solid #3b82f6"
                : "2px solid transparent",
            fontSize: 13,
            fontWeight: pathname === "/app/dashboard" ? 500 : 400,
          }}
        >
          <span
            className="rounded-full flex-shrink-0"
            style={{
              width: 5,
              height: 5,
              background:
                pathname === "/app/dashboard" ? "#3b82f6" : "currentColor",
              opacity: pathname === "/app/dashboard" ? 1 : 0.5,
            }}
          />
          Dashboard
        </Link>

        {/* Grouped nav */}
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p
              className="px-5 pb-1.5"
              style={{
                paddingTop: 18,
                color: "#4b5563",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              {section.label}
            </p>
            {section.items.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-5 py-2"
                  style={{
                    color: active ? "#f9fafb" : "#9ca3af",
                    background: active ? "#1f2937" : "transparent",
                    borderLeft: active
                      ? "2px solid #3b82f6"
                      : "2px solid transparent",
                    fontSize: 13,
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  <span
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: 5,
                      height: 5,
                      background: active ? "#3b82f6" : "currentColor",
                      opacity: active ? 1 : 0.5,
                    }}
                  />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      <main className="flex-1 overflow-auto" style={{ background: "#f4f6f9" }}>
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify sidebar renders**

Run `npm run dev` in `frontend/`, open `http://localhost:3000/app/dashboard`.
Expected: dark sidebar with "IMPACTO / Análise de Mercado", grouped sections, no icons.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/app/layout.tsx
git commit -m "feat(dashboard): update sidebar with dark grouped nav, remove icons"
```

---

## Task 3: PriceCard — rewrite for light mode

**Files:**
- Modify: `frontend/components/dashboard/PriceCard.tsx`

- [ ] **Step 1: Rewrite PriceCard.tsx**

Replace the entire file with:

```tsx
"use client";

import { useMemo } from "react";

interface PriceRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

interface PriceCardProps {
  label: string;
  exchange: string;   // e.g. "ICE Futures · SB=F"
  unit: string;
  rows: PriceRow[];
  barColor: string;   // e.g. "#d97706"
}

function MiniBarChart({ rows, barColor }: { rows: PriceRow[]; barColor: string }) {
  const valid = rows.filter((r) => r.close !== null).slice(-90);
  if (valid.length === 0) return null;

  const closes = valid.map((r) => r.close!);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-[3px] mt-4" style={{ height: 48 }}>
      {valid.map((r, i) => {
        const heightPct = ((r.close! - min) / range) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(heightPct, 4)}%`,
              background: barColor,
              opacity: 0.7 + (i / valid.length) * 0.3,
            }}
          />
        );
      })}
    </div>
  );
}

export function PriceCard({ label, exchange, unit, rows, barColor }: PriceCardProps) {
  const valid = useMemo(() => rows.filter((r) => r.close !== null), [rows]);
  const latest = valid.at(-1);
  const prev = valid.at(-2);
  const change =
    latest && prev && prev.close
      ? ((latest.close! - prev.close!) / prev.close!) * 100
      : null;

  const allCloses = valid.map((r) => r.close!);
  const max12m = allCloses.length ? Math.max(...allCloses) : null;
  const min12m = allCloses.length ? Math.min(...allCloses) : null;

  const isUp = change !== null && change >= 0;

  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="font-semibold tracking-[0.5px]"
            style={{ color: "#6b7280", fontSize: 12 }}
          >
            {label}
          </p>
          <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>
            {exchange}
          </p>
        </div>
        {change !== null && (
          <span
            className="font-bold rounded-md px-2.5 py-1"
            style={{
              fontSize: 12,
              background: isUp ? "#f0fdf4" : "#fef2f2",
              color: isUp ? "#15803d" : "#b91c1c",
            }}
          >
            {isUp ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Price */}
      <p
        className="font-bold leading-none"
        style={{ fontSize: 32, color: "#111827", fontVariantNumeric: "tabular-nums" }}
      >
        {latest?.close?.toFixed(2) ?? "—"}
        <span
          className="font-normal ml-1"
          style={{ fontSize: 15, color: "#9ca3af" }}
        >
          {unit}
        </span>
      </p>

      {/* Range */}
      {max12m !== null && min12m !== null && (
        <p className="mt-1" style={{ fontSize: 12, color: "#9ca3af" }}>
          Máx 12m: {max12m.toFixed(2)} · Mín 12m: {min12m.toFixed(2)}
        </p>
      )}

      {/* Bar chart */}
      <MiniBarChart rows={valid} barColor={barColor} />
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors related to PriceCard.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/PriceCard.tsx
git commit -m "feat(dashboard): rewrite PriceCard for light mode with mini bar chart"
```

---

## Task 4: NewsFeed — restyle for light mode

**Files:**
- Modify: `frontend/components/dashboard/NewsFeed.tsx`

- [ ] **Step 1: Replace the return JSX in NewsFeed.tsx**

The component logic stays the same. Replace only the `return (...)` block with:

```tsx
  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <p
        className="font-bold mb-3 pb-3"
        style={{
          fontSize: 13,
          color: "#111827",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        Notícias do Mercado
      </p>

      {loading && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>Carregando notícias...</p>
      )}
      {!loading && items.length === 0 && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>Nenhuma notícia encontrada.</p>
      )}

      {items.slice(0, 4).map((item, i) => (
        <a
          key={i}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            borderBottom: i < 3 ? "1px solid #f9fafb" : "none",
          }}
        >
          <span
            className="inline-block font-bold rounded mb-1"
            style={{
              fontSize: 10,
              padding: "2px 6px",
              letterSpacing: "0.3px",
              background: item.source === "Açúcar" ? "#fef9c3" : "#eff6ff",
              color: item.source === "Açúcar" ? "#854d0e" : "#1d4ed8",
            }}
          >
            {item.source}
          </span>
          <p
            className="leading-snug"
            style={{ fontSize: 12, color: "#1f2937" }}
          >
            {item.title}
          </p>
          <p className="mt-0.5" style={{ fontSize: 11, color: "#9ca3af" }}>
            {item.pubDate
              ? new Date(item.pubDate).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : ""}
          </p>
        </a>
      ))}
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/NewsFeed.tsx
git commit -m "feat(dashboard): restyle NewsFeed for light mode"
```

---

## Task 5: New `FocusWidget` component

**Files:**
- Create: `frontend/components/dashboard/FocusWidget.tsx`

- [ ] **Step 1: Create FocusWidget.tsx**

```tsx
interface FocusEntry {
  value: number | null;
  delta: number | null;
}

interface FocusData {
  ipca: FocusEntry;
  cambio: FocusEntry;
  selic: FocusEntry;
  pib: FocusEntry;
  ano_referencia: string;
}

interface FocusWidgetProps {
  data: FocusData | null;
}

const ROWS = [
  { key: "ipca" as const, label: "IPCA", unit: "%" },
  { key: "selic" as const, label: "SELIC (fim de ano)", unit: "%" },
  { key: "cambio" as const, label: "USD / BRL", unit: "" },
  { key: "pib" as const, label: "PIB", unit: "%" },
];

function DeltaTag({ delta, invertSign = false }: { delta: number | null; invertSign?: boolean }) {
  if (delta === null) return <span style={{ fontSize: 11, color: "#9ca3af" }}>—</span>;
  // For PIB: higher is good (green). For IPCA/Câmbio: higher is bad (red). invertSign flips the color.
  const positive = invertSign ? delta > 0 : delta < 0;
  const color = delta === 0 ? "#6b7280" : positive ? "#16a34a" : "#dc2626";
  const sign = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return (
    <span className="font-semibold" style={{ fontSize: 11, color }}>
      {sign} ante {Math.abs(delta).toFixed(2)}
    </span>
  );
}

export function FocusWidget({ data }: FocusWidgetProps) {
  const year = data?.ano_referencia ?? new Date().getFullYear().toString();

  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <p
        className="font-bold mb-0.5"
        style={{ fontSize: 13, color: "#111827" }}
      >
        Relatório Focus · BCB
      </p>
      <p
        className="mb-3 pb-3"
        style={{
          fontSize: 11,
          color: "#9ca3af",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        Projeções para {year}
      </p>

      {!data && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          Dados indisponíveis no momento.
        </p>
      )}

      {data &&
        ROWS.map(({ key, label, unit }, i) => {
          const entry = data[key];
          const isLast = i === ROWS.length - 1;
          return (
            <div
              key={key}
              className="flex items-center justify-between"
              style={{
                paddingTop: 10,
                paddingBottom: 10,
                borderBottom: isLast ? "none" : "1px solid #f9fafb",
              }}
            >
              <div>
                <p style={{ fontSize: 13, color: "#374151" }}>{label}</p>
                <p style={{ fontSize: 11, color: "#9ca3af" }}>Projeção {year}</p>
              </div>
              <div className="text-right">
                <p
                  className="font-bold"
                  style={{
                    fontSize: 14,
                    color: "#111827",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {entry.value !== null
                    ? `${entry.value.toFixed(2)}${unit}`
                    : "—"}
                </p>
                <DeltaTag
                  delta={entry.delta}
                  invertSign={key === "pib"}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/FocusWidget.tsx
git commit -m "feat(dashboard): add FocusWidget component for BCB Focus data"
```

---

## Task 6: New `AccountSummary` component

**Files:**
- Create: `frontend/components/dashboard/AccountSummary.tsx`

- [ ] **Step 1: Create AccountSummary.tsx**

```tsx
interface SimulationRow {
  id: string;
  ticker: string;
  label: string | null;
  preco_inicial: number;
  dias_simulados: number;
  p5: number;
  p50: number;
  p95: number;
  created_at: string;
}

interface AccountSummaryProps {
  lastSim: SimulationRow | null;
  simCountMonth: number;
}

export function AccountSummary({ lastSim, simCountMonth }: AccountSummaryProps) {
  const rows = [
    {
      label: "Última simulação MC",
      value: lastSim
        ? `${lastSim.ticker} · P50: ${lastSim.p50.toFixed(2)}`
        : "Nenhuma",
      sub: lastSim
        ? new Date(lastSim.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
    },
    {
      label: "P5 / P95 (última sim.)",
      value: lastSim
        ? `${lastSim.p5.toFixed(2)} — ${lastSim.p95.toFixed(2)}`
        : "—",
      sub: lastSim ? `${lastSim.dias_simulados} dias simulados` : null,
    },
    {
      label: "Preço inicial (última sim.)",
      value: lastSim ? lastSim.preco_inicial.toFixed(2) : "—",
      sub: null,
    },
    {
      label: "Simulações este mês",
      value: simCountMonth.toString(),
      sub: null,
    },
  ];

  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      <p
        className="font-bold mb-3 pb-3"
        style={{
          fontSize: 13,
          color: "#111827",
          borderBottom: "1px solid #f3f4f6",
        }}
      >
        Resumo da Conta
      </p>

      {rows.map(({ label, value, sub }, i) => (
        <div
          key={label}
          className="flex items-center justify-between"
          style={{
            paddingTop: 10,
            paddingBottom: 10,
            borderBottom: i < rows.length - 1 ? "1px solid #f9fafb" : "none",
          }}
        >
          <p style={{ fontSize: 13, color: "#6b7280" }}>{label}</p>
          <div className="text-right">
            <p
              className="font-bold"
              style={{
                fontSize: 14,
                color: "#111827",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </p>
            {sub && (
              <p style={{ fontSize: 11, color: "#9ca3af" }}>{sub}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/AccountSummary.tsx
git commit -m "feat(dashboard): add AccountSummary component"
```

---

## Task 7: New `ToolGrid` component

**Files:**
- Create: `frontend/components/dashboard/ToolGrid.tsx`

- [ ] **Step 1: Create ToolGrid.tsx**

```tsx
import Link from "next/link";

const TOOLS = [
  {
    href: "/app/simulation",
    label: "Monte Carlo",
    desc: "Simulação de preços com fan chart P5–P95",
  },
  {
    href: "/app/options",
    label: "Payoff Opções",
    desc: "Estratégias multi-perna com gráfico de payoff",
  },
  {
    href: "/app/pricing",
    label: "Precificação",
    desc: "Black-Scholes e MC para calls europeias",
  },
  {
    href: "/app/var",
    label: "VaR",
    desc: "Value at Risk histórico e paramétrico",
  },
  {
    href: "/app/breakeven",
    label: "Breakeven",
    desc: "Ponto de equilíbrio por cenário de câmbio",
  },
];

export function ToolGrid() {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
      {TOOLS.map(({ href, label, desc }) => (
        <Link
          key={href}
          href={href}
          className="group block rounded-[10px] p-[18px] transition-all"
          style={{ background: "#fff", border: "1px solid #e5e7eb" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6";
            (e.currentTarget as HTMLElement).style.background = "#eff6ff";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
            (e.currentTarget as HTMLElement).style.background = "#fff";
          }}
        >
          <p className="font-bold mb-1" style={{ fontSize: 13, color: "#111827" }}>
            {label}
          </p>
          <p className="leading-snug" style={{ fontSize: 11, color: "#9ca3af" }}>
            {desc}
          </p>
          <p className="mt-2.5 font-semibold" style={{ fontSize: 11, color: "#3b82f6" }}>
            Acessar →
          </p>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/dashboard/ToolGrid.tsx
git commit -m "feat(dashboard): add ToolGrid navigation component"
```

---

## Task 8: Dashboard page — full rewrite

**Files:**
- Modify: `frontend/app/app/dashboard/page.tsx`

- [ ] **Step 1: Replace `page.tsx` with the new layout**

```tsx
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PriceCard } from "@/components/dashboard/PriceCard";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { FocusWidget } from "@/components/dashboard/FocusWidget";
import { AccountSummary } from "@/components/dashboard/AccountSummary";
import { ToolGrid } from "@/components/dashboard/ToolGrid";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// ── Data fetchers ──────────────────────────────────────────────────────────────

async function fetchPrices(ticker: string, token: string) {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/market/prices?ticker=${encodeURIComponent(ticker)}&start=${start}&end=${end}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.rows ?? [];
  } catch {
    return [];
  }
}

async function fetchFocus(token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/focus`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchAccountSummary(token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/simulations`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 }, // always fresh — user's own data
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { lastSim: null, simCountMonth: 0 };
    const data = await res.json();
    const all = data.simulations ?? [];
    const lastSim = all[0] ?? null;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const simCountMonth = all.filter(
      (s: any) => new Date(s.created_at) >= startOfMonth
    ).length;
    return { lastSim, simCountMonth };
  } catch {
    return { lastSim: null, simCountMonth: 0 };
  }
}

function getTickerStats(rows: any[]) {
  const valid = rows.filter((r: any) => r.close !== null);
  const latest = valid.at(-1);
  const prev = valid.at(-2);
  const change =
    latest && prev && prev.close
      ? ((latest.close - prev.close) / prev.close) * 100
      : null;
  return { value: latest?.close ?? null, change };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const [sugarRows, fxRows, focusData, summary] = await Promise.all([
    fetchPrices("SB=F", token),
    fetchPrices("USDBRL=X", token),
    fetchFocus(token),
    fetchAccountSummary(token),
  ]);

  const sugarStats = getTickerStats(sugarRows);
  const fxStats = getTickerStats(fxRows);

  // Format today's date in Portuguese
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1);

  // Derive avatar initials from email
  const initials = (user.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f4f6f9" }}>

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-7"
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          paddingTop: 18,
          paddingBottom: 18,
        }}
      >
        <div>
          <h1 className="font-bold" style={{ fontSize: 20, color: "#111827", lineHeight: 1.2 }}>
            Dashboard
          </h1>
          <p className="mt-0.5" style={{ fontSize: 13, color: "#6b7280" }}>
            Visão geral do mercado · {todayCap}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Live badge */}
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold"
            style={{ background: "#dcfce7", color: "#15803d", fontSize: 11 }}
          >
            <span
              className="rounded-full"
              style={{
                width: 6,
                height: 6,
                background: "#22c55e",
                animation: "pulse 2s infinite",
              }}
            />
            Mercado aberto
          </div>
          {/* User */}
          <div
            className="flex items-center gap-2.5 pl-4"
            style={{ borderLeft: "1px solid #e5e7eb" }}
          >
            <div>
              <p className="font-medium text-right" style={{ fontSize: 13, color: "#374151" }}>
                {user.email?.split("@")[0]}
              </p>
              <p className="text-right" style={{ fontSize: 11, color: "#9ca3af" }}>
                {user.email}
              </p>
            </div>
            <div
              className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
              style={{
                width: 32,
                height: 32,
                background: "#1e3a5f",
                color: "#93c5fd",
                fontSize: 12,
              }}
            >
              {initials}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ticker tape ── */}
      <div
        className="flex items-center gap-7 px-7 overflow-x-auto"
        style={{ background: "#1f2937", paddingTop: 8, paddingBottom: 8, flexShrink: 0 }}
      >
        {[
          { label: "AÇÚCAR NY", value: sugarStats.value?.toFixed(2), unit: "¢", change: sugarStats.change },
          { label: "USD/BRL", value: fxStats.value?.toFixed(4), unit: "R$", change: fxStats.change },
          { label: "SELIC", value: focusData?.selic?.value ? `${focusData.selic.value.toFixed(2)}%` : null, change: null },
          { label: "IPCA EXP.", value: focusData?.ipca?.value ? `${focusData.ipca.value.toFixed(2)}%` : null, change: focusData?.ipca?.delta },
        ].map(({ label, value, unit, change }, i, arr) => (
          <div key={label} className="flex items-center gap-2 flex-shrink-0">
            <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px" }}>
              {label}
            </span>
            <span style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {value ?? "—"}{unit && value ? ` ${unit}` : ""}
            </span>
            {change !== null && change !== undefined && (
              <span
                style={{
                  fontSize: 11,
                  color: change > 0 ? "#4ade80" : change < 0 ? "#f87171" : "#6b7280",
                }}
              >
                {change > 0 ? "+" : ""}{change.toFixed(2)}%
              </span>
            )}
            {i < arr.length - 1 && (
              <span style={{ color: "#374151", marginLeft: 4 }}>·</span>
            )}
          </div>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex flex-col gap-6 px-7 py-6">

        {/* Section: Prices */}
        <div>
          <p
            className="uppercase font-bold mb-3"
            style={{ fontSize: 11, color: "#6b7280", letterSpacing: "1.5px" }}
          >
            Preços ao vivo
          </p>
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <PriceCard
              label="Açúcar NY #11"
              exchange="ICE Futures · SB=F"
              unit="¢/lb"
              rows={sugarRows}
              barColor="#d97706"
            />
            <PriceCard
              label="Dólar / Real"
              exchange="Forex · USDBRL=X"
              unit="R$"
              rows={fxRows}
              barColor="#2563eb"
            />
          </div>
        </div>

        {/* Section: Live widgets */}
        <div>
          <p
            className="uppercase font-bold mb-3"
            style={{ fontSize: 11, color: "#6b7280", letterSpacing: "1.5px" }}
          >
            Informações em tempo real
          </p>
          <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <NewsFeed />
            <FocusWidget data={focusData} />
            <AccountSummary
              lastSim={summary.lastSim}
              simCountMonth={summary.simCountMonth}
            />
          </div>
        </div>

        {/* Section: Tools */}
        <div>
          <p
            className="uppercase font-bold mb-3"
            style={{ fontSize: 11, color: "#6b7280", letterSpacing: "1.5px" }}
          >
            Ferramentas
          </p>
          <ToolGrid />
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 3: Verify in dev server**

```bash
npm run dev
```

Open `http://localhost:3000/app/dashboard`. Verify:
- Header shows title + date + user badge
- Ticker tape shows 4 items on dark strip
- Two price cards render with bar charts
- 3 widget cards in a row (news, focus, summary)
- 5 tool nav cards at bottom
- No console errors

- [ ] **Step 4: Build for production**

```bash
npm run build
```

Expected: no build errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/app/dashboard/page.tsx
git commit -m "feat(dashboard): rewrite dashboard page — light mode, all widgets, 8s fetch timeouts"
```

---

## Task 9: Deploy

- [ ] **Step 1: Push to trigger CI/CD**

```bash
git push origin feat/plataforma-escalavel
```

Or merge to `main` if the feature is ready:

```bash
git checkout main && git merge feat/plataforma-escalavel && git push origin main
```

- [ ] **Step 2: On the VM, install new backend dependency**

SSH into the VM and run:

```bash
cd /opt/impacto/backend
.venv/bin/pip install python-bcb
pm2 restart backend
pm2 logs backend --lines 20
```

Expected: uvicorn starts without import errors.

- [ ] **Step 3: Smoke test the deployed dashboard**

Open the production URL, sign in, verify:
- Dashboard loads within 10 seconds
- Price cards show data
- No 504 errors
- Focus widget either shows data or "Dados indisponíveis" gracefully
