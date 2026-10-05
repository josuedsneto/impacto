"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Leitura } from "@/components/ui/leitura";
import { leituraAtr } from "@/lib/leitura";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AtrForm, { Usina, AtrResult } from "@/components/atr/AtrForm";
import { AtrMetrics } from "@/components/atr/AtrMetrics";
import { AtrHistorico, HistoricoItem } from "@/components/atr/AtrHistorico";

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await createClient().auth.getSession();
  return data.session?.user.id ?? null;
}

export default function AtrPage() {
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [usinasLoading, setUsinasLoading] = useState(true);
  const [usinasError, setUsinasError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<AtrResult | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoLoaded, setHistoricoLoaded] = useState(false);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("simular");
  const [selectedUsinaId, setSelectedUsinaId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      setUsinasLoading(true);
      setUsinasError(null);
      try {
        const [data, userId] = await Promise.all([
          apiFetch<{ usinas: Usina[] }>("/api/atr/usinas"),
          getCurrentUserId(),
        ]);
        setCurrentUserId(userId);
        setUsinas(data.usinas);
      } catch (e) {
        setUsinasError((e as Error).message);
      } finally {
        setUsinasLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    setHistoricoLoaded(false);
    setHistoricoError(null);
  }, [selectedUsinaId]);

  async function carregarHistorico() {
    setHistoricoLoading(true);
    setHistoricoError(null);
    try {
      const data = await apiFetch<{ historico: HistoricoItem[] }>(
        `/api/atr/historico?usina_id=${encodeURIComponent(selectedUsinaId)}`
      );
      setHistorico(data.historico);
      setHistoricoLoaded(true);
    } catch (e) {
      setHistoricoError((e as Error).message);
    } finally {
      setHistoricoLoading(false);
    }
  }

  function handleTabChange(value: string) {
    setActiveTab(value);
    if (value === "historico" && !historicoLoaded) {
      if (!selectedUsinaId) {
        setHistoricoError("Selecione uma usina na aba Simular para ver o histórico.");
        return;
      }
      carregarHistorico();
    }
  }

  function handleResult(result: AtrResult) {
    setActiveResult(result);
    // Invalidate historico so next visit to the tab reloads with the new entry
    setHistoricoLoaded(false);
  }

  async function handleToggleShare(id: string, compartilhado: boolean) {
    try {
      await apiFetch(`/api/atr/simulacoes/${encodeURIComponent(id)}/compartilhar`, {
        method: "PATCH",
        body: JSON.stringify({ compartilhado }),
      });
      setHistorico((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, compartilhado } : item
        )
      );
      toast.success(compartilhado ? "Simulação compartilhada com a usina." : "Simulação agora é privada.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        titulo="ATR da usina"
        descricao="Estima o açúcar total recuperável (kg por tonelada de cana) a partir de chuva e impureza, com faixa de 90%."
      />

      {usinasError && <ErrorState mensagem={usinasError} onRetry={() => window.location.reload()} />}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="simular">Simular</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="simular" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)] xl:items-start">
            <div className="rounded-xl border border-border bg-card p-6">
              {usinasLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : (
                <AtrForm usinas={usinas} onResult={handleResult} onUsinaChange={setSelectedUsinaId} />
              )}
            </div>

            {activeResult ? (
              <div className="min-w-0 space-y-4">
                <Leitura>
                  {leituraAtr({
                    chuva: activeResult.entrada?.chuva_mm,
                    impureza: activeResult.entrada?.impureza_pct,
                    atr: activeResult.atr_esperado,
                    min: activeResult.atr_min,
                    max: activeResult.atr_max,
                    producao: activeResult.producao_total,
                  })}
                </Leitura>
                <AtrMetrics result={activeResult} />
              </div>
            ) : (
              <EmptyState mensagem="Escolha a usina, informe chuva e impureza e clique em Simular." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          {historicoLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}
          {historicoError && (
            <ErrorState mensagem={historicoError} onRetry={selectedUsinaId ? carregarHistorico : undefined} />
          )}
          {!historicoLoading && !historicoError && historicoLoaded && historico.length === 0 && (
            <EmptyState mensagem="Nenhuma simulação para esta usina ainda." />
          )}
          {!historicoLoading && historico.length > 0 && (
            <AtrHistorico historico={historico} onToggleShare={handleToggleShare} currentUserId={currentUserId ?? ""} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
