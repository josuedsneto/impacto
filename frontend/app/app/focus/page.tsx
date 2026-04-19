"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface IndicatorValue {
  value: number | null;
  delta: number | null;
}

interface FocusResponse {
  ipca: IndicatorValue;
  cambio: IndicatorValue;
  selic: IndicatorValue;
  pib: IndicatorValue;
  ano_referencia: string;
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function fmt(v: number | null, decimals = 2): string {
  return v !== null ? v.toFixed(decimals) : "—";
}

function delta(d: number | null): string {
  if (d === null) return "";
  const sign = d > 0 ? "+" : "";
  return ` (${sign}${d.toFixed(2)})`;
}

function deltaColor(d: number | null): string {
  if (d === null) return "";
  return d > 0 ? "text-red-500" : d < 0 ? "text-green-600" : "text-muted-foreground";
}

export default function FocusPage() {
  const [data, setData] = useState<FocusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFocus() {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/focus`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (!res.ok) {
          setError((json as { detail?: string }).detail ?? "Erro ao carregar dados do Focus.");
          return;
        }
        setData(json as FocusResponse);
      } catch {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    fetchFocus();
  }, []);

  const indicators = data
    ? [
        { label: "IPCA", unit: "%", ...data.ipca },
        { label: "Câmbio (USD/BRL)", unit: "", ...data.cambio },
        { label: "Selic", unit: "%", ...data.selic },
        { label: "PIB Total", unit: "%", ...data.pib },
      ]
    : [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">
        Expectativa de Mercado — Focus/BCB {data ? `(${data.ano_referencia})` : ""}
      </h1>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {indicators.map((ind) => (
            <Card key={ind.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {ind.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {fmt(ind.value)}{ind.unit}
                </p>
                {ind.delta !== null && (
                  <p className={`text-sm mt-1 ${deltaColor(ind.delta)}`}>
                    Variação 7 dias: {delta(ind.delta)}{ind.unit}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
