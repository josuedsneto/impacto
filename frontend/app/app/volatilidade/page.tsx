"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDate, formatPercent } from "@/lib/format";
import { Leitura } from "@/components/ui/leitura";
import { leituraVolatilidade } from "@/lib/leitura";
import { ATIVOS, nomeAtivo } from "@/lib/ativos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface VolatilityResult {
  ticker: string;
  vol_30d: number | null;
  vol_90d: number | null;
  vol_1y: number;
  rolling_30d: { date: string; vol: number }[];
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function VolPanel({ ticker }: { ticker: string }) {
  const [result, setResult] = useState<VolatilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVol = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ticker });
      setResult(await apiFetch<VolatilityResult>(`/api/volatility?${params}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchVol();
  }, [fetchVol]);

  if (loading) {
    return (
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4">
        <ErrorState mensagem={error} onRetry={fetchVol} />
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6 mt-4">
      <Leitura>{leituraVolatilidade({ vol30: result.vol_30d, vol1a: result.vol_1y })}</Leitura>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Vol. Realizada 30d (a.a.)"
          value={formatPercent(result.vol_30d)}
        />
        <MetricCard
          label="Vol. Realizada 90d (a.a.)"
          value={formatPercent(result.vol_90d)}
        />
        <MetricCard
          label="Vol. Realizada 1 ano (a.a.)"
          value={formatPercent(result.vol_1y)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Volatilidade Rolante 30d
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart
              data={result.rolling_30d}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                minTickGap={32}
                tickFormatter={(v: string) => formatDate(v).slice(3)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => formatPercent(v, 0)}
              />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [formatPercent(v), "Volatilidade 30 dias"]}
                labelFormatter={(l: string) => formatDate(l)}
              />
              <Line type="monotone" dataKey="vol" stroke="var(--chart-1)" dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

const QUICK_TICKERS = [
  { label: ATIVOS["SB=F"].nome, value: "SB=F" },
  { label: ATIVOS["USDBRL=X"].nome, value: "USDBRL=X" },
];

export default function VolatilityPage() {
  const [input, setInput] = useState("SB=F");
  const [ticker, setTicker] = useState("SB=F");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input.trim().toUpperCase();
    if (t) setTicker(t);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Volatilidade Realizada"
        atualizadoEm={`Ativo: ${nomeAtivo(ticker)}`}
        descricao="Quanto o preço oscilou de fato em 30 dias, 90 dias e 1 ano, em base anual."
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-xs">
        <Label htmlFor="vol-ticker">
          Ativo (código Yahoo){" "}
          <FieldTooltip text="Escolha um dos atalhos ou digite o código do ativo no Yahoo Finance, ex.: PETR4.SA." />
        </Label>
        <div className="flex gap-2">
          <Input
            id="vol-ticker"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="SB=F"
          />
          <Button type="submit">Calcular</Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {QUICK_TICKERS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setInput(value); setTicker(value); }}
              className="text-xs px-2 py-1 rounded border border-input hover:bg-accent transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      <VolPanel ticker={ticker} />
    </div>
  );
}
