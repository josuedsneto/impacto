"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDate, formatNumber, formatPreco } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ArimaPoint {
  date: string;
  value?: number;
  forecast?: number;
  ci_lower?: number;
  ci_upper?: number;
  ic?: [number, number];
}

interface ArimaResponse {
  ticker: string;
  steps: number;
  series: ArimaPoint[];
}

function ArimaPanel({ ticker }: { ticker: string }) {
  const [steps, setSteps] = useState("30");
  const [data, setData] = useState<ArimaPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchArima = useCallback(
    async (stepsVal: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ steps: stepsVal });
        const json = await apiFetch<ArimaResponse>(
          `/api/arima/${encodeURIComponent(ticker)}?${params}`,
          { timeoutMs: 120_000 }
        );
        // Faixa de confiança como intervalo [inferior, superior] para a área do gráfico
        setData(json.series.map((p) => ({ ...p, ic: p.ci_lower != null ? [p.ci_lower, p.ci_upper!] : undefined })));
        setLoaded(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [ticker]
  );

  // Lazy load on first render of this panel
  if (!loaded && !loading && !error) {
    fetchArima(steps);
  }

  function handleStepsChange(val: string) {
    setSteps(val);
    fetchArima(val);
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Dias de previsão:</span>
        <Select value={steps} onValueChange={handleStepsChange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15">15 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="60">60 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && <Skeleton className="h-80" />}

      {error && <ErrorState mensagem={error} onRetry={() => fetchArima(steps)} />}

      {!loading && !error && data && (
        <div className="rounded-xl border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                minTickGap={24}
                tickFormatter={(v: string) => formatDate(v).slice(0, 5)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={56}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => formatNumber(v, 2)}
              />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v: string) => formatDate(v)}
                formatter={(v: number | number[], nome: string) => [
                  Array.isArray(v)
                    ? `${formatPreco(ticker, v[0])} a ${formatPreco(ticker, v[1])}`
                    : formatPreco(ticker, v),
                  nome,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area dataKey="ic" name="Intervalo de 95%" fill="var(--chart-1)" fillOpacity={0.2} stroke="none" isAnimationActive={false} />
              <Line dataKey="value" name="Histórico" stroke="var(--foreground)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
              <Line
                dataKey="forecast"
                name="Previsão"
                stroke="var(--chart-1)"
                dot={false}
                strokeWidth={2}
                strokeDasharray="5 3"
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function ArimaPage() {
  const [tab, setTab] = useState("acucar");
  return (
    <div>
      <PageHeader
        titulo="Previsão ARIMA"
        descricao="Projeção estatística do preço para os próximos dias, com intervalo de 95% de confiança."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="acucar">Açúcar NY</TabsTrigger>
          <TabsTrigger value="dolar">USD/BRL</TabsTrigger>
        </TabsList>

        <TabsContent value="acucar">
          <ArimaPanel ticker="SB=F" />
        </TabsContent>

        <TabsContent value="dolar">
          <ArimaPanel ticker="USDBRL=X" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
