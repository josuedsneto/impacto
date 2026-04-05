"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadCsv, formatBrDate, formatBrNumber, isoToday, printPage } from "@/lib/export";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

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

function buildArimaRows(data: ArimaPoint[]): string[][] {
  const header = ["Data", "Valor", "Forecast", "CI_Inferior", "CI_Superior"];
  const rows = data.map(p => [
    formatBrDate(p.date),
    p.value    != null ? formatBrNumber(p.value)    : "",
    p.forecast != null ? formatBrNumber(p.forecast) : "",
    p.ci_lower != null ? formatBrNumber(p.ci_lower) : "",
    p.ci_upper != null ? formatBrNumber(p.ci_upper) : "",
  ]);
  return [header, ...rows];
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function ArimaPanel({ ticker }: { ticker: string }) {
  const [steps, setSteps] = useState("30");
  const [data, setData] = useState<ArimaPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(
    async (stepsVal: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const encodedTicker = encodeURIComponent(ticker);
        const params = new URLSearchParams({ steps: stepsVal });
        const res = await fetch(
          `${API}/api/arima/${encodedTicker}?${params}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: controller.signal,
          }
        );
        const json = await res.json();
        if (res.status === 400) {
          setError(
            (json as { detail?: string }).detail ??
              "ARIMA não convergiu para este ativo."
          );
          return;
        }
        if (!res.ok) {
          setError(
            (json as { detail?: string; error?: string }).detail ?? json.error ?? "Erro ao carregar ARIMA."
          );
          return;
        }
        setData((json as ArimaResponse).series);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Erro de conexão com o servidor.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [ticker]
  );

  useEffect(() => {
    fetchData(steps);
    return () => abortRef.current?.abort();
  }, [fetchData, steps]);

  function handleStepsChange(val: string) {
    setSteps(val);
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

      {loading && <Skeleton className="h-80 w-full rounded-lg" />}

      {error && <ErrorState message={error} onRetry={() => fetchData(steps)} />}

      {!loading && !error && data && (
        <div className="h-[240px] md:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      )}

      <div className="flex gap-2 mt-4 no-print">
        <TooltipProvider>
          <UITooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data}
                  className="no-print"
                  onClick={() => {
                    if (!data) return;
                    const slug = ticker === "SB=F" ? "arima-acucar" : "arima-dolar";
                    downloadCsv(buildArimaRows(data), `${slug}_arima_${isoToday()}.csv`);
                  }}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Exportar CSV
                </Button>
              </span>
            </TooltipTrigger>
            {!data && <TooltipContent>Aguarde o carregamento</TooltipContent>}
          </UITooltip>
        </TooltipProvider>
        <Button variant="outline" size="sm" onClick={printPage} className="no-print">
          <Printer className="w-4 h-4 mr-1.5" />
          Imprimir PDF
        </Button>
      </div>
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
