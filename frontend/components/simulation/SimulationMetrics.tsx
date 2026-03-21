"use client";

import { SimulationResult } from "./SimulationForm";

interface SimulationMetricsProps {
  result: SimulationResult;
}

export default function SimulationMetrics({ result }: SimulationMetricsProps) {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">
          {result.ticker} — {result.dias_simulados} dias
        </h3>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">P5</p>
          <p className="text-xl font-bold">{result.p5.toFixed(2)}</p>
        </div>
        <div className="space-y-1 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">P50 (mediana)</p>
          <p className="text-xl font-bold">{result.p50.toFixed(2)}</p>
        </div>
        <div className="space-y-1 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">P95</p>
          <p className="text-xl font-bold">{result.p95.toFixed(2)}</p>
        </div>
      </div>

      <div className="border-t pt-2 text-sm text-muted-foreground">
        Preço inicial: {result.preco_inicial.toFixed(2)}
      </div>
    </div>
  );
}
