"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { TickerSuggestForm } from "@/components/market/TickerSuggestForm";
import { PriceChart } from "@/components/market/PriceChart";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  const [start, setStart] = useState("2024-01-01");
  const [end, setEnd] = useState("2024-01-31");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [queriedTicker, setQueriedTicker] = useState("");
  const [loading, setLoading] = useState(false);

  async function getAccessToken(): Promise<string | null> {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({ ticker, start, end });
      const res = await fetch(`${BACKEND_URL}/api/market/prices?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Erro ao consultar preços.");
        return;
      }
      setRows(data.rows);
      setQueriedTicker(data.ticker);
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-2xl font-semibold">Dados de Mercado</h1>

      <Card>
        <CardHeader>
          <CardTitle>Consultar preços</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuery} className="flex flex-wrap gap-4 items-end mb-6">
            <div className="space-y-1">
              <Label htmlFor="q-ticker">Ticker</Label>
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
              <Label htmlFor="q-start">Início</Label>
              <Input
                id="q-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-end">Fim</Label>
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
            Sugira um símbolo do yfinance para revisão pelo administrador.
            Símbolos inválidos são rejeitados antes de serem salvos.
          </p>
          <TickerSuggestForm />
        </CardContent>
      </Card>
    </div>
  );
}
