"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatFX, formatNumber } from "@/lib/format";
import { DolarResult } from "./DolarForm";

export function DolarMetrics({ result }: { result: DolarResult }) {
  const r2 =
    result.r2_fora_amostra == null
      ? "—"
      : result.r2_fora_amostra < 0
        ? "sem poder preditivo"
        : formatNumber(result.r2_fora_amostra, 2);

  const metricas = [
    { rotulo: "Dólar no cenário", valor: formatFX(result.taxa_prevista) },
    { rotulo: "Dólar hoje", valor: formatFX(result.taxa_atual) },
    { rotulo: "Acerto fora da amostra (R²)", valor: r2 },
    {
      rotulo: "Erro médio fora da amostra",
      valor: result.rmse_fora_amostra == null ? "—" : formatFX(result.rmse_fora_amostra),
    },
  ];

  return (
    <div className="space-y-6">
      {!result.supera_random_walk && (
        <p role="status" className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
          Neste histórico o modelo não erra menos que supor que o câmbio fica parado. Trate o resultado como cenário, não como previsão.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        Para a previsão do dólar, veja <Link className="underline" href="/app/cambio">Câmbio</Link>.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
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
        <h3 className="mb-2 text-sm font-semibold">Efeito de cada variável</h3>
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
