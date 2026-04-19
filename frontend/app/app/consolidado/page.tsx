import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConsolidadoActions } from "./ConsolidadoActions";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  letterSpacing: "1.5px",
  fontWeight: "bold",
  textTransform: "uppercase",
  marginBottom: 12,
};

async function fetcher(path: string, token: string) {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={SECTION_LABEL}>{children}</p>;
}

export default async function ConsolidadoPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const [simsData, varSugar, varFx, breakeven, vol, sub] = await Promise.all([
    fetcher("/api/simulations?limit=1", token),
    fetcher("/api/var?ticker=SB%3DF&confidence=0.95", token),
    fetcher("/api/var?ticker=USDBRL%3DX&confidence=0.95", token),
    fetcher("/api/breakeven", token),
    fetcher("/api/volatility?ticker=SB%3DF", token),
    fetcher("/api/billing/subscription", token),
  ]);

  const lastSim = simsData?.simulations?.[0] ?? null;
  const isPro = sub?.plan === "pro" || sub?.plan === "enterprise";

  return (
    <div className="flex flex-col gap-8 px-7 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Consolidado de Risco</h1>
        <ConsolidadoActions isPro={isPro} />
      </div>

      {/* ── Última Simulação ── */}
      <div>
        <SectionLabel>Última Simulação Monte Carlo</SectionLabel>
        {lastSim ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <MetricCard label="Ticker" value={lastSim.ticker} sub={`${lastSim.dias_simulados} dias`} />
            <MetricCard
              label="Preço Inicial"
              value={lastSim.preco_inicial != null ? lastSim.preco_inicial.toFixed(4) : "—"}
            />
            <MetricCard
              label="P5 / P50 / P95"
              value={
                lastSim.p5 != null && lastSim.p50 != null && lastSim.p95 != null
                  ? `${lastSim.p5.toFixed(2)} / ${lastSim.p50.toFixed(2)} / ${lastSim.p95.toFixed(2)}`
                  : "—"
              }
            />
            <MetricCard
              label="Status"
              value={lastSim.status ?? "done"}
              sub={new Date(lastSim.created_at).toLocaleDateString("pt-BR")}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma simulação encontrada. Execute uma em Monte Carlo.</p>
        )}
      </div>

      {/* ── VaR ── */}
      <div>
        <SectionLabel>Value at Risk — 95% Confiança</SectionLabel>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {varSugar ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Açúcar NY (SB=F)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="VaR Histórico"
                  value={varSugar.var_historico_abs.toFixed(4)}
                  sub={`${(varSugar.var_historico_pct * 100).toFixed(2)}%`}
                />
                <MetricCard
                  label="VaR Paramétrico"
                  value={varSugar.var_parametrico_abs.toFixed(4)}
                  sub={`${(varSugar.var_parametrico_pct * 100).toFixed(2)}%`}
                />
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-4 text-sm text-muted-foreground">VaR Açúcar indisponível</CardContent></Card>
          )}
          {varFx ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">USD/BRL (USDBRL=X)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="VaR Histórico"
                  value={varFx.var_historico_abs.toFixed(4)}
                  sub={`${(varFx.var_historico_pct * 100).toFixed(2)}%`}
                />
                <MetricCard
                  label="VaR Paramétrico"
                  value={varFx.var_parametrico_abs.toFixed(4)}
                  sub={`${(varFx.var_parametrico_pct * 100).toFixed(2)}%`}
                />
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-4 text-sm text-muted-foreground">VaR Dólar indisponível</CardContent></Card>
          )}
        </div>
      </div>

      {/* ── Breakeven ── */}
      <div>
        <SectionLabel>Breakeven Açúcar</SectionLabel>
        {breakeven ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <MetricCard
              label="Breakeven"
              value={`R$ ${breakeven.breakeven_brl_saca.toFixed(2)}/sc`}
            />
            <MetricCard
              label="Açúcar NY"
              value={`${breakeven.preco_acucar_cents_lb.toFixed(2)} ¢/lb`}
            />
            <MetricCard
              label="USD/BRL"
              value={`R$ ${breakeven.preco_dolar_brl.toFixed(4)}`}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Dados de breakeven indisponíveis.</p>
        )}
      </div>

      {/* ── Volatilidade ── */}
      <div>
        <SectionLabel>Volatilidade Realizada — SB=F</SectionLabel>
        {vol ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <MetricCard
              label="Vol. 30 dias"
              value={vol.vol_30d != null ? `${(vol.vol_30d * 100).toFixed(1)}%` : "—"}
              sub="Anualizada"
            />
            <MetricCard
              label="Vol. 90 dias"
              value={vol.vol_90d != null ? `${(vol.vol_90d * 100).toFixed(1)}%` : "—"}
              sub="Anualizada"
            />
            <MetricCard
              label="Vol. 1 ano"
              value={`${(vol.vol_1y * 100).toFixed(1)}%`}
              sub={`Último preço: ${vol.last_price.toFixed(2)}`}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Dados de volatilidade indisponíveis.</p>
        )}
      </div>
    </div>
  );
}
