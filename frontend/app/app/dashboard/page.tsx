import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PriceCard } from "@/components/dashboard/PriceCard";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { FocusWidget } from "@/components/dashboard/FocusWidget";
import { AccountSummary } from "@/components/dashboard/AccountSummary";

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
      next: { revalidate: 0 },
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const [sugarRows, fxRows, focusData, summary] = await Promise.all([
    fetchPrices("SB=F", token),
    fetchPrices("USDBRL=X", token),
    fetchFocus(token),
    fetchAccountSummary(token),
  ]);

  return (
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

    </div>
  );
}
