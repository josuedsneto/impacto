"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatNumber, formatPercent, formatPreco } from "@/lib/format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { Leitura } from "@/components/ui/leitura";
import { leituraJump } from "@/lib/leitura";
import { lerNumero } from "@/lib/numero";
import { ATIVOS, nomeAtivo } from "@/lib/ativos";
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

const TICKERS = ["SB=F", "USDBRL=X"].map((value) => ({ label: ATIVOS[value].nome, value }));

// Faixas aceitas pela API (backend/main.py JumpDiffusionRequest); campos em % na tela.
const FAIXAS = {
  sigma: { min: 0.01, max: 20, opcional: true },
  steps: { min: 10, max: 1260 },
  lambda: { min: 0, max: 5 },
  muJump: { min: -100, max: 100 },
  sigmaJump: { min: 0, max: 100 },
};

export default function JumpDiffusionPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [sigma, setSigma] = useState("");
  const [lambdaJumps, setLambdaJumps] = useState("0,1");
  const [muJump, setMuJump] = useState("-2");
  const [sigmaJump, setSigmaJump] = useState("5");
  const [steps, setSteps] = useState("252");
  const [result, setResult] = useState<JDResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    const ok =
      campoValido(sigma, FAIXAS.sigma) &&
      campoValido(steps, FAIXAS.steps) &&
      campoValido(lambdaJumps, FAIXAS.lambda) &&
      campoValido(muJump, FAIXAS.muJump) &&
      campoValido(sigmaJump, FAIXAS.sigmaJump);
    if (!ok) {
      toast.error("Corrija os campos destacados antes de simular.");
      return;
    }
    setLoading(true);
    try {
      // Percentuais da tela viram fração para a API.
      const body = {
        ticker,
        sigma: sigma.trim() ? lerNumero(sigma)! / 100 : null,
        lambda_jumps: lerNumero(lambdaJumps),
        mu_jump: lerNumero(muJump)! / 100,
        sigma_jump: lerNumero(sigmaJump)! / 100,
        steps: Math.round(lerNumero(steps)!),
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoNumero
              id="jd-sigma"
              rotulo="Volatilidade diária"
              unidade="%"
              opcional
              ajuda="Quanto o preço oscila em um dia normal. Em branco, usa a volatilidade dos últimos 3 anos."
              valor={sigma}
              onChange={setSigma}
              {...FAIXAS.sigma}
              placeholder="automática"
            />
            <CampoNumero
              id="jd-steps"
              rotulo="Prazo"
              unidade="dias úteis"
              ajuda="Até onde o caminho vai. 252 dias úteis são cerca de 1 ano."
              valor={steps}
              onChange={setSteps}
              {...FAIXAS.steps}
            />
            <CampoNumero
              id="jd-lambda"
              rotulo="Saltos por ano"
              ajuda="Quantos choques bruscos de preço esperar por ano. 0,1 é cerca de um a cada 10 anos."
              valor={lambdaJumps}
              onChange={setLambdaJumps}
              {...FAIXAS.lambda}
            />
            <CampoNumero
              id="jd-mu-jump"
              rotulo="Tamanho médio do salto"
              unidade="%"
              ajuda="Variação típica do preço em cada choque. -2 significa uma queda de 2%."
              valor={muJump}
              onChange={setMuJump}
              {...FAIXAS.muJump}
            />
            <CampoNumero
              id="jd-sigma-jump"
              rotulo="Variação do tamanho do salto"
              unidade="%"
              ajuda="Quanto os choques variam em torno do tamanho médio. Maior valor gera saltos mais imprevisíveis."
              valor={sigmaJump}
              onChange={setSigmaJump}
              {...FAIXAS.sigmaJump}
              className="sm:col-span-2"
            />
          </div>

          <Button onClick={handleSimulate} disabled={loading} className="w-full">
            {loading ? "Simulando..." : "Simular"}
          </Button>
        </CardContent>
      </Card>

      {!result && <EmptyState mensagem="Ajuste os parâmetros e clique em Simular para ver um caminho de preço." />}

      {result && (
        <div className="min-w-0 space-y-4">
        <Leitura>
          {leituraJump({ ticker: result.ticker, s0: result.s0, final: result.prices.at(-1)?.price })}
        </Leitura>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {nomeAtivo(result.ticker)} · Preço inicial: {formatPreco(result.ticker, result.s0)} · Média do caminho: {formatPreco(result.ticker, result.mean)}
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
        </div>
      )}
      </div>
    </div>
  );
}
