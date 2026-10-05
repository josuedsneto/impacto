import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { formatCents, formatFX, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

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

function getTickerStats(rows: { close: number | null }[]) {
  const valid = rows.filter((r) => r.close !== null) as { close: number }[];
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

  // Variações chegam em pontos percentuais (1.2 = 1,2%); format.ts recebe fração.
  const pct = (v: number | null | undefined) => (v == null ? null : v / 100);
  const tickerItems = [
    { label: "AÇÚCAR NY", value: formatCents(sugarStats.value), change: pct(sugarStats.change) },
    { label: "USD/BRL", value: formatFX(fxStats.value), change: pct(fxStats.change) },
    { label: "SELIC", value: formatPercent(pct(focusData?.selic?.value)), change: null },
    { label: "IPCA EXP.", value: formatPercent(pct(focusData?.ipca?.value)), change: pct(focusData?.ipca?.delta) },
  ];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="z-40 shrink-0">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-7">
          <MobileNav />
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
                marketStatus.open ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
              )}
            >
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", marketStatus.open ? "animate-pulse bg-positive" : "bg-negative")}
              />
              {marketStatus.open ? "Mercado aberto" : "Mercado fechado"}
            </div>
            <UserMenu email={user.email!} initials={initials} role={user.app_metadata?.role} />
          </div>
        </div>

        {/* Faixa de cotações: rola sozinha no celular, sem empurrar a página */}
        <div className="flex items-center gap-6 overflow-x-auto border-b border-border bg-muted px-4 py-2 sm:px-7">
          {tickerItems.map(({ label, value, change }) => (
            <div key={label} className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
              <span className="font-semibold tracking-wide text-muted-foreground">{label}</span>
              <span className="font-semibold text-foreground">{value}</span>
              {change != null && (
                <span className={change > 0 ? "text-positive" : change < 0 ? "text-negative" : "text-muted-foreground"}>
                  {change > 0 ? "+" : ""}
                  {formatPercent(change)}
                </span>
              )}
            </div>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-auto bg-background px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
