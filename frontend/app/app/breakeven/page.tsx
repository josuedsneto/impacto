"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldTooltip } from "@/components/ui/field-tooltip";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface BreakevenResult {
  preco_acucar_cents_lb: number;
  preco_dolar_brl: number;
  fator_conversao: number;
  breakeven_brl_saca: number;
}

interface BreakevenSim {
  id: string;
  preco_acucar_cents_lb: number;
  preco_dolar_brl: number;
  fator_conversao: number;
  breakeven_brl_saca: number;
  label: string | null;
  created_at: string;
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function MetricItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ResultCards({ acucar, dolar, fator, breakeven }: {
  acucar: number; dolar: number; fator: number; breakeven: number;
}) {
  return (
    <>
      <Card className="border-2 border-primary">
        <CardHeader><CardTitle className="text-lg">Breakeven</CardTitle></CardHeader>
        <CardContent>
          <MetricItem
            label="Preço mínimo de venda"
            value={`R$ ${breakeven.toFixed(2)}/saca`}
            sub="Calculado com base nos dados informados"
          />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Preço Açúcar NY</CardTitle></CardHeader>
          <CardContent><MetricItem label="" value={`${acucar.toFixed(2)} ¢/lb`} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Câmbio USD/BRL</CardTitle></CardHeader>
          <CardContent><MetricItem label="" value={`R$ ${dolar.toFixed(4)}`} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Fator de Conversão</CardTitle></CardHeader>
          <CardContent><MetricItem label="" value={fator.toFixed(4)} sub="¢/lb → R$/saca" /></CardContent>
        </Card>
      </div>
    </>
  );
}

export default function BreakevenPage() {
  const [tab, setTab] = useState("live");

  // Live tab
  const [live, setLive] = useState<BreakevenResult | null>(null);
  const [liveFator, setLiveFator] = useState("");
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Manual tab
  const [acucar, setAcucar] = useState("");
  const [dolar, setDolar] = useState("");
  const [fator, setFator] = useState("1.12045");
  const [manualLabel, setManualLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // History tab
  const [history, setHistory] = useState<BreakevenSim[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    async function fetchLive() {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/breakeven`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) { setLiveError(data.detail ?? "Erro."); return; }
        setLive(data as BreakevenResult);
        setLiveFator(String((data as BreakevenResult).fator_conversao));
      } catch { setLiveError("Erro de conexão."); }
      finally { setLiveLoading(false); }
    }
    fetchLive();
  }, []);

  const liveFatorNum = parseFloat(liveFator);
  const liveBreakeven = live && !isNaN(liveFatorNum) && liveFatorNum > 0
    ? live.preco_acucar_cents_lb * liveFatorNum * live.preco_dolar_brl : null;

  const manualAcucar = parseFloat(acucar);
  const manualDolar = parseFloat(dolar);
  const manualFator = parseFloat(fator);
  const manualBreakeven =
    !isNaN(manualAcucar) && !isNaN(manualDolar) && !isNaN(manualFator) &&
    manualAcucar > 0 && manualDolar > 0 && manualFator > 0
      ? manualAcucar * manualFator * manualDolar : null;

  async function handleSave() {
    if (manualBreakeven === null) { setSaveError("Preencha todos os campos."); return; }
    setSaving(true); setSaveMsg(null); setSaveError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/breakeven/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          preco_acucar_cents_lb: manualAcucar,
          preco_dolar_brl: manualDolar,
          fator_conversao: manualFator,
          label: manualLabel.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.detail ?? "Erro ao salvar."); }
      else {
        setSaveMsg("Simulação salva!");
        setHistory((prev) => [data as BreakevenSim, ...prev]);
      }
    } catch { setSaveError("Erro de conexão."); }
    finally { setSaving(false); }
  }

  async function handleTabHistory() {
    if (historyLoaded) return;
    setHistoryLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/breakeven/history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) { setHistory(data.simulations ?? []); setHistoryLoaded(true); }
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Breakeven — Açúcar</h1>
        <p className="text-sm text-muted-foreground mt-1">Preço mínimo de venda para cobrir custos de produção</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "historico") handleTabHistory(); }}>
        <TabsList>
          <TabsTrigger value="live">Live</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ── Live ── */}
        <TabsContent value="live" className="space-y-6 mt-6">
          {liveLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {liveError && <p className="text-sm text-red-600">{liveError}</p>}
          {!liveLoading && !liveError && live && (
            <>
              <div className="max-w-xs space-y-1">
                <Label htmlFor="live-fator">
                  Fator de conversão{" "}
                  <FieldTooltip text="Converte ¢/lb para R$/saca. Ajuste para simular diferentes cenários." />
                </Label>
                <Input
                  id="live-fator"
                  type="number"
                  step={0.0001}
                  min={0.0001}
                  value={liveFator}
                  onChange={(e) => setLiveFator(e.target.value)}
                />
              </div>
              {liveBreakeven !== null && (
                <ResultCards
                  acucar={live.preco_acucar_cents_lb}
                  dolar={live.preco_dolar_brl}
                  fator={liveFatorNum}
                  breakeven={liveBreakeven}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* ── Manual ── */}
        <TabsContent value="manual" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
            <div className="space-y-1">
              <Label htmlFor="m-acucar">
                Preço açúcar (¢/lb){" "}
                <FieldTooltip text="Preço do açúcar NY #11 em centavos de dólar por libra" />
              </Label>
              <Input id="m-acucar" type="number" step={0.01} min={0} value={acucar}
                onChange={(e) => setAcucar(e.target.value)} placeholder="ex: 19.50" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-dolar">
                Câmbio USD/BRL{" "}
                <FieldTooltip text="Taxa de câmbio dólar/real" />
              </Label>
              <Input id="m-dolar" type="number" step={0.01} min={0} value={dolar}
                onChange={(e) => setDolar(e.target.value)} placeholder="ex: 5.20" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-fator">
                Fator de conversão{" "}
                <FieldTooltip text="Converte ¢/lb para R$/saca. Padrão: 1.12045" />
              </Label>
              <Input id="m-fator" type="number" step={0.0001} min={0.0001} value={fator}
                onChange={(e) => setFator(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="m-label">
                Nome (opcional){" "}
                <FieldTooltip text="Identificador para esta simulação no histórico" />
              </Label>
              <Input id="m-label" value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)} placeholder="ex: Cenário pessimista" />
            </div>
          </div>

          {manualBreakeven !== null && (
            <ResultCards
              acucar={manualAcucar}
              dolar={manualDolar}
              fator={manualFator}
              breakeven={manualBreakeven}
            />
          )}

          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={saving || manualBreakeven === null}>
              {saving ? "Salvando..." : "Salvar simulação"}
            </Button>
            {saveMsg && <p className="text-sm text-green-600">{saveMsg}</p>}
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </div>
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="historico" className="mt-6">
          {historyLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!historyLoading && history.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma simulação salva.</p>
          )}
          {!historyLoading && history.length > 0 && (
            <ul className="space-y-2">
              {history.map((s) => (
                <li key={s.id} className="rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.label ?? "—"}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Açúcar: {s.preco_acucar_cents_lb} ¢/lb · Dólar: R$ {s.preco_dolar_brl} ·
                    Fator: {s.fator_conversao} →{" "}
                    <span className="font-semibold text-foreground">
                      R$ {s.breakeven_brl_saca.toFixed(2)}/saca
                    </span>
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
