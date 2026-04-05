"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface VolatilityResult {
  ticker: string;
  vol_30d: number;
  vol_90d: number;
  vol_1y: number;
  rolling_30d: { date: string; vol: number }[];
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({ ticker });
      const res = await fetch(`${API}/api/volatility?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { detail?: string; error?: string }).detail ?? data.error ?? "Erro ao carregar volatilidade.");
        return;
      }
      setResult(data as VolatilityResult);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Erro de conexão com o servidor.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return (
    <div className="space-y-4 mt-4">
      {loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
                <CardContent><Skeleton className="h-8 w-32" /></CardContent>
              </Card>
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </>
      )}

      {error && <ErrorState message={error} onRetry={fetchData} />}

      {!loading && !error && result && (
        <div className="space-y-6">
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
              <div className="h-[200px] md:h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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
