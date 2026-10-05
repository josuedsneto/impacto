"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { apiFetch, type ApiError } from "@/lib/api";
import { toast } from "sonner";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { ATIVOS } from "@/lib/ativos";
import { fracaoParaPercentual, lerNumero } from "@/lib/numero";

// Faixas da API (backend/main.py UserParamsRequest) em %; a API recebe fração.
const FAIXAS = {
  volatilidade: { min: 0, max: 500, opcional: true },
  taxa: { min: -50, max: 100, opcional: true },
  variacao: { min: 5, max: 200, opcional: true },
};

export default function ParamsForm() {
  const [ticker, setTicker] = useState("SB=F");
  const [volatilidade, setVolatilidade] = useState("");
  const [taxaLivreRisco, setTaxaLivreRisco] = useState("");
  const [pctBound, setPctBound] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadParams(selectedTicker: string) {
    setVolatilidade("");
    setTaxaLivreRisco("");
    setPctBound("");
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<{
        volatilidade_custom: number | null;
        taxa_livre_risco: number | null;
        pct_bound_preferido: number | null;
      }>(`/api/params/${selectedTicker}`);

      // Banco guarda fração (0.25); a tela mostra % (25).
      setVolatilidade(fracaoParaPercentual(data.volatilidade_custom));
      setTaxaLivreRisco(fracaoParaPercentual(data.taxa_livre_risco));
      setPctBound(fracaoParaPercentual(data.pct_bound_preferido));
    } catch (e) {
      // 404 = ainda não há parâmetros salvos para este ativo; campos ficam vazios
      if ((e as ApiError).status !== 404) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParams(ticker);
  }, [ticker]);

  async function handleSave() {
    if (!volatilidade && !taxaLivreRisco && !pctBound) {
      toast.error("Preencha ao menos um campo.");
      return;
    }
    if (
      !campoValido(volatilidade, FAIXAS.volatilidade) ||
      !campoValido(taxaLivreRisco, FAIXAS.taxa) ||
      !campoValido(pctBound, FAIXAS.variacao)
    ) {
      toast.error("Corrija os campos destacados antes de salvar.");
      return;
    }

    setSaving(true);

    try {
      const body: Record<string, number> = {};
      if (volatilidade.trim()) body.volatilidade_custom = lerNumero(volatilidade)! / 100;
      if (taxaLivreRisco.trim()) body.taxa_livre_risco = lerNumero(taxaLivreRisco)! / 100;
      if (pctBound.trim()) body.pct_bound_preferido = lerNumero(pctBound)! / 100;

      await apiFetch(`/api/params/${ticker}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      toast.success(`Parâmetros de ${ATIVOS[ticker]?.nome ?? ticker} salvos.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-4 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Parâmetros por ativo</h2>

      <div className="space-y-1">
        <Label htmlFor="params-ticker">Ativo <FieldTooltip text="Os valores abaixo valem só para as simulações deste ativo." /></Label>
        <select
          id="params-ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          disabled={loading || saving}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {["SB=F", "USDBRL=X"].map((t) => (
            <option key={t} value={t}>
              {ATIVOS[t].nome}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <CampoNumero
            id="params-volatilidade"
            rotulo="Volatilidade anual"
            unidade="%"
            ajuda="Substitui a volatilidade histórica na simulação Monte Carlo. Em branco, usa a dos últimos 3 anos."
            valor={volatilidade}
            onChange={setVolatilidade}
            {...FAIXAS.volatilidade}
            disabled={saving}
            placeholder="ex.: 25"
          />
          <CampoNumero
            id="params-taxa"
            rotulo="Taxa de juros anual"
            unidade="%"
            ajuda="Taxa de referência sem risco, como a Selic."
            valor={taxaLivreRisco}
            onChange={setTaxaLivreRisco}
            {...FAIXAS.taxa}
            disabled={saving}
            placeholder="ex.: 10,5"
          />
          <CampoNumero
            id="params-pct"
            rotulo="Variação máxima do preço"
            unidade="%"
            ajuda="Valor que já vem preenchido no Monte Carlo deste ativo: limita o preço simulado em relação ao preço de partida."
            valor={pctBound}
            onChange={setPctBound}
            {...FAIXAS.variacao}
            disabled={saving}
            placeholder="ex.: 50"
          />

          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
