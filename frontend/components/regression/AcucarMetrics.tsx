"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { formatCents } from "@/lib/format";
import { AcucarResult } from "./AcucarForm";

export function AcucarMetrics({ result }: { result: AcucarResult }) {
  // R² fora da amostra negativo significa "pior que a média": não mostramos o número.
  const r2 = result.r2_loo < 0 ? "sem poder preditivo" : `${Math.round(result.r2_loo * 100)}% do movimento`;
  const anoAnterior = result.rmse_ano_anterior;

  const metricas = [
    { rotulo: "Açúcar previsto", valor: formatCents(result.sb_f_previsto) },
    { rotulo: "Faixa provável", valor: `${formatCents(Math.max(result.sb_f_min, 0))} a ${formatCents(result.sb_f_max)}`, menor: true },
    { rotulo: "Erro médio em anos não vistos", valor: formatCents(result.rmse_loo), ajuda: "Quanto o modelo errou, em média, ao prever anos que ficaram de fora do ajuste (¢/lb)." },
    {
      rotulo: "Erro do chute 'mesmo preço do ano anterior'",
      valor: anoAnterior == null ? "—" : formatCents(anoAnterior),
    },
    { rotulo: "Acerto fora da amostra (R²)", valor: r2, menor: true, ajuda: "Quanto do movimento do preço o modelo explicou em anos que não viu. Abaixo de zero, erra mais que a média." },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {metricas.map(({ rotulo, valor, menor, ajuda }) => (
        <Card key={rotulo}>
          <CardContent className="pt-6">
            <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
              {rotulo}
              {ajuda && <FieldTooltip text={ajuda} />}
            </p>
            <p className={menor ? "text-lg font-bold tabular-nums" : "text-2xl font-bold tabular-nums"}>{valor}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Aviso de confiança: aparece sempre que a confiança não é "Boa". */
export function AvisoConfianca({ result }: { result: AcucarResult }) {
  if (result.confianca === "Boa") return null;
  return (
    <p role="status" className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
      Com {result.n_anos} anos de histórico, esta previsão é só indicativa. Use junto com outras análises.
    </p>
  );
}
