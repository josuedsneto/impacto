import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { AppSidebar } from "@/components/layout/AppSidebar";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetchPrices(ticker: string, token: string) {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/market/prices?ticker=${encodeURIComponent(ticker)}&start=${start}&end=${end}`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) }
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

async function fetchMarketStatus(token: string): Promise<{ open: boolean; state: string }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/market/status?ticker=SB%3DF`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { open: false, state: "CLOSED" };
    return res.json();
  } catch {
    return { open: false, state: "CLOSED" };
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

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const [sugarRows, fxRows, focusData, marketStatus] = await Promise.all([
    fetchPrices("SB=F", token),
    fetchPrices("USDBRL=X", token),
    fetchFocus(token),
    fetchMarketStatus(token),
  ]);

  const sugarStats = getTickerStats(sugarRows);
  const fxStats = getTickerStats(fxRows);
  const initials = (user.email ?? "?").split("@")[0].slice(0, 2).toUpperCase();

  const tickerItems = [
    { label: "AÇÚCAR NY", value: sugarStats.value?.toFixed(2), unit: "¢", change: sugarStats.change },
    { label: "USD/BRL", value: fxStats.value?.toFixed(4), unit: "R$", change: fxStats.change },
    { label: "SELIC", value: focusData?.selic?.value ? `${focusData.selic.value.toFixed(2)}%` : null, change: null },
    { label: "IPCA EXP.", value: focusData?.ipca?.value ? `${focusData.ipca.value.toFixed(2)}%` : null, change: focusData?.ipca?.delta },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* ── Sticky header ── */}
      <header className="flex-shrink-0 z-50">
        {/* Top bar */}
        <div
          className="flex items-center justify-end px-7"
          style={{
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            paddingTop: 14,
            paddingBottom: 14,
          }}
        >
          <div className="flex items-center gap-4">
            {/* Market status badge */}
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold"
              style={{
                background: marketStatus.open ? "#dcfce7" : "#fee2e2",
                color: marketStatus.open ? "#15803d" : "#dc2626",
                fontSize: 11,
              }}
            >
              <span
                className="rounded-full flex-shrink-0"
                style={{
                  width: 6,
                  height: 6,
                  background: marketStatus.open ? "#22c55e" : "#ef4444",
                  animation: marketStatus.open ? "pulse-dot 2s infinite" : "none",
                }}
              />
              {marketStatus.open ? "Mercado aberto" : "Mercado fechado"}
            </div>
            {/* User menu */}
            <UserMenu
              email={user.email!}
              initials={initials}
              role={user.app_metadata?.role}
            />
          </div>
        </div>

        {/* Ticker tape */}
        <div
          className="flex items-center gap-7 px-7 overflow-x-auto"
          style={{ background: "#1f2937", paddingTop: 8, paddingBottom: 8 }}
        >
          {tickerItems.map(({ label, value, unit, change }, i, arr) => (
            <div key={label} className="flex items-center gap-2 flex-shrink-0">
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px" }}>
                {label}
              </span>
              <span style={{ color: "#f9fafb", fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {value ?? "—"}{unit && value ? ` ${unit}` : ""}
              </span>
              {change !== null && change !== undefined && (
                <span style={{ fontSize: 11, color: change > 0 ? "#4ade80" : change < 0 ? "#f87171" : "#6b7280" }}>
                  {change > 0 ? "+" : ""}{change.toFixed(2)}%
                </span>
              )}
              {i < arr.length - 1 && (
                <span style={{ color: "#374151", marginLeft: 4 }}>·</span>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-auto" style={{ background: "#f4f6f9" }}>
          {children}
        </main>
      </div>

    </div>
  );
}
