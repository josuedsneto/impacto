import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PriceCard } from "@/components/dashboard/PriceCard";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { FocusWidget } from "@/components/dashboard/FocusWidget";
import { AccountSummary } from "@/components/dashboard/AccountSummary";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/ui/feedback";
import { getFocus, getPrecos, getSimulacoes } from "@/lib/dados-servidor";

// ── Resumo das simulações ──────────────────────────────────────────────────────

async function resumoSimulacoes(token: string) {
  const carga = await getSimulacoes(token);
  if (!carga.ok) return { lastSim: null, simCountMonth: 0 };
  const all = carga.dados.simulations ?? [];
  const lastSim = all[0] ?? null;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const simCountMonth = all.filter((s) => new Date(s.created_at) >= startOfMonth).length;
  return { lastSim, simCountMonth };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const [sugar, fx, focus, summary] = await Promise.all([
    getPrecos("SB=F", token),
    getPrecos("USDBRL=X", token),
    getFocus(token),
    resumoSimulacoes(token),
  ]);

  return (
    <div>
      <PageHeader
        titulo="Dashboard"
        descricao="Preços de açúcar e dólar, expectativas do mercado e suas últimas simulações."
      />

      <section aria-labelledby="sec-precos" className="mb-6">
        <h2 id="sec-precos" className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
          Preços
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sugar.ok ? (
            <PriceCard label="Açúcar NY nº 11" exchange="ICE Futures · SB=F" tipo="cents" rows={sugar.dados} />
          ) : (
            <ErrorState mensagem="Não foi possível carregar a cotação do açúcar." />
          )}
          {fx.ok ? (
            <PriceCard label="Dólar / Real" exchange="Câmbio · USDBRL=X" tipo="fx" rows={fx.dados} />
          ) : (
            <ErrorState mensagem="Não foi possível carregar a cotação do dólar." />
          )}
        </div>
      </section>

      <section aria-labelledby="sec-info">
        <h2 id="sec-info" className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
          Informações do mercado
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <NewsFeed />
          <FocusWidget data={focus.ok ? focus.dados : null} />
          <AccountSummary lastSim={summary.lastSim} simCountMonth={summary.simCountMonth} />
        </div>
      </section>
    </div>
  );
}
