"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
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

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
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
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/regression/dolar/defaults`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setDefaultsError(data.detail ?? "Erro ao carregar valores padrão.");
        } else {
          setDefaults(data as DolarDefaults);
        }
      } catch {
        setDefaultsError("Erro de conexão com o servidor.");
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
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/regression/runs?tipo=dolar`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setHistoryError(data.detail ?? "Erro ao carregar histórico.");
        } else {
          setHistory((data as { runs: HistoryItem[] }).runs);
          setHistoryLoaded(true);
        }
      } catch {
        setHistoryError("Erro de conexão com o servidor.");
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Regressão Dólar (USD/BRL)</h1>

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
            <DolarForm defaults={defaults} onResult={setActiveResult} />
          )}

          {activeResult && (
            <div className="space-y-6">
              <DolarMetrics result={activeResult} />
              <CorrelationHeatmap result={activeResult} />
              <CoeficientesChart result={activeResult} />
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
                        USD/BRL Previsão: {item.resultado.taxa_prevista.toFixed(4)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      R²: {item.resultado.r2.toFixed(4)} &middot; RMSE:{" "}
                      {item.resultado.rmse.toFixed(4)}
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
