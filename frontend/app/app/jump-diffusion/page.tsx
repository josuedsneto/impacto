"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatNumber, formatPercent, formatPreco } from "@/lib/format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface JDResult {
  ticker: string;
  s0: number;
  sigma: number;
  mu: number;
  mean: number;
  prices: { step: number; price: number }[];
}

const TICKERS = [
  { label: "Açúcar NY", value: "SB=F" },
  { label: "USD/BRL", value: "USDBRL=X" },
];

export default function JumpDiffusionPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [sigma, setSigma] = useState("");
  const [lambdaJumps, setLambdaJumps] = useState("0.1");
  const [muJump, setMuJump] = useState("-0.02");
  const [sigmaJump, setSigmaJump] = useState("0.05");
  const [steps, setSteps] = useState("252");
  const [result, setResult] = useState<JDResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    setLoading(true);
    try {
      const body = {
        ticker,
        sigma: sigma ? parseFloat(sigma) : null,
        lambda_jumps: parseFloat(lambdaJumps),
        mu_jump: parseFloat(muJump),
        sigma_jump: parseFloat(sigmaJump),
        steps: parseInt(steps),
      };
      const data = await apiFetch<JDResult>("/api/jump-diffusion", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(data);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <PageHeader
        titulo="Jump Diffusion"
        descricao="Simula um caminho de preço com oscilação diária e saltos bruscos ocasionais (modelo de Merton)."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Ticker */}
          <div className="space-y-1">
            <Label>Ativo</Label>
            <div className="flex gap-2">
              {TICKERS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTicker(value)}
                  className={`px-3 py-1.5 rounded border text-sm transition-colors ${
                    ticker === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-input hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="jd-sigma">
                Sigma (vol) <FieldTooltip text="Volatilidade diária. Deixe em branco para usar a histórica." />
              </Label>
              <Input id="jd-sigma" type="number" step={0.001} min={0} value={sigma}
                onChange={(e) => setSigma(e.target.value)} placeholder="automático" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jd-steps">
                Steps <FieldTooltip text="Número de passos diários (252 = 1 ano útil)" />
              </Label>
              <Input id="jd-steps" type="number" min={10} max={1260} value={steps}
                onChange={(e) => setSteps(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jd-lambda">
                λ saltos <FieldTooltip text="Frequência esperada de saltos por ano (ex: 0.1 = ~1 a cada 10 anos)" />
              </Label>
              <Input id="jd-lambda" type="number" step={0.01} min={0} value={lambdaJumps}
                onChange={(e) => setLambdaJumps(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jd-mu-jump">
                μ salto <FieldTooltip text="Magnitude média do salto (ex: -0.02 = queda de 2%)" />
              </Label>
              <Input id="jd-mu-jump" type="number" step={0.01} value={muJump}
                onChange={(e) => setMuJump(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="jd-sigma-jump">
                σ salto <FieldTooltip text="Desvio padrão do tamanho do salto" />
              </Label>
              <Input id="jd-sigma-jump" type="number" step={0.01} min={0} value={sigmaJump}
                onChange={(e) => setSigmaJump(e.target.value)} />
            </div>
          </div>

          <Button onClick={handleSimulate} disabled={loading} className="w-full">
            {loading ? "Simulando..." : "Simular"}
          </Button>
        </CardContent>
      </Card>

      {!result && <EmptyState mensagem="Ajuste os parâmetros e clique em Simular para ver um caminho de preço." />}

      {result && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {result.ticker} · Preço inicial: {formatPreco(result.ticker, result.s0)} · Média do caminho: {formatPreco(result.ticker, result.mean)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>Volatilidade diária usada: {formatPercent(result.sigma, 3)}</span>
              <span>Tendência diária: {formatPercent(result.mu, 4)}</span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={result.prices} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} tickFormatter={(v) => `D${v}`} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => formatNumber(v, 2)} />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatPreco(result.ticker, v), "Preço"]}
                  labelFormatter={(l) => `Dia ${l}`}
                />
                <Line type="monotone" dataKey="price" stroke="var(--chart-1)" dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
