"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@supabase/ssr";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function ParamsForm() {
  const [ticker, setTicker] = useState("SB=F");
  const [volatilidade, setVolatilidade] = useState("");
  const [taxaLivreRisco, setTaxaLivreRisco] = useState("");
  const [pctBound, setPctBound] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadParams(selectedTicker: string) {
    setVolatilidade("");
    setTaxaLivreRisco("");
    setPctBound("");
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/params/${selectedTicker}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.status === 404) {
        // No params saved yet for this ticker — leave fields empty
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Erro ao carregar parâmetros.");
        return;
      }

      setVolatilidade(data.volatilidade_custom != null ? String(data.volatilidade_custom) : "");
      setTaxaLivreRisco(data.taxa_livre_risco != null ? String(data.taxa_livre_risco) : "");
      setPctBound(data.pct_bound_preferido != null ? String(data.pct_bound_preferido) : "");
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParams(ticker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  async function handleSave() {
    if (!volatilidade && !taxaLivreRisco && !pctBound) {
      setError("Preencha ao menos um campo.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const token = await getAccessToken();
      const body: Record<string, number> = {};
      if (volatilidade !== "") body.volatilidade_custom = parseFloat(volatilidade);
      if (taxaLivreRisco !== "") body.taxa_livre_risco = parseFloat(taxaLivreRisco);
      if (pctBound !== "") body.pct_bound_preferido = parseFloat(pctBound);

      const res = await fetch(`${API}/api/params/${ticker}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail ?? "Erro ao salvar parâmetros.");
      } else {
        setSaved(true);
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-lg font-semibold">Parâmetros por Ativo</p>

      <div className="space-y-1">
        <Label htmlFor="params-ticker">Ativo</Label>
        <select
          id="params-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          disabled={loading || saving}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="SB=F">SB=F</option>
          <option value="USDBRL=X">USDBRL=X</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="params-volatilidade">Volatilidade customizada (0–5)</Label>
            <Input
              id="params-volatilidade"
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={volatilidade}
              onChange={(e) => setVolatilidade(e.target.value)}
              disabled={saving}
              placeholder="ex: 0.25"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="params-taxa">Taxa livre de risco (-0.5–1)</Label>
            <Input
              id="params-taxa"
              type="number"
              step="0.001"
              min="-0.5"
              max="1"
              value={taxaLivreRisco}
              onChange={(e) => setTaxaLivreRisco(e.target.value)}
              disabled={saving}
              placeholder="ex: 0.105"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="params-pct">PCT Bound preferido (0.05–2)</Label>
            <Input
              id="params-pct"
              type="number"
              step="0.01"
              min="0.05"
              max="2"
              value={pctBound}
              onChange={(e) => setPctBound(e.target.value)}
              disabled={saving}
              placeholder="ex: 0.5"
            />
          </div>

          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      )}

      {saved && (
        <p className="text-sm text-green-600">Parâmetros salvos com sucesso.</p>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
