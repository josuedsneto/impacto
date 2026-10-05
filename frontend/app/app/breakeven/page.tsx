"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatBRL, formatCents, formatDate, formatFX, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import { CampoNumero } from "@/components/ui/campo-numero";
import { Leitura } from "@/components/ui/leitura";
import { leituraBreakeven } from "@/lib/leitura";
import { lerNumero } from "@/lib/numero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldTooltip } from "@/components/ui/field-tooltip";

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

function MetricItem({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ResultCards({ acucar, dolar, fator, breakeven }: {
  acucar: number; dolar: number; fator: number; breakeven: number;
}) {
  return (
    <>
      <Leitura>{leituraBreakeven({ acucar, dolar, breakeven })}</Leitura>
      <Card className="border-2 border-brand">
        <CardHeader><CardTitle className="text-lg">Breakeven</CardTitle></CardHeader>
        <CardContent>
          <MetricItem
            label="Preço mínimo de venda"
            value={`${formatBRL(breakeven)}/saca`}
            sub="Calculado com base nos dados informados"
          />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Preço Açúcar NY</CardTitle></CardHeader>
          <CardContent><MetricItem label="" value={formatCents(acucar)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Câmbio USD/BRL</CardTitle></CardHeader>
          <CardContent><MetricItem label="" value={formatFX(dolar)} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Fator de Conversão</CardTitle></CardHeader>
          <CardContent><MetricItem label="" value={formatNumber(fator, 4)} sub="¢/lb → R$/saca" /></CardContent>
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
  const [fator, setFator] = useState("1,12045");
  const [manualLabel, setManualLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // History tab
  const [history, setHistory] = useState<BreakevenSim[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    async function fetchLive() {
      try {
        const data = await apiFetch<BreakevenResult>("/api/breakeven");
        setLive(data);
        setLiveFator(String(data.fator_conversao).replace(".", ","));
      } catch (e) { setLiveError((e as Error).message); }
      finally { setLiveLoading(false); }
    }
    fetchLive();
  }, [tentativa]);

  const positivo = (t: string) => {
    const v = lerNumero(t);
    return v !== null && v > 0 ? v : null;
  };
  const liveFatorNum = positivo(liveFator);
  const liveBreakeven = live && liveFatorNum !== null
    ? live.preco_acucar_cents_lb * liveFatorNum * live.preco_dolar_brl : null;

  const manualAcucar = positivo(acucar);
  const manualDolar = positivo(dolar);
  const manualFator = positivo(fator);
  const manualBreakeven =
    manualAcucar !== null && manualDolar !== null && manualFator !== null
      ? manualAcucar * manualFator * manualDolar : null;

  async function handleSave() {
    if (manualBreakeven === null) { toast.error("Preencha açúcar, câmbio e fator com valores maiores que zero."); return; }
    setSaving(true);
    try {
      const data = await apiFetch<BreakevenSim>("/api/breakeven/save", {
        method: "POST",
        body: JSON.stringify({
          preco_acucar_cents_lb: manualAcucar,
          preco_dolar_brl: manualDolar,
          fator_conversao: manualFator,
          label: manualLabel.trim() || null,
        }),
      });
      toast.success("Simulação salva no histórico.");
      setHistory((prev) => [data, ...prev]);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleTabHistory() {
    if (historyLoaded) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await apiFetch<{ simulations?: BreakevenSim[] }>("/api/breakeven/history");
      setHistory(data.simulations ?? []);
      setHistoryLoaded(true);
    } catch (e) { setHistoryError((e as Error).message); }
    finally { setHistoryLoading(false); }
  }

  return (
    <div>
      <PageHeader
        titulo="Breakeven do açúcar"
        descricao="Converte o preço de NY e o câmbio em R$/saca, com dados ao vivo ou valores informados por você."
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === "historico") handleTabHistory(); }}>
        <TabsList>
          <TabsTrigger value="live">Ao vivo</TabsTrigger>
          <TabsTrigger value="manual">Manual</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ── Live ── */}
        <TabsContent value="live" className="space-y-6 mt-6">
          {liveLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          )}
          {liveError && (
            <ErrorState
              mensagem={liveError}
              onRetry={() => {
                setLiveError(null);
                setLiveLoading(true);
                setTentativa((t) => t + 1);
              }}
            />
          )}
          {!liveLoading && !liveError && live && (
            <>
              <CampoNumero
                id="live-fator"
                rotulo="Fator ¢/lb → R$/saca"
                ajuda="Converte o preço em centavos de dólar por libra para reais por saca. Mude para testar outro fator."
                valor={liveFator}
                onChange={setLiveFator}
                min={0.0001}
                max={100}
                className="max-w-xs"
              />
              {liveBreakeven !== null && (
                <ResultCards
                  acucar={live.preco_acucar_cents_lb}
                  dolar={live.preco_dolar_brl}
                  fator={liveFatorNum!}
                  breakeven={liveBreakeven}
                />
              )}
            </>
          )}
        </TabsContent>

        {/* ── Manual ── */}
        <TabsContent value="manual" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)] xl:items-start">
          <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoNumero
              id="m-acucar"
              rotulo="Açúcar NY"
              unidade="¢/lb"
              ajuda="Preço do açúcar em Nova York, em centavos de dólar por libra."
              valor={acucar}
              onChange={setAcucar}
              min={0.0001}
              max={1000}
              placeholder="ex.: 19,50"
            />
            <CampoNumero
              id="m-dolar"
              rotulo="Câmbio"
              unidade="R$/US$"
              ajuda="Quantos reais vale um dólar."
              valor={dolar}
              onChange={setDolar}
              min={0.0001}
              max={100}
              placeholder="ex.: 5,20"
            />
            <CampoNumero
              id="m-fator"
              rotulo="Fator ¢/lb → R$/saca"
              ajuda="Converte o preço em centavos de dólar por libra para reais por saca. O padrão é 1,12045."
              valor={fator}
              onChange={setFator}
              min={0.0001}
              max={100}
            />
            <div className="space-y-1">
              <Label htmlFor="m-label">
                Nome <span className="font-normal text-muted-foreground">· opcional</span>
                <FieldTooltip text="Ajuda a encontrar esta simulação depois, na aba Histórico." />
              </Label>
              <Input id="m-label" value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)} placeholder="ex.: Cenário pessimista" />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving || manualBreakeven === null} className="w-full">
            {saving ? "Salvando..." : "Salvar simulação"}
          </Button>
          </div>

          {manualBreakeven !== null ? (
            <div className="min-w-0 space-y-4">
              <ResultCards acucar={manualAcucar!} dolar={manualDolar!} fator={manualFator!} breakeven={manualBreakeven} />
            </div>
          ) : (
            <EmptyState mensagem="Informe o preço do açúcar, o câmbio e o fator para ver o breakeven." />
          )}
          </div>
        </TabsContent>

        {/* ── Histórico ── */}
        <TabsContent value="historico" className="mt-6">
          {historyLoading && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}
          {historyError && <ErrorState mensagem={historyError} onRetry={handleTabHistory} />}
          {!historyLoading && !historyError && history.length === 0 && (
            <EmptyState mensagem="Nenhuma simulação salva. Use a aba Manual para salvar a primeira." />
          )}
          {!historyLoading && history.length > 0 && (
            <ul className="space-y-2">
              {history.map((s) => (
                <li key={s.id} className="rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.label ?? "Sem nome"}</span>
                    <span className="text-sm text-muted-foreground">{formatDate(s.created_at)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Açúcar: {formatCents(s.preco_acucar_cents_lb)} · Dólar: {formatFX(s.preco_dolar_brl)} · Fator:{" "}
                    {formatNumber(s.fator_conversao, 4)} →{" "}
                    <span className="font-semibold text-foreground">{formatBRL(s.breakeven_brl_saca)}/saca</span>
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
