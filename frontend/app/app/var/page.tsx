"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatNumber, formatPercent, formatPreco } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        const params = new URLSearchParams({ ticker, confidence: conf });
        setResult(await apiFetch<VarResult>(`/api/var?${params}`));
      } catch (e) {
        setError((e as Error).message);
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

  const confLabel = formatPercent(parseFloat(confidence), 0);
  // A API devolve o VaR como retorno negativo; na tela mostramos a perda como valor positivo.
  const perda = (v: number) => Math.abs(v);

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {error && <ErrorState mensagem={error} onRetry={() => fetchVar(confidence)} />}
      {!loading && !error && result && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Último preço" value={formatPreco(ticker, result.last_price)} />
          <MetricCard label={`Perda máxima histórica (${confLabel})`} value={formatPreco(ticker, perda(result.var_historico_abs))} />
          <MetricCard label="Perda máxima histórica (%)" value={formatPercent(perda(result.var_historico_pct))} />
          <MetricCard label={`Perda máxima paramétrica (${confLabel})`} value={formatPreco(ticker, perda(result.var_parametrico_abs))} />
          <MetricCard label="Perda máxima paramétrica (%)" value={formatPercent(perda(result.var_parametrico_pct))} />
          <MetricCard label="Dias de histórico usados" value={formatNumber(result.n_observations, 0)} />
        </div>
      )}
    </div>
  );
}

export default function VarPage() {
  const [tab, setTab] = useState("acucar");
  return (
    <div>
      <PageHeader
        titulo="Value at Risk (VaR)"
        descricao="A maior queda de preço esperada em 1 dia, para o nível de confiança escolhido."
      />

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
