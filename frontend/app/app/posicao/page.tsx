"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface Fixacao {
  id: string;
  ticker: string;
  volume: number;
  preco: number;
  data_fixacao: string;
  label: string | null;
  created_at: string;
}

interface CoverturaSummary {
  ticker: string;
  volume_total: number;
  preco_medio: number | null;
  preco_atual: number | null;
  coverage_pct: number | null;
  n_fixacoes: number;
}

interface AuditEntry {
  id: string;
  fixacao_id: string | null;
  action: "created" | "deleted";
  snapshot: Record<string, unknown>;
  created_at: string;
}

const TICKERS = [
  { id: "SB=F",     label: "Açúcar NY (SB=F)",  unit: "¢/lb" },
  { id: "USDBRL=X", label: "USD/BRL",            unit: "R$/USD" },
];

function unit(ticker: string) {
  return TICKERS.find((t) => t.id === ticker)?.unit ?? "";
}

async function getToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function fmtNum(v: number | null | undefined, dec = 2) {
  if (v == null) return "—";
  return v.toFixed(dec).replace(".", ",");
}

function MetricCard({ label, value, sub, highlight }: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "green" | "red" | "neutral";
}) {
  const valueColor =
    highlight === "green" ? "#16a34a" :
    highlight === "red"   ? "#dc2626" :
    undefined;
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold" style={{ color: valueColor }}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function PosicaoPage() {
  const [activeTicker, setActiveTicker] = useState("SB=F");
  const [activeTab, setActiveTab] = useState<"posicao" | "auditoria">("posicao");
  const [fixacoes, setFixacoes] = useState<Fixacao[]>([]);
  const [summary, setSummary] = useState<CoverturaSummary | null>(null);
  const [producaoTotal, setProducaoTotal] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);

  // audit
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // share modal
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // pdf
  const [downloading, setDownloading] = useState(false);

  // form state
  const [fTicker, setFTicker] = useState("SB=F");
  const [fVolume, setFVolume] = useState("");
  const [fPreco, setFPreco] = useState("");
  const [fData, setFData] = useState(() => new Date().toISOString().slice(0, 10));
  const [fLabel, setFLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const [listRes, sumRes, subRes] = await Promise.all([
        fetch(`${API}/api/cobertura`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(
          `${API}/api/cobertura/summary?ticker=${encodeURIComponent(activeTicker)}&producao_total=${producaoTotal || 0}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        fetch(`${API}/api/billing/subscription`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (listRes.ok) {
        const d = await listRes.json();
        setFixacoes(d.fixacoes ?? []);
      }
      if (sumRes.ok) {
        setSummary(await sumRes.json());
      }
      if (subRes.ok) {
        const sub = await subRes.json();
        setIsPro(sub.plan === "pro" || sub.plan === "enterprise");
      }
    } catch {
      toast.error("Erro ao carregar posição.");
    } finally {
      setLoading(false);
    }
  }, [activeTicker, producaoTotal]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/cobertura/audit`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        setAuditEntries(d.entries ?? []);
      }
    } catch {
      toast.error("Erro ao carregar auditoria.");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "auditoria") fetchAudit();
  }, [activeTab, fetchAudit]);

  async function handleCreate() {
    if (!fVolume || !fPreco || !fData) {
      toast.error("Preencha volume, preço e data.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/cobertura`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: fTicker,
          volume: parseFloat(fVolume),
          preco: parseFloat(fPreco),
          data_fixacao: fData,
          label: fLabel.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.detail ?? "Erro ao registrar fixação.");
        return;
      }
      toast.success("Fixação registrada!");
      setFVolume("");
      setFPreco("");
      setFLabel("");
      fetchData();
    } catch {
      toast.error("Erro de conexão.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/cobertura/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      toast.success("Fixação removida.");
      setFixacoes((prev) => prev.filter((f) => f.id !== id));
      fetchData();
    } catch {
      toast.error("Erro ao remover.");
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/reports/posicao`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        toast.error("Relatórios PDF disponíveis no plano Profissional ou superior.");
        return;
      }
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_posicao_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/share`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "posicao", expires_days: 30 }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShareUrl(data.url);
    } catch {
      toast.error("Erro ao criar link de compartilhamento.");
    } finally {
      setSharing(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado!");
  }

  const tickerFixacoes = fixacoes.filter((f) => f.ticker === activeTicker);
  const pl = summary?.preco_medio != null && summary?.preco_atual != null
    ? summary.preco_medio - summary.preco_atual
    : null;

  return (
    <div className="space-y-6 px-7 py-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Posição de Hedge</h1>
        <div className="flex gap-2 flex-wrap">
          {/* Ticker tabs */}
          {TICKERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTicker(t.id)}
              className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                activeTicker === t.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary"
              }`}
            >
              {t.label}
            </button>
          ))}

          {/* Share button */}
          <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
            {sharing ? "Gerando..." : "Compartilhar"}
          </Button>

          {/* PDF button — Pro-gated */}
          {isPro ? (
            <Button size="sm" onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? "Gerando PDF..." : "Gerar PDF"}
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="sm" disabled>Gerar PDF</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Disponível no plano Profissional ou superior</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Share URL banner */}
      {shareUrl && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm text-muted-foreground flex-1 truncate">{shareUrl}</span>
          <Button size="sm" variant="outline" onClick={copyShareUrl}>Copiar link</Button>
          <button
            onClick={() => setShareUrl(null)}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        {(["posicao", "auditoria"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "posicao" ? "Posição" : "Auditoria"}
          </button>
        ))}
      </div>

      {activeTab === "posicao" && (
        <>
          {/* Summary metrics */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <MetricCard
              label="Cobertura"
              value={summary?.coverage_pct != null ? `${fmtNum(summary.coverage_pct, 1)}%` : "—"}
              sub={`${summary?.n_fixacoes ?? 0} fixação(ões)`}
              highlight={
                summary?.coverage_pct != null
                  ? summary.coverage_pct >= 70 ? "green" : summary.coverage_pct < 30 ? "red" : "neutral"
                  : undefined
              }
            />
            <MetricCard
              label={`Preço Médio Fixado (${unit(activeTicker)})`}
              value={fmtNum(summary?.preco_medio, 4)}
            />
            <MetricCard
              label={`Preço Atual (${unit(activeTicker)})`}
              value={fmtNum(summary?.preco_atual, 4)}
            />
            <MetricCard
              label={`P&L por Unidade (${unit(activeTicker)})`}
              value={pl != null ? `${pl >= 0 ? "+" : ""}${fmtNum(pl, 4)}` : "—"}
              sub="Fixado vs mercado"
              highlight={pl != null ? (pl >= 0 ? "green" : "red") : undefined}
            />
          </div>

          {/* Coverage bar */}
          {summary?.coverage_pct != null && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Volume fixado: <strong>{fmtNum(summary.volume_total, 0)}</strong> unidades · Produção total: <strong>{producaoTotal || "—"}</strong>
              </p>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(summary.coverage_pct, 100)}%`,
                    background: summary.coverage_pct >= 70 ? "#16a34a" : summary.coverage_pct >= 30 ? "#ca8a04" : "#dc2626",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{fmtNum(summary.coverage_pct, 1)}% coberto</p>
            </div>
          )}

          {/* New fixacao form */}
          <Card>
            <CardHeader><CardTitle>Registrar Fixação</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label>Ticker</Label>
                  <Select value={fTicker} onValueChange={setFTicker}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKERS.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Data da Fixação</Label>
                  <Input
                    type="date"
                    value={fData}
                    onChange={(e) => setFData(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Volume (lotes/sacas)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    value={fVolume}
                    onChange={(e) => setFVolume(e.target.value)}
                    placeholder="100"
                    className="w-36"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Preço fixado ({unit(fTicker)})</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={fPreco}
                    onChange={(e) => setFPreco(e.target.value)}
                    placeholder="0.0000"
                    className="w-36"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Label (opcional)</Label>
                  <Input
                    value={fLabel}
                    onChange={(e) => setFLabel(e.target.value)}
                    placeholder="Ex: Safra 25/26"
                    className="w-40"
                  />
                </div>
                <Button onClick={handleCreate} disabled={submitting}>
                  {submitting ? "Registrando..." : "Registrar"}
                </Button>
              </div>

              {/* producao_total helper */}
              <div className="mt-4 flex items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Produção/exposição total (para % cobertura)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={producaoTotal}
                    onChange={(e) => setProducaoTotal(e.target.value)}
                    className="w-40"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                  Atualizar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Fixacoes list */}
          <Card>
            <CardHeader>
              <CardTitle>
                Fixações — {TICKERS.find((t) => t.id === activeTicker)?.label}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({tickerFixacoes.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 rounded bg-muted animate-pulse" />
                  ))}
                </div>
              ) : tickerFixacoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma fixação registrada para este ativo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-4 font-medium">Data</th>
                        <th className="text-right py-2 pr-4 font-medium">Volume</th>
                        <th className="text-right py-2 pr-4 font-medium">Preço ({unit(activeTicker)})</th>
                        <th className="text-right py-2 pr-4 font-medium">P&L unit.</th>
                        <th className="text-left py-2 pr-4 font-medium">Label</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {tickerFixacoes.map((f) => {
                        const rowPl = summary?.preco_atual != null ? f.preco - summary.preco_atual : null;
                        return (
                          <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 pr-4 font-mono text-xs">
                              {new Date(f.data_fixacao + "T12:00:00").toLocaleDateString("pt-BR")}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-medium">
                              {fmtNum(f.volume, 0)}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-medium">
                              {fmtNum(f.preco, 4)}
                            </td>
                            <td
                              className="py-2.5 pr-4 text-right font-medium text-xs"
                              style={{ color: rowPl == null ? undefined : rowPl >= 0 ? "#16a34a" : "#dc2626" }}
                            >
                              {rowPl != null ? `${rowPl >= 0 ? "+" : ""}${fmtNum(rowPl, 4)}` : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                              {f.label ?? "—"}
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => handleDelete(f.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors text-lg leading-none"
                                aria-label="Remover"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "auditoria" && (
        <Card>
          <CardHeader>
            <CardTitle>Log de Auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : auditEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma entrada de auditoria encontrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 pr-4 font-medium">Data/Hora</th>
                      <th className="text-left py-2 pr-4 font-medium">Ação</th>
                      <th className="text-left py-2 pr-4 font-medium">Ticker</th>
                      <th className="text-right py-2 pr-4 font-medium">Volume</th>
                      <th className="text-right py-2 font-medium">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditEntries.map((e) => {
                      const snap = e.snapshot as Record<string, unknown>;
                      return (
                        <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 pr-4 font-mono text-xs">
                            {new Date(e.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                background: e.action === "created" ? "#dcfce7" : "#fee2e2",
                                color: e.action === "created" ? "#15803d" : "#dc2626",
                              }}
                            >
                              {e.action === "created" ? "Criada" : "Removida"}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs">{String(snap.ticker ?? "—")}</td>
                          <td className="py-2.5 pr-4 text-right text-xs">{snap.volume != null ? Number(snap.volume).toLocaleString("pt-BR") : "—"}</td>
                          <td className="py-2.5 text-right text-xs">{snap.preco != null ? Number(snap.preco).toFixed(4) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
