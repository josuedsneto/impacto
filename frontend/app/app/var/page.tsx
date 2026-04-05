"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface VarResult {
  ticker: string;
  last_price: number;
  confidence: number;
  var_historico_abs: number;
  var_historico_pct: number;
  var_parametrico_abs: number;
  var_parametrico_pct: number;
  n_observations: number;
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

function VarPanel({ ticker }: { ticker: string }) {
  const [confidence, setConfidence] = useState("0.95");
  const [result, setResult] = useState<VarResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchVar = useCallback(
    async (conf: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const params = new URLSearchParams({ ticker, confidence: conf });
        const res = await fetch(`${API}/api/var?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as { detail?: string; error?: string }).detail ?? data.error ?? "Erro ao carregar VaR.");
          return;
        }
        setResult(data as VarResult);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Erro de conexão com o servidor.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [ticker]
  );

  useEffect(() => {
    fetchVar(confidence);
    return () => abortRef.current?.abort();
  }, [fetchVar, confidence]);

  function handleConfidenceChange(val: string) {
    setConfidence(val);
  }

  const confLabel = `${(parseFloat(confidence) * 100).toFixed(0)}%`;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Nível de confiança:</span>
        <Select value={confidence} onValueChange={handleConfidenceChange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.90">90%</SelectItem>
            <SelectItem value="0.95">95%</SelectItem>
            <SelectItem value="0.99">99%</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-32" /></CardContent>
            </Card>
          ))}
        </div>
      )}
      {error && <ErrorState message={error} onRetry={() => fetchVar(confidence)} />}
      {!loading && !error && result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <MetricCard
            label="Último Preço"
            value={result.last_price.toFixed(4)}
          />
          <MetricCard
            label={`VaR Histórico (${confLabel})`}
            value={result.var_historico_abs.toFixed(4)}
          />
          <MetricCard
            label={`VaR Histórico %`}
            value={`${(result.var_historico_pct * 100).toFixed(2)}%`}
          />
          <MetricCard
            label={`VaR Paramétrico (${confLabel})`}
            value={result.var_parametrico_abs.toFixed(4)}
          />
          <MetricCard
            label="VaR Paramétrico %"
            value={`${(result.var_parametrico_pct * 100).toFixed(2)}%`}
          />
          <MetricCard
            label="Observações"
            value={result.n_observations.toLocaleString("pt-BR")}
          />
        </div>
      )}
    </div>
  );
}

export default function VarPage() {
  const [tab, setTab] = useState("acucar");
  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Value at Risk</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="acucar">Açúcar NY</TabsTrigger>
          <TabsTrigger value="dolar">USD/BRL</TabsTrigger>
        </TabsList>

        <TabsContent value="acucar">
          <VarPanel ticker="SB=F" />
        </TabsContent>

        <TabsContent value="dolar">
          <VarPanel ticker="USDBRL=X" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
