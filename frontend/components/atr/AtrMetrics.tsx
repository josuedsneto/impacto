"use client";

import { AtrResult } from "./AtrForm";

interface AtrMetricsProps {
  result: AtrResult;
}

export function AtrMetrics({ result }: AtrMetricsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">ATR Mínimo</p>
          <p className="mt-1 text-xl font-medium">{result.atr_min.toFixed(1)} kg/tc</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3 border-blue-200">
          <p className="text-sm text-muted-foreground">ATR Esperado</p>
          <p className="mt-1 text-2xl font-semibold text-blue-700">{result.atr_esperado.toFixed(1)} kg/tc</p>
        </div>

        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">ATR Máximo</p>
          <p className="mt-1 text-xl font-medium">{result.atr_max.toFixed(1)} kg/tc</p>
        </div>
      </div>

      {result.producao_total != null && (
        <div className="rounded-lg border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">Produção Total Estimada</p>
          <p className="mt-1 text-xl font-medium">
            {(result.producao_total / 1000).toFixed(0)} mil toneladas
          </p>
        </div>
      )}
    </div>
  );
}
