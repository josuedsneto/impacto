"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
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
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        ticker,
        sigma: sigma ? parseFloat(sigma) : null,
        lambda_jumps: parseFloat(lambdaJumps),
        mu_jump: parseFloat(muJump),
        sigma_jump: parseFloat(sigmaJump),
        steps: parseInt(steps),
      };
      const data = await apiFetch<JDResult>(`/api/jump-diffusion`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro de conexão.");
    } finally { setLoading(false); }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Jump Diffusion</h1>
      <p className="text-sm text-muted-foreground">Modelo de Merton: difusão GBM + saltos aleatórios (Poisson)</p>

      <Card className="max-w-lg">
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
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Simulação · {result.ticker} · Preço inicial: {result.s0.toFixed(2)} · Média: {result.mean.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 text-sm text-muted-foreground mb-4">
              <span>σ usado: {(result.sigma * 100).toFixed(3)}%</span>
              <span>μ diário: {(result.mu * 100).toFixed(4)}%</span>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={result.prices} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="step" tick={{ fontSize: 10 }} tickFormatter={(v) => `D${v}`} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip formatter={(v: number) => [v.toFixed(4), "Preço"]} labelFormatter={(l) => `Step ${l}`} />
                <Line type="monotone" dataKey="price" stroke="#8b5cf6" dot={false} strokeWidth={1.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
