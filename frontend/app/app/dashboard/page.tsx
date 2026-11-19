import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PriceCard } from "@/components/dashboard/PriceCard";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { FocusWidget } from "@/components/dashboard/FocusWidget";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState } from "@/components/ui/feedback";
import { CartaoAlertas, CartaoAnalises, CartaoFaixaDolar, CartaoPosicoes, RodapeMercado } from "@/components/painel/Cartoes";
import { getFocus, getPainelHoje, getPrecos } from "@/lib/dados-servidor";
import { ordenar, variacoes } from "@/lib/painel";
import type { Secao } from "@/lib/types/api";

const MSG_PAINEL = "Não foi possível carregar o painel agora. Tente novamente em alguns minutos.";

/** Seção que não veio (endpoint fora do ar) vira erro no cartão, sem derrubar a tela. */
function secao<T>(v: Secao<T> | undefined): Secao<T> {
  return v ?? { dados: null, motivo: MSG_PAINEL };
}

const LINK = "mt-2 inline-block text-xs font-semibold text-primary hover:underline";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? "";

  const [sugar, fx, focus, painel] = await Promise.all([
    getPrecos("SB=F", token),
    getPrecos("USDBRL=X", token),
    getFocus(token),
    getPainelHoje(token),
  ]);
  const p = painel.ok ? painel.dados : null;
  const varSugar = sugar.ok ? variacoes(sugar.dados) : null;
  const varFx = fx.ok ? variacoes(fx.dados) : null;

  const cartoes = ordenar([
    { id: "alertas" as const, node: <CartaoAlertas s={secao(p?.alertas)} /> },
    { id: "posicoes" as const, node: <CartaoPosicoes s={secao(p?.posicoes)} /> },
    {
      id: "mercado" as const,
      node: (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            {sugar.ok ? <PriceCard label="Açúcar NY nº 11" exchange="ICE Futures · SB=F" tipo="cents" rows={sugar.dados} /> : <ErrorState mensagem="Não foi possível carregar a cotação do açúcar." />}
            <RodapeMercado semana={varSugar?.semana ?? null} />
          </div>
          <div>
            {fx.ok ? <PriceCard label="Dólar / Real" exchange="Câmbio · USDBRL=X" tipo="fx" rows={fx.dados} /> : <ErrorState mensagem="Não foi possível carregar a cotação do dólar." />}
            <RodapeMercado semana={varFx?.semana ?? null} />
          </div>
        </div>
      ),
    },
    { id: "faixa_dolar" as const, node: <CartaoFaixaDolar s={secao(p?.faixa_dolar)} /> },
    {
      id: "focus" as const,
      node: (
        <div>
          <FocusWidget data={focus.ok ? focus.dados : null} />
          <Link href="/app/focus" className={LINK}>Abrir Boletim Focus</Link>
        </div>
      ),
    },
    { id: "analises" as const, node: <CartaoAnalises s={secao(p?.analises)} /> },
    {
      id: "noticias" as const,
      node: (
        <div>
          <NewsFeed />
          <Link href="/app/noticias" className={LINK}>Abrir notícias</Link>
        </div>
      ),
    },
  ]);

  return (
    <div>
      <PageHeader titulo="Hoje" descricao="O que mudou desde o último dia útil e o que olhar agora." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cartoes.map((c) => (
          <div key={c.id} className={c.id === "mercado" ? "md:col-span-2 xl:col-span-3" : undefined}>
            {c.node}
          </div>
        ))}
      </div>
    </div>
  );
}
