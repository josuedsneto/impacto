"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface BreakevenResult {
  preco_acucar_cents_lb: number;
  preco_dolar_brl: number;
  fator_conversao: number;
  breakeven_brl_saca: number;
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

interface MetricItemProps {
  label: string;
  value: string;
  sub?: string;
}

function MetricItem({ label, value, sub }: MetricItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function BreakevenPage() {
  const [result, setResult] = useState<BreakevenResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBreakeven() {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/breakeven`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as { detail?: string }).detail ?? "Erro ao carregar breakeven.");
          return;
        }
        setResult(data as BreakevenResult);
      } catch {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    fetchBreakeven();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Breakeven — Açúcar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Preço mínimo de venda para cobrir custos de produção
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && result && (
        <>
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-lg">Breakeven</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricItem
                label="Preço mínimo de venda"
                value={`R$ ${result.breakeven_brl_saca.toFixed(2)}/saca`}
                sub="Calculado com base no preço do açúcar e câmbio atuais"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Preço Açúcar NY
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricItem
                  label=""
                  value={`${result.preco_acucar_cents_lb.toFixed(2)} ¢/lb`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Câmbio USD/BRL
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricItem
                  label=""
                  value={`R$ ${result.preco_dolar_brl.toFixed(4)}`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fator de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricItem
                  label=""
                  value={result.fator_conversao.toFixed(4)}
                  sub="¢/lb → R$/saca"
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
