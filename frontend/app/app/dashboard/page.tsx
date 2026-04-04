import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PriceCard } from "@/components/dashboard/PriceCard";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { FocusWidget } from "@/components/dashboard/FocusWidget";
import { AccountSummary } from "@/components/dashboard/AccountSummary";
import { ToolGrid } from "@/components/dashboard/ToolGrid";
import { UserMenu } from "@/components/dashboard/UserMenu";

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
          <UserMenu email={user.email!} initials={initials} />
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
