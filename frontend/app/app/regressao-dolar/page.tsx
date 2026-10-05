"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Leitura } from "@/components/ui/leitura";
import { leituraRegDolar } from "@/lib/leitura";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDate, formatFX, formatNumber } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DolarForm, { DolarDefaults, DolarResult } from "@/components/regression/DolarForm";
import { DolarMetrics } from "@/components/regression/DolarMetrics";
import { CorrelationHeatmap, CoeficientesChart } from "@/components/regression/DolarCharts";

interface HistoryItem {
  id: string;
  created_at: string;
  inputs: DolarDefaults;
  resultado: DolarResult;
}

export default function RegressaoDolarPage() {
  const [defaults, setDefaults] = useState<DolarDefaults | null>(null);
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<DolarResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("simular");

  useEffect(() => {
    async function loadDefaults() {
      setDefaultsLoading(true);
      setDefaultsError(null);
      try {
        setDefaults(await apiFetch<DolarDefaults>("/api/regression/dolar/defaults", { timeoutMs: 120_000 }));
      } catch (e) {
        setDefaultsError((e as Error).message);
      } finally {
        setDefaultsLoading(false);
      }
    }
    loadDefaults();
  }, []);

  async function carregarHistorico() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await apiFetch<{ runs: HistoryItem[] }>("/api/regression/runs?tipo=dolar");
      setHistory(data.runs);
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

  return (
    <div>
      <PageHeader titulo="Regressão do dólar" descricao="Estima o dólar a partir de juros, moeda e produção no Brasil e nos EUA (modelo de regressão linear)." />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="simular">Simular</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="simular" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)] xl:items-start">
            <div className="space-y-3 rounded-xl border border-border bg-card p-6">
              {defaultsError && (
                <p role="status" className="text-sm text-negative">
                  Não foi possível carregar os valores atuais ({defaultsError}). Preencha os campos manualmente.
                </p>
              )}
              {defaultsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <DolarForm defaults={defaults} onResult={setActiveResult} />
              )}
            </div>

            {activeResult ? (
              <div className="min-w-0 space-y-6">
                <Leitura>{leituraRegDolar({ taxa: activeResult.taxa_prevista, rmse: activeResult.rmse })}</Leitura>
                <DolarMetrics result={activeResult} />
                <CorrelationHeatmap result={activeResult} />
                <CoeficientesChart result={activeResult} />
              </div>
            ) : (
              <EmptyState mensagem="Confira os valores e clique em Calcular previsão para ver o resultado." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          {historyLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}
          {historyError && <ErrorState mensagem={historyError} onRetry={carregarHistorico} />}
          {!historyLoading && !historyError && history.length === 0 && (
            <EmptyState mensagem="Nenhuma previsão calculada ainda." />
          )}
          {!historyLoading && history.length > 0 && (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id} className="rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Dólar previsto: {formatFX(item.resultado.taxa_prevista)}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(item.created_at)}</span>
                  </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      R²: {formatNumber(item.resultado.r2, 4)} · Erro médio: {formatFX(item.resultado.rmse)}
                    </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
