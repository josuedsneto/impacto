"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComputingLoader } from "@/components/ui/computing-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVar = useCallback(
    async (conf: string) => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const params = new URLSearchParams({ ticker, confidence: conf });
        const res = await fetch(`${API}/api/var?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as { detail?: string }).detail ?? "Erro ao carregar VaR.");
          return;
        }
        setResult(data as VarResult);
      } catch {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    },
    [ticker]
  );

  useEffect(() => {
    fetchVar(confidence);
  }, [fetchVar, confidence]);

  function handleConfidenceChange(val: string) {
    setConfidence(val);
  }

  const confLabel = `${(parseFloat(confidence) * 100).toFixed(0)}%`;

  function exportToCSV() {
    if (!result) return;
    const rows = [
      ["Métrica", "Valor"],
      ["Ticker", ticker],
      ["Último Preço", result.last_price.toString()],
      ["Confiança", confLabel],
      ["VaR Histórico (abs)", result.var_historico_abs.toString()],
      ["VaR Histórico (%)", (result.var_historico_pct * 100).toFixed(4)],
      ["VaR Paramétrico (abs)", result.var_parametrico_abs.toString()],
      ["VaR Paramétrico (%)", (result.var_parametrico_pct * 100).toFixed(4)],
      ["Observações", result.n_observations.toString()],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `var_${ticker}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">Nível de confiança:</span>
        {result && (
          <button onClick={exportToCSV} className="ml-auto text-xs border rounded px-2 py-1 text-muted-foreground hover:text-foreground transition-colors">
            Exportar CSV
          </button>
        )}
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
        <ComputingLoader label="Calculando Value at Risk..." expectedSeconds={20} />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && result && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
