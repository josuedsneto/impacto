"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { createBrowserClient } from "@supabase/ssr";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function fetchPrice(ticker: string, token: string): Promise<number | null> {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  try {
    const res = await fetch(`${API}/api/market/prices?ticker=${ticker}&start=${start}&end=${end}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    const rows: { close: number }[] = data.rows ?? [];
    return rows.length > 0 ? rows[rows.length - 1].close : null;
  } catch {
    return null;
  }
}

export default function WatchlistManager() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    async function loadWatchlist() {
      const token = await getAccessToken();
      try {
        const res = await fetch(`${API}/api/watchlist`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        const list: string[] = data.tickers ?? [];
        setTickers(list);

        const priceResults = await Promise.all(
          list.map(async (t) => ({ ticker: t, price: await fetchPrice(t, token) }))
        );
        const priceMap: Record<string, number | null> = {};
        for (const { ticker, price } of priceResults) {
          priceMap[ticker] = price;
        }
        setPrices(priceMap);
      } catch {
        // silent — tickers stays empty
      } finally {
        setLoading(false);
      }
    }
    loadWatchlist();
  }, []);

  async function handleAdd() {
    const ticker = addInput.trim().toUpperCase();
    if (!ticker) return;
    setAddLoading(true);
    setAddError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/watchlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ticker }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAddError(err.detail ?? "Erro ao adicionar ticker.");
        return;
      }
      const price = await fetchPrice(ticker, token);
      setTickers((prev) => [ticker, ...prev]);
      setPrices((prev) => ({ ...prev, [ticker]: price }));
      setAddInput("");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemove(ticker: string) {
    const token = await getAccessToken();
    const res = await fetch(`${API}/api/watchlist/${ticker}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      setTickers((prev) => prev.filter((t) => t !== ticker));
      setPrices((prev) => {
        const next = { ...prev };
        delete next[ticker];
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Watchlist</h2>

      <div className="flex gap-2 items-start">
        <div className="flex flex-col gap-1">
          <Label htmlFor="watchlist-add">Adicionar ativo <FieldTooltip text="Símbolo do ativo no Yahoo Finance. Pressione Enter ou clique em Adicionar" /></Label>
          <Input
            id="watchlist-add"
            placeholder="Ex: SB=F"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            disabled={addLoading}
            className="w-48"
          />
          {addError && (
            <span className="text-xs text-red-600">{addError}</span>
          )}
        </div>
        <Button onClick={handleAdd} disabled={addLoading}>
          {addLoading ? "Adicionando..." : "Adicionar"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : tickers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum ativo na watchlist.</p>
      ) : (
        <div className="space-y-2">
          {tickers.map((ticker) => (
            <div key={ticker} className="flex items-center justify-between border rounded px-3 py-2">
              <span className="font-medium">{ticker}</span>
              <div className="flex items-center gap-4">
                <span className="text-sm tabular-nums">
                  {prices[ticker] != null
                    ? prices[ticker]!.toFixed(2)
                    : "—"}
                </span>
                <button
                  onClick={() => handleRemove(ticker)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
