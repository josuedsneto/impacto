"use client";

import { useState, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TICKERS = [
  { id: "SB=F", label: "Açúcar NY (SB=F)" },
  { id: "USDBRL=X", label: "USD/BRL" },
  { id: "CL=F", label: "Petróleo WTI (CL=F)" },
  { id: "BZ=F", label: "Petróleo Brent (BZ=F)" },
  { id: "GC=F", label: "Ouro (GC=F)" },
];

const PERIODS = ["3mo", "6mo", "1y", "2y"] as const;
const PERIOD_LABELS: Record<string, string> = { "3mo": "3 meses", "6mo": "6 meses", "1y": "1 ano", "2y": "2 anos" };

function corrColor(v: number): string {
  if (v >= 0.99) return "#374151";
  if (v >= 0.7)  return "#166534";
  if (v >= 0.3)  return "#854d0e";
  if (v <= -0.7) return "#991b1b";
  if (v <= -0.3) return "#9a3412";
  return "#1e3a5f";
}

function corrBg(v: number): string {
  if (v >= 0.99) return "#1f2937";
  if (v >= 0.7)  return "#dcfce7";
  if (v >= 0.3)  return "#fef9c3";
  if (v <= -0.7) return "#fee2e2";
  if (v <= -0.3) return "#ffedd5";
  return "#eff6ff";
}

export default function CorrelacaoPage() {
  const [selected, setSelected] = useState<string[]>(["SB=F", "USDBRL=X", "CL=F"]);
  const [period, setPeriod] = useState<string>("1y");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ tickers: string[]; matrix: number[][]; n_observations: number } | null>(null);

  function toggleTicker(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  const handleCalculate = useCallback(async () => {
    if (selected.length < 2) { toast.error("Selecione ao menos 2 ativos."); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ tickers: selected.join(","), period });
      const data = await apiFetch<{ tickers: string[]; matrix: number[][]; n_observations: number }>(
        `/api/correlation?${params}`
      );
      setResult(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [selected, period]);

  return (
    <div className="space-y-6 px-7 py-6">
      <h1 className="text-2xl font-semibold">Matriz de Correlação</h1>

      <Card>
        <CardHeader><CardTitle>Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Ativos</p>
            <div className="flex flex-wrap gap-2">
              {TICKERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTicker(t.id)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    selected.includes(t.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Período</p>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded text-sm border transition-colors ${
                    period === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleCalculate} disabled={loading || selected.length < 2}>
            {loading ? "Calculando..." : "Calcular"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Correlação de Retornos Logarítmicos
              <span className="text-xs font-normal text-muted-foreground">
                {PERIOD_LABELS[result.n_observations ? period : period]} · {result.n_observations} observações
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="p-2" />
                    {result.tickers.map((t) => (
                      <th key={t} className="p-2 font-mono font-semibold text-center min-w-[90px]">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.tickers.map((row, ri) => (
                    <tr key={row}>
                      <td className="p-2 font-mono font-semibold pr-4">{row}</td>
                      {result.matrix[ri].map((val, ci) => (
                        <td
                          key={ci}
                          className="p-2 text-center rounded font-medium"
                          style={{ background: corrBg(val), color: corrColor(val) }}
                        >
                          {val.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4 mt-4 flex-wrap">
              {[
                { bg: "#dcfce7", color: "#166534", label: "Alta correlação (≥ 0.7)" },
                { bg: "#fef9c3", color: "#854d0e", label: "Correlação moderada (0.3–0.7)" },
                { bg: "#eff6ff", color: "#1e3a5f", label: "Baixa correlação" },
                { bg: "#ffedd5", color: "#9a3412", label: "Correlação negativa moderada" },
                { bg: "#fee2e2", color: "#991b1b", label: "Alta correlação negativa (≤ -0.7)" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded" style={{ background: item.bg, border: `1px solid ${item.color}` }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
