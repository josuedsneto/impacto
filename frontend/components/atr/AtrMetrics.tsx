"use client";

import { formatNumber } from "@/lib/format";
import { AtrResult } from "./AtrForm";

const kg = (v: number) => `${formatNumber(v, 1)} kg/t`;

export function AtrMetrics({ result }: { result: AtrResult }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">ATR mínimo</p>
          <p className="mt-1 text-xl font-medium tabular-nums">{kg(result.atr_min)}</p>
        </div>

        <div className="rounded-xl border-2 border-brand bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">ATR esperado</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-brand">{kg(result.atr_esperado)}</p>
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">ATR máximo</p>
          <p className="mt-1 text-xl font-medium tabular-nums">{kg(result.atr_max)}</p>
        </div>
      </div>

      {result.producao_total != null && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">Produção total estimada</p>
          <p className="mt-1 text-xl font-medium tabular-nums">{formatNumber(result.producao_total / 1000, 0)} mil toneladas</p>
        </div>
      )}
    </div>
  );
}
