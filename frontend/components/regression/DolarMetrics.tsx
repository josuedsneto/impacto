"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DolarResult } from "./DolarForm";

interface DolarMetricsProps {
  result: DolarResult;
}

export function DolarMetrics({ result }: DolarMetricsProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Taxa Prevista USD/BRL
            </p>
            <p className="text-2xl font-bold">{result.taxa_prevista.toFixed(4)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">R²</p>
            <p className="text-2xl font-bold">{result.r2.toFixed(4)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">RMSE</p>
            <p className="text-2xl font-bold">{result.rmse.toFixed(4)}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Coeficientes do Modelo</h3>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Variável</th>
                <th className="px-4 py-2 text-right font-medium">Coeficiente</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.coeficientes).map(([variable, coef]) => (
                <tr key={variable} className="border-b last:border-b-0">
                  <td className="px-4 py-2">{variable}</td>
                  <td className="px-4 py-2 text-right font-mono">{coef.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
