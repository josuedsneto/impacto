"use client";

import { useState, useEffect } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AcucarForm, { AcucarDefaults, AcucarResult } from "@/components/regression/AcucarForm";
import { AcucarMetrics } from "@/components/regression/AcucarMetrics";
import { AcucarHistoricoChart } from "@/components/regression/AcucarCharts";

interface HistoryItem {
  id: string;
  created_at: string;
  inputs: AcucarDefaults & { model: string };
  resultado: Omit<AcucarResult, "historico">;
}

export default function RegressaoAcucarPage() {
  const [defaults, setDefaults] = useState<AcucarDefaults | null>(null);
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<AcucarResult | null>(null);
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
        const data = await apiFetch<AcucarDefaults>(`/api/regression/acucar/defaults`);
        setDefaults(data);
      } catch (e) {
        setDefaultsError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
      } finally {
        setDefaultsLoading(false);
      }
    }
    loadDefaults();
  }, []);

  async function handleTabChange(value: string) {
    setActiveTab(value);
    if (value === "historico" && !historyLoaded) {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const data = await apiFetch<{ runs: HistoryItem[] }>(`/api/regression/runs?tipo=acucar`);
        setHistory(data.runs);
        setHistoryLoaded(true);
      } catch (e) {
        setHistoryError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Regressão Açúcar (SB=F)</h1>

      {defaultsError && <p className="text-sm text-red-600">{defaultsError}</p>}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="simular">Simular</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="simular" className="space-y-6 mt-6">
          {defaultsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados padrão...</p>
          ) : (
            <AcucarForm defaults={defaults} onResult={setActiveResult} />
          )}

          {activeResult && (
            <div className="space-y-6">
              <AcucarMetrics result={activeResult} />
              <AcucarHistoricoChart result={activeResult} />
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
          {!historyLoading && history.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma execução encontrada.</p>
          )}
          {!historyLoading && history.length > 0 && (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id}>
                  <div className="rounded-lg border bg-card px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        SB=F Previsto: {item.resultado.sb_f_previsto.toFixed(2)} ¢/lb
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Modelo: {item.inputs.model} &middot; R²: {item.resultado.r2.toFixed(4)} &middot; RMSE: {item.resultado.rmse.toFixed(4)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Range: {item.resultado.sb_f_min.toFixed(2)} – {item.resultado.sb_f_max.toFixed(2)} ¢/lb
                    </div>
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
