"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { apiFetch, ApiError } from "@/lib/api";

interface ParamsData {
  volatilidade_custom: number | null;
  taxa_livre_risco: number | null;
  pct_bound_preferido: number | null;
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
      const data = await apiFetch<ParamsData>(`/api/params/${selectedTicker}`);
      setVolatilidade(data.volatilidade_custom != null ? String(data.volatilidade_custom) : "");
      setTaxaLivreRisco(data.taxa_livre_risco != null ? String(data.taxa_livre_risco) : "");
      setPctBound(data.pct_bound_preferido != null ? String(data.pct_bound_preferido) : "");
    } catch (e) {
      // 404 = nenhum parâmetro salvo ainda para este ticker — deixa campos vazios
      if (e instanceof ApiError && e.status === 404) return;
      setError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
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
      const body: Record<string, number> = {};
      if (volatilidade !== "") body.volatilidade_custom = parseFloat(volatilidade);
      if (taxaLivreRisco !== "") body.taxa_livre_risco = parseFloat(taxaLivreRisco);
      if (pctBound !== "") body.pct_bound_preferido = parseFloat(pctBound);

      await apiFetch(`/api/params/${ticker}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-sm">
      <p className="text-lg font-semibold">Parâmetros por Ativo</p>

      <div className="space-y-1">
        <Label htmlFor="params-ticker">Ativo <FieldTooltip text="Ativo cujos parâmetros deseja personalizar" /></Label>
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
            <Label htmlFor="params-volatilidade">Volatilidade customizada (0–5) <FieldTooltip text="Substitui a volatilidade histórica calculada. Deixe em branco para usar a automática" /></Label>
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
            <Label htmlFor="params-taxa">Taxa livre de risco (-0.5–1) <FieldTooltip text="Taxa Selic ou outra taxa de referência anualizada" /></Label>
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
            <Label htmlFor="params-pct">PCT Bound preferido (0.05–2) <FieldTooltip text="Valor padrão de PCT Bound ao criar simulações para este ativo" /></Label>
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
