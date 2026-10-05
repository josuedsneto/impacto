"use client";

import { formatPreco } from "@/lib/format";
import { SimulationResult } from "./SimulationForm";

export default function SimulationMetrics({ result }: { result: SimulationResult }) {
  const fmt = (v: number) => formatPreco(result.ticker, v);
  const metricas = [
    { rotulo: "P5 (pessimista)", valor: result.p5 },
    { rotulo: "P50 (mediana)", valor: result.p50, destaque: true },
    { rotulo: "P95 (otimista)", valor: result.p95 },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-card-foreground">
      <div className="border-b border-border pb-2">
        <h2 className="text-lg font-semibold">
          {result.ticker} · {result.dias_simulados} dias úteis
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metricas.map(({ rotulo, valor, destaque }) => (
          <div key={rotulo} className="space-y-1 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
            <p className={destaque ? "text-2xl font-bold tabular-nums" : "text-xl font-bold tabular-nums"}>{fmt(valor)}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-2 text-sm text-muted-foreground">
        Preço inicial: {fmt(result.preco_inicial)}
      </div>
    </div>
  );
}
