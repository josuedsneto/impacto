"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatCents, formatNumber } from "@/lib/format";
import { AcucarResult } from "./AcucarForm";

export function AcucarMetrics({ result }: { result: AcucarResult }) {
  const metricas = [
    { rotulo: "Açúcar previsto", valor: formatCents(result.sb_f_previsto) },
    { rotulo: "Faixa provável", valor: `${formatCents(result.sb_f_min)} a ${formatCents(result.sb_f_max)}`, menor: true },
    { rotulo: "R² (ajuste)", valor: formatNumber(result.r2, 4) },
    { rotulo: "Erro médio (RMSE)", valor: formatCents(result.rmse) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      {metricas.map(({ rotulo, valor, menor }) => (
        <Card key={rotulo}>
          <CardContent className="pt-6">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
            <p className={menor ? "text-lg font-bold tabular-nums" : "text-2xl font-bold tabular-nums"}>{valor}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
