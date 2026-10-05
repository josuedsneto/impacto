import Link from "next/link";
import { EmptyState } from "@/components/ui/feedback";
import { formatCents, formatFX, formatNumber } from "@/lib/format";

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

function precoDo(ticker: string) {
  if (ticker === "SB=F") return formatCents;
  if (ticker === "USDBRL=X") return formatFX;
  return (v: number) => formatNumber(v, 2);
}

export function AccountSummary({ lastSim, simCountMonth }: AccountSummaryProps) {
  const fmt = lastSim ? precoDo(lastSim.ticker) : formatCents;
  const rows = lastSim
    ? [
        {
          label: "Última simulação",
          value: `${lastSim.ticker} · ${fmt(lastSim.p50)}`,
          sub: new Date(lastSim.created_at).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        {
          label: "Faixa de 90% (P5 a P95)",
          value: `${fmt(lastSim.p5)} a ${fmt(lastSim.p95)}`,
          sub: `${lastSim.dias_simulados} dias úteis`,
        },
        { label: "Preço inicial", value: fmt(lastSim.preco_inicial), sub: null },
        { label: "Simulações este mês", value: String(simCountMonth), sub: null },
      ]
    : [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <p className="mb-3 border-b border-border pb-3 text-[13px] font-bold">Suas simulações</p>

      {!lastSim && (
        <EmptyState
          mensagem="Você ainda não fez nenhuma simulação Monte Carlo."
          acao={
            <Link href="/app/simulation" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
              Fazer a primeira simulação
            </Link>
          }
        />
      )}

      {rows.map(({ label, value, sub }) => (
        <div key={label} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-0">
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
