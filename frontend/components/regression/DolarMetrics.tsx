"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatFX, formatNumber } from "@/lib/format";
import { DolarResult } from "./DolarForm";

export function DolarMetrics({ result }: { result: DolarResult }) {
  const metricas = [
    { rotulo: "Dólar previsto", valor: formatFX(result.taxa_prevista) },
    { rotulo: "R² (ajuste)", valor: formatNumber(result.r2, 4) },
    { rotulo: "Erro médio (RMSE)", valor: formatFX(result.rmse) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metricas.map(({ rotulo, valor }) => (
          <Card key={rotulo}>
            <CardContent className="pt-6">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
              <p className="text-2xl font-bold tabular-nums">{valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Coeficientes do modelo</h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Variável</th>
                <th className="px-4 py-2 text-right font-medium">Coeficiente</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.coeficientes).map(([variable, coef]) => (
                <tr key={variable} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2">{variable}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{formatNumber(coef, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
