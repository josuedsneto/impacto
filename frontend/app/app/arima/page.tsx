"use client";

import { useState, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComputingLoader } from "@/components/ui/computing-loader";
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
        const encodedTicker = encodeURIComponent(ticker);
        const params = new URLSearchParams({ steps: stepsVal });
        const json = await apiFetch<ArimaResponse>(
          `/api/arima/${encodedTicker}?${params}`
        );
        setData(json.series);
        setLoaded(true);
      } catch (e) {
        if (e instanceof ApiError) {
          setError(
            e.status === 400
              ? e.message || "ARIMA não convergiu para este ativo."
              : e.message || "Erro ao carregar ARIMA."
          );
        } else {
          setError("Erro de conexão com o servidor.");
        }
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

      {loading && (
        <ComputingLoader label="Ajustando modelo ARIMA..." expectedSeconds={15} />
      )}

      {error && (
        <div className="rounded-md border border-yellow-400 bg-yellow-50 dark:bg-yellow-950 p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Aviso: {error}
          </p>
        </div>
      )}

      {!loading && !error && data && (
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: string) =>
                new Date(v).toLocaleDateString("pt-BR", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(v: string) =>
                new Date(v).toLocaleDateString("pt-BR")
              }
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  value: "Histórico",
                  forecast: "Previsão",
                  ci_upper: "IC Superior",
                  ci_lower: "IC Inferior",
                };
                return [value?.toFixed(4), labels[name] ?? name];
              }}
            />
            <Legend
              formatter={(v: string) => {
                const labels: Record<string, string> = {
                  value: "Histórico",
                  forecast: "Previsão",
                  ci_upper: "IC Superior",
                  ci_lower: "IC Inferior (IC)",
                };
                return labels[v] ?? v;
              }}
            />
            {/* Confidence interval shaded area */}
            <Area
              type="monotone"
              dataKey="ci_upper"
              stroke="none"
              fill="hsl(var(--primary) / 0.15)"
              name="ci_upper"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="ci_lower"
              stroke="none"
              fill="hsl(var(--background))"
              name="ci_lower"
              legendType="none"
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--foreground))"
              dot={false}
              strokeWidth={1.5}
              name="value"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke="hsl(var(--primary))"
              dot={false}
              strokeWidth={2}
              strokeDasharray="5 3"
              name="forecast"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function ArimaPage() {
  const [tab, setTab] = useState("acucar");
  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Previsão ARIMA</h1>

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
