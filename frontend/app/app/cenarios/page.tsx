"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

type Opcao = "Moagem" | "Câmbio" | "NY" | "Preço Etanol";

interface CenariosResult {
  opcao: Opcao;
  breakeven: number;
  probabilidade_abaixo: number;
  media: number;
  std: number;
  percentis: { p: number; v: number }[];
  distribuicao: { x: number; y: number }[];
}

const OPCOES: Opcao[] = ["Moagem", "Câmbio", "NY", "Preço Etanol"];

const DEFAULTS: Record<Opcao, Record<string, number>> = {
  "Moagem":       { ny: 20.0, cambio: 5.25, preco_etanol: 2768.90 },
  "Câmbio":       { ny: 20.0, moagem: 1300000, preco_etanol: 2768.90 },
  "NY":           { moagem: 1300000, cambio: 5.25, preco_etanol: 2768.90 },
  "Preço Etanol": { ny: 20.0, moagem: 1300000, cambio: 5.25 },
};

const INPUT_LABELS: Record<string, { label: string; step: number; placeholder: string }> = {
  ny:           { label: "NY (¢/lb)", step: 0.1, placeholder: "20.0" },
  moagem:       { label: "Moagem Total", step: 10000, placeholder: "1300000" },
  cambio:       { label: "Câmbio (R$)", step: 0.01, placeholder: "5.25" },
  preco_etanol: { label: "Preço Etanol (R$/m³)", step: 10, placeholder: "2768.90" },
};

export default function CenariosPage() {
  const [opcao, setOpcao] = useState<Opcao>("NY");
  const [values, setValues] = useState<Record<string, number>>({ ...DEFAULTS["NY"] });
  const [result, setResult] = useState<CenariosResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpcaoChange(o: Opcao) {
    setOpcao(o);
    setValues({ ...DEFAULTS[o] });
    setResult(null);
  }

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      const body = { opcao, ny: 0, moagem: 0, cambio: 0, preco_etanol: 0, ...values };
      const data = await apiFetch<CenariosResult>(`/api/cenarios`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(data);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Erro de conexão."); }
    finally { setLoading(false); }
  }

  const otherInputs = Object.keys(DEFAULTS[opcao]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Cenários</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Encontra o valor mínimo de uma variável para o EBITDA ser positivo e calcula o risco
        </p>
      </div>

      <Card className="max-w-md">
        <CardContent className="pt-6 space-y-4">
          {/* Opcao */}
          <div className="space-y-1">
            <Label>
              Variável de análise <FieldTooltip text="A variável para a qual o breakeven será calculado" />
            </Label>
            <div className="flex flex-wrap gap-2">
              {OPCOES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => handleOpcaoChange(o)}
                  className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                    opcao === o
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Other inputs */}
          <div className="grid grid-cols-2 gap-3">
            {otherInputs.map((key) => {
              const cfg = INPUT_LABELS[key];
              return (
                <div key={key} className="space-y-1">
                  <Label htmlFor={`cen-${key}`}>{cfg.label}</Label>
                  <Input
                    id={`cen-${key}`}
                    type="number"
                    step={cfg.step}
                    placeholder={cfg.placeholder}
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                  />
                </div>
              );
            })}
          </div>

          <Button onClick={handleSimulate} disabled={loading} className="w-full">
            {loading ? "Calculando..." : "Calcular Cenário"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Breakeven — {result.opcao}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{result.breakeven.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Risco (abaixo do breakeven)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${result.probabilidade_abaixo > 0.3 ? "text-red-600" : "text-green-600"}`}>
                  {(result.probabilidade_abaixo * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">Média esperada</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{result.media.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
              </CardContent>
            </Card>
          </div>

          {/* Distribution chart */}
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Distribuição de probabilidade — {result.opcao}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={result.distribuicao} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                      <stop offset={`${result.probabilidade_abaixo * 100}%`} stopColor="#ef4444" stopOpacity={0.6} />
                      <stop offset={`${result.probabilidade_abaixo * 100}%`} stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="x" tick={{ fontSize: 10 }} tickFormatter={(v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => [v.toFixed(6), "Densidade"]}
                    labelFormatter={(v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                  />
                  <ReferenceLine
                    x={result.breakeven}
                    stroke="#1f2937"
                    strokeDasharray="4 2"
                    label={{ value: "Breakeven", position: "top", fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="y" stroke="#3b82f6" fill="url(#colorRisk)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Percentis table */}
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Percentis — {result.opcao}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-1 text-sm">
                {result.percentis.map(({ p, v }) => (
                  <div
                    key={p}
                    className={`rounded px-2 py-1 text-center ${
                      v < result.breakeven ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                    }`}
                  >
                    <span className="text-xs text-muted-foreground block">P{p}</span>
                    <span className="font-medium">{v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
