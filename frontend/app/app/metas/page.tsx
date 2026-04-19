"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface MetasResult {
  meta: number;
  mtm_series: { date: string; mtm: number; meta: number }[];
  heatmap: number[][];
  acucares: number[];
  dolares: number[];
}

async function getToken(): Promise<string> {
  const sb = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? "";
}

function cellColor(v: number): string {
  if (v >= 200) return "#16a34a";
  if (v >= 0) return "#4ade80";
  if (v >= -200) return "#f87171";
  return "#dc2626";
}

export default function MetasPage() {
  const [meta, setMeta] = useState(2600);
  const [result, setResult] = useState<MetasResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalc() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/api/metas?meta=${meta}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail ?? "Erro."); return; }
      setResult(data as MetasResult);
    } catch { setError("Erro de conexão."); }
    finally { setLoading(false); }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Metas</h1>

      <Card className="max-w-sm">
        <CardHeader><CardTitle className="text-sm font-medium">Meta (R$/Ton)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Meta: <span className="font-bold">{meta}</span></Label>
          </div>
          <Slider
            min={2400} max={2800} step={10}
            value={[meta]}
            onValueChange={([v]) => setMeta(v)}
          />
          <Button onClick={handleCalc} disabled={loading} className="w-full">
            {loading ? "Calculando..." : "Calcular"}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Produto − Meta (R$/Ton) · 22.0462 × 1.04 × Açúcar × Dólar − {result.meta}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-1 text-muted-foreground font-normal">Açúcar\Dólar</th>
                    {result.dolares.map((d) => (
                      <th key={d} className="px-2 py-1 text-center font-normal text-muted-foreground">
                        {d.toFixed(2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.acucares.map((a, i) => (
                    <tr key={a}>
                      <td className="px-2 py-1 font-medium text-muted-foreground">{a.toFixed(2)}</td>
                      {result.heatmap[i].map((v, j) => (
                        <td
                          key={j}
                          className="px-2 py-1 text-center font-semibold text-white"
                          style={{ background: cellColor(v), minWidth: 72 }}
                        >
                          {v > 0 ? "+" : ""}{v.toFixed(0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* MTM Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">MTM Histórico vs Meta</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={result.mtm_series.filter((_, i) => i % 5 === 0)}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(0, 7)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [v.toFixed(2), name === "mtm" ? "MTM" : "Meta"]}
                    labelFormatter={(l) => l}
                  />
                  <ReferenceLine y={result.meta} stroke="#ef4444" strokeDasharray="4 2" label={{ value: `Meta ${result.meta}`, position: "right", fontSize: 10 }} />
                  <Line type="monotone" dataKey="mtm" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="mtm" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
