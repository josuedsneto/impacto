"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function TickerSuggestForm() {
  const [ticker, setTicker] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("commodity");
  const [loading, setLoading] = useState(false);

  async function getAccessToken(): Promise<string | null> {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim()) {
      toast.error("Informe o símbolo do ticker.");
      return;
    }
    setLoading(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BACKEND_URL}/api/market/suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), nome, tipo }),
      });
      const data = await res.json();
      if (!res.ok) {
        // MKT-03: show visible error before anything is saved
        toast.error(data.detail ?? "Erro ao sugerir ticker.");
      } else {
        toast.success(data.message ?? `Ticker '${ticker}' enviado para revisão.`);
        setTicker("");
        setNome("");
      }
    } catch (err) {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="ticker">Símbolo (ex: SB=F, PETR4.SA)</Label>
        <Input
          id="ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="SB=F"
          disabled={loading}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nome">Nome legível (opcional)</Label>
        <Input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Açúcar NY #11"
          disabled={loading}
        />
      </div>
      <div className="space-y-1">
        <Label>Tipo</Label>
        <Select value={tipo} onValueChange={setTipo} disabled={loading}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="commodity">Commodity / Futuro</SelectItem>
            <SelectItem value="fx">Câmbio (FX)</SelectItem>
            <SelectItem value="acao">Ação</SelectItem>
            <SelectItem value="indice">Índice</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Validando..." : "Sugerir ticker"}
      </Button>
    </form>
  );
}
