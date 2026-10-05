"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { TickerSuggestForm } from "@/components/market/TickerSuggestForm";
import { PriceChart } from "@/components/market/PriceChart";

interface PriceRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export default function MarketPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [start, setStart] = useState(() => new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [queriedTicker, setQueriedTicker] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams({ ticker, start, end });
      const data = await apiFetch<{ ticker: string; rows: PriceRow[] }>(`/api/market/prices?${params}`);
      setRows(data.rows);
      setQueriedTicker(data.ticker);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Análise Técnica"
        descricao="Consulte a série diária de preços de qualquer ativo e sugira novos ativos para o catálogo."
      />

      <Card>
        <CardHeader>
          <CardTitle>Consultar preços</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuery} className="flex flex-wrap gap-4 items-end mb-6">
            <div className="space-y-1">
              <Label htmlFor="q-ticker">Ativo (código Yahoo)</Label>
              <Input
                id="q-ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="SB=F"
                className="w-36"
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-start">De</Label>
              <Input
                id="q-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-end">Até</Label>
              <Input
                id="q-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </form>

          {queriedTicker && <PriceChart ticker={queriedTicker} rows={rows} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sugerir novo ticker</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Sugira um ativo pelo código do Yahoo Finance. O administrador revisa antes de ele entrar no catálogo;
            códigos sem dados são recusados na hora.
          </p>
          <TickerSuggestForm />
        </CardContent>
      </Card>
    </div>
  );
}
