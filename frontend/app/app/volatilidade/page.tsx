"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVol = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({ ticker });
      const res = await fetch(`${API}/api/volatility?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { detail?: string }).detail ?? "Erro ao carregar volatilidade.");
        return;
      }
      setResult(data as VolatilityResult);
    } catch {
      setError("Erro de conexão com o servidor.");
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

export default function VolatilityPage() {
  const [tab, setTab] = useState("acucar");
  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Volatilidade Realizada</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="acucar">Açúcar NY</TabsTrigger>
          <TabsTrigger value="dolar">USD/BRL</TabsTrigger>
        </TabsList>

        <TabsContent value="acucar">
          <VolPanel ticker="SB=F" />
        </TabsContent>

        <TabsContent value="dolar">
          <VolPanel ticker="USDBRL=X" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
