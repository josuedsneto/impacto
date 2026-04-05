"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Download, Printer } from "lucide-react";
import { downloadCsv, formatBrNumber, isoToday, printPage } from "@/lib/export";
import SimulationForm, {
  SimulationResult,
} from "@/components/simulation/SimulationForm";
import FanChart from "@/components/simulation/FanChart";
import SimulationMetrics from "@/components/simulation/SimulationMetrics";

function buildMonteCarloRows(result: SimulationResult): string[][] {
  const header = ["Dia", "Preco_P5", "Preco_P25", "Preco_P50", "Preco_P75", "Preco_P95"];
  const p5  = (result.percentiles_series["p5"]  ?? []) as number[];
  const p25 = (result.percentiles_series["p25"] ?? []) as number[];
  const p50 = (result.percentiles_series["p50"] ?? []) as number[];
  const p75 = (result.percentiles_series["p75"] ?? []) as number[];
  const p95 = (result.percentiles_series["p95"] ?? []) as number[];
  if (!p50.length) return [header];
  const rows = p50.map((_, i) => [
    String(i + 1),
    formatBrNumber(p5[i] ?? 0),
    formatBrNumber(p25[i] ?? 0),
    formatBrNumber(p50[i]),
    formatBrNumber(p75[i] ?? 0),
    formatBrNumber(p95[i] ?? 0),
  ]);
  return [header, ...rows];
}

interface HistorySummary {
  id: string;
  ticker: string;
  label: string | null;
  preco_inicial: number;
  dias_simulados: number;
  p5: number;
  p50: number;
  p95: number;
  created_at: string;
}

function toSummary(result: SimulationResult): HistorySummary {
  return {
    id: result.id,
    ticker: result.ticker,
    label: result.label,
    preco_inicial: result.preco_inicial,
    dias_simulados: result.dias_simulados,
    p5: result.p5,
    p50: result.p50,
    p95: result.p95,
    created_at: result.created_at,
  };
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function SimulationPage() {
  const [activeResult, setActiveResult] = useState<SimulationResult | null>(
    null
  );
  const [history, setHistory] = useState<HistorySummary[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("simular");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  function handleNewResult(result: SimulationResult) {
    setActiveResult(result);
    setHistory((prev) => [toSummary(result), ...prev]);
  }

  async function handleTabChange(value: string) {
    setActiveTab(value);
    if (value === "historico" && !historyLoaded) {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/simulations`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setHistoryError(data.detail ?? "Erro ao carregar histórico.");
        } else {
          setHistory((data as { simulations: HistorySummary[] }).simulations);
          setHistoryLoaded(true);
        }
      } catch {
        setHistoryError("Erro de conexão com o servidor.");
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  async function handleHistoryItemClick(id: string) {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/simulations/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setActiveResult(data as SimulationResult);
        setActiveTab("simular");
      }
    } catch {
      // silent — user remains on Histórico tab
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Simulação Monte Carlo</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="simular">Simular</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="simular" className="space-y-6 mt-6">
          <SimulationForm onResult={handleNewResult} />

          {activeResult && (
            <div className="space-y-6">
              <SimulationMetrics result={activeResult} />
              <FanChart
                series={activeResult.percentiles_series}
                dias_simulados={activeResult.dias_simulados}
              />
            </div>
          )}

          <div className="flex gap-2 mt-6 no-print">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!activeResult}
                      className="no-print"
                      onClick={() => {
                        if (!activeResult) return;
                        const asset = activeResult.ticker ?? "simulacao";
                        downloadCsv(buildMonteCarloRows(activeResult), `${asset}_montecarlo_${isoToday()}.csv`);
                      }}
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Exportar CSV
                    </Button>
                  </span>
                </TooltipTrigger>
                {!activeResult && <TooltipContent>Rode a simulação primeiro</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" onClick={printPage} className="no-print">
              <Printer className="w-4 h-4 mr-1.5" />
              Imprimir PDF
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          {historyLoading && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          {historyError && (
            <p className="text-sm text-red-600">{historyError}</p>
          )}
          {!historyLoading && !historyError && history.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma simulação encontrada.
            </p>
          )}
          {!historyLoading && history.length > 0 && (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleHistoryItemClick(item.id)}
                    className="w-full text-left rounded-lg border bg-card px-4 py-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.ticker}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {item.label ?? "—"} &middot; P50:{" "}
                      {item.p50.toFixed(2)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
