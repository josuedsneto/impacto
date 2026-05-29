"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
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
  vol_30d: number;
  vol_90d: number;
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
      const data = await apiFetch<VolatilityResult>(`/api/volatility?${params}`);
      setResult(data);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Erro de conexão com o servidor."
      );
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchVol();
  }, [fetchVol]);

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 mt-4">{error}</p>;
  }

  if (!result) return null;

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Vol. Realizada 30d (a.a.)"
          value={`${(result.vol_30d * 100).toFixed(2)}%`}
        />
        <MetricCard
          label="Vol. Realizada 90d (a.a.)"
          value={`${(result.vol_90d * 100).toFixed(2)}%`}
        />
        <MetricCard
          label="Vol. Realizada 1 ano (a.a.)"
          value={`${(result.vol_1y * 100).toFixed(2)}%`}
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 7)}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "Vol 30d"]}
                labelFormatter={(l: string) => l}
              />
              <Line
                type="monotone"
                dataKey="vol"
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

const QUICK_TICKERS = [
  { label: "Açúcar NY", value: "SB=F" },
  { label: "USD/BRL", value: "USDBRL=X" },
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
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Volatilidade Realizada</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-xs">
        <Label htmlFor="vol-ticker">
          Ticker{" "}
          <FieldTooltip text="Símbolo do ativo no Yahoo Finance. Ex: SB=F, USDBRL=X, PETR4.SA" />
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
