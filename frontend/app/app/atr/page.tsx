"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AtrForm, { Usina, AtrResult } from "@/components/atr/AtrForm";
import { AtrMetrics } from "@/components/atr/AtrMetrics";
import { AtrHistorico, HistoricoItem } from "@/components/atr/AtrHistorico";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function getCurrentUserId(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
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
        const [token, userId] = await Promise.all([getAccessToken(), getCurrentUserId()]);
        setCurrentUserId(userId);

        const res = await fetch(`${API}/api/atr/usinas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setUsinasError((data as { detail?: string }).detail ?? "Erro ao carregar usinas.");
        } else {
          setUsinas((data as { usinas: Usina[] }).usinas);
        }
      } catch {
        setUsinasError("Erro de conexão com o servidor.");
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

  async function handleTabChange(value: string) {
    setActiveTab(value);
    if (value === "historico" && !historicoLoaded) {
      if (!selectedUsinaId) {
        // Cannot load historico without a selected usina
        setHistoricoError("Selecione uma usina na aba Simular para ver o histórico.");
        return;
      }
      setHistoricoLoading(true);
      setHistoricoError(null);
      try {
        const token = await getAccessToken();
        const url = `${API}/api/atr/historico?usina_id=${encodeURIComponent(selectedUsinaId)}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setHistoricoError((data as { detail?: string }).detail ?? "Erro ao carregar histórico.");
        } else {
          setHistorico((data as { historico: HistoricoItem[] }).historico);
          setHistoricoLoaded(true);
        }
      } catch {
        setHistoricoError("Erro de conexão com o servidor.");
      } finally {
        setHistoricoLoading(false);
      }
    }
  }

  function handleResult(result: AtrResult) {
    setActiveResult(result);
    // Invalidate historico so next visit to the tab reloads with the new entry
    setHistoricoLoaded(false);
  }

  async function handleToggleShare(id: string, compartilhado: boolean) {
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/atr/simulacoes/${encodeURIComponent(id)}/compartilhar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ compartilhado }),
      });
      if (res.ok) {
        setHistorico((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, compartilhado } : item
          )
        );
      }
    } catch {
      // Silently fail — user can retry
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">ATR — Açúcar Total Recuperável</h1>

      {usinasError && <p className="text-sm text-red-600">{usinasError}</p>}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="simular">Simular</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="simular" className="space-y-6 mt-6">
          {usinasLoading ? (
            <p className="text-sm text-muted-foreground">Carregando usinas...</p>
          ) : (
            <AtrForm
              usinas={usinas}
              onResult={handleResult}
              onUsinaChange={setSelectedUsinaId}
            />
          )}

          {activeResult && <AtrMetrics result={activeResult} />}
        </TabsContent>

        <TabsContent value="historico" className="mt-6">
          {historicoLoading && (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          )}
          {historicoError && (
            <p className="text-sm text-red-600">{historicoError}</p>
          )}
          {!historicoLoading && !historicoError && historicoLoaded && historico.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma simulação encontrada.</p>
          )}
          {!historicoLoading && historico.length > 0 && (
            <AtrHistorico
              historico={historico}
              onToggleShare={handleToggleShare}
              currentUserId={currentUserId ?? ""}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
