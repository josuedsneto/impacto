"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatFX, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface IndicatorValue {
  value: number | null;
  delta: number | null;
}

interface FocusResponse {
  ipca: IndicatorValue;
  cambio: IndicatorValue;
  selic: IndicatorValue;
  pib: IndicatorValue;
  ano_referencia: string;
}

export default function FocusPage() {
  const [data, setData] = useState<FocusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    async function fetchFocus() {
      try {
        setData(await apiFetch<FocusResponse>("/api/focus"));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchFocus();
  }, [tentativa]);

  // altaEBoa: PIB maior é bom (verde); inflação, juros e câmbio maiores são ruins (vermelho).
  const indicators = data
    ? [
        { label: "IPCA", tipo: "pct", altaEBoa: false, ...data.ipca },
        { label: "Dólar (USD/BRL)", tipo: "fx", altaEBoa: false, ...data.cambio },
        { label: "Selic", tipo: "pct", altaEBoa: false, ...data.selic },
        { label: "PIB", tipo: "pct", altaEBoa: true, ...data.pib },
      ]
    : [];

  return (
    <div>
      <PageHeader
        titulo="Boletim Focus"
        descricao={`Mediana das projeções do mercado coletadas pelo Banco Central${data ? ` para ${data.ano_referencia}` : ""}.`}
      />

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {error && (
        <ErrorState
          mensagem={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            setTentativa((t) => t + 1);
          }}
        />
      )}

      {!loading && !error && data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {indicators.map((ind) => {
            const bom = ind.delta !== null && (ind.altaEBoa ? ind.delta > 0 : ind.delta < 0);
            return (
              <Card key={ind.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{ind.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold tabular-nums">
                    {ind.tipo === "fx" ? formatFX(ind.value) : formatPercent(ind.value == null ? null : ind.value / 100)}
                  </p>
                  {ind.delta !== null && ind.delta !== 0 && (
                    <p className={cn("mt-1 text-sm", bom ? "text-positive" : "text-negative")}>
                      {ind.delta > 0 ? "▲" : "▼"} {formatNumber(Math.abs(ind.delta), 2)} em 7 dias
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
