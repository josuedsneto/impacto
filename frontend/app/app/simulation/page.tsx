"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SimulationForm, {
  SimulationResult,
} from "@/components/simulation/SimulationForm";
import FanChart from "@/components/simulation/FanChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatPreco } from "@/lib/format";
import { Leitura } from "@/components/ui/leitura";
import { leituraMonteCarlo } from "@/lib/leitura";
import { nomeAtivo, unidadeAtivo } from "@/lib/ativos";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { gerarCsv, nomeArquivo } from "@/lib/csv";

import { toast } from "sonner";
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

  async function carregarHistorico() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await apiFetch<{ simulations: HistorySummary[] }>("/api/simulations");
      setHistory(data.simulations);
      setHistoryLoaded(true);
    } catch (e) {
      setHistoryError((e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    if (value === "historico" && !historyLoaded) carregarHistorico();
  }

  async function handleHistoryItemClick(id: string) {
    try {
      setActiveResult(await apiFetch<SimulationResult>(`/api/simulations/${id}`));
      setActiveTab("simular");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  // CSV: percentis por dia útil, com os parâmetros da simulação no cabeçalho.
  function montarCsv(r: SimulationResult) {
    const u = unidadeAtivo(r.ticker);
    const chaves = ["p5", "p20", "p25", "p50", "p75", "p80", "p95"].filter((k) => r.percentiles_series[k]);
    return gerarCsv({
      parametros: [
        ["Ativo", nomeAtivo(r.ticker)],
        [`Preço de partida${u ? ` (${u})` : ""}`, r.preco_inicial],
        ["Prazo (dias úteis)", r.dias_simulados],
        ["Cenários", r.num_simulacoes],
        ["Variação máxima (%)", r.pct_bound * 100],
      ],
      tabelas: [
        {
          colunas: ["Dia útil", ...chaves.map((k) => `${k.toUpperCase()}${u ? ` (${u})` : ""}`)],
          linhas: Array.from({ length: r.dias_simulados }, (_, i) => [i + 1, ...chaves.map((k) => r.percentiles_series[k][i])]),
        },
      ],
    });
  }

  return (
    <div>
      <PageHeader
        titulo="Monte Carlo"
        descricao="Milhares de cenários de preço futuro a partir da volatilidade histórica do ativo."
        acoes={
          <BotaoExportar
            arquivo={nomeArquivo("Monte Carlo", activeResult?.ticker)}
            montar={activeResult ? () => montarCsv(activeResult) : null}
          />
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="simular">Simular</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="simular" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
            <div className="rounded-xl border border-border bg-card p-6">
              <SimulationForm onResult={handleNewResult} />
            </div>

            {activeResult ? (
              <div className="min-w-0 space-y-6">
                <Leitura>
                  {leituraMonteCarlo({
                    ticker: activeResult.ticker,
                    dias: activeResult.dias_simulados,
                    p5: activeResult.p5,
                    p50: activeResult.p50,
                    p95: activeResult.p95,
                  })}
                </Leitura>
                <SimulationMetrics result={activeResult} />
                <FanChart series={activeResult.percentiles_series} dias_simulados={activeResult.dias_simulados} />
              </div>
            ) : (
              <EmptyState mensagem="Preencha os parâmetros e clique em Simular para ver a faixa de preços." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          {historyLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}
          {historyError && <ErrorState mensagem={historyError} onRetry={carregarHistorico} />}
          {!historyLoading && !historyError && history.length === 0 && (
            <EmptyState mensagem="Nenhuma simulação salva ainda." />
          )}
          {!historyLoading && history.length > 0 && (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleHistoryItemClick(item.id)}
                    className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{nomeAtivo(item.ticker)}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {item.label ?? "Sem nome"} · Mediana: {formatPreco(item.ticker, item.p50)}
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
