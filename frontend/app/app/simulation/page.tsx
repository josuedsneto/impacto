"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SimulationForm, {
  SimulationResult,
} from "@/components/simulation/SimulationForm";
import FanChart from "@/components/simulation/FanChart";
import SimulationMetrics from "@/components/simulation/SimulationMetrics";

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
        const data = await apiFetch<{ simulations: HistorySummary[] }>(`/api/simulations`);
        setHistory(data.simulations);
        setHistoryLoaded(true);
      } catch (e) {
        setHistoryError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  async function handleHistoryItemClick(id: string) {
    try {
      const data = await apiFetch<SimulationResult>(`/api/simulations/${id}`);
      setActiveResult(data);
      setActiveTab("simular");
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
                      {item.p50 != null ? item.p50.toFixed(2) : "—"}
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
