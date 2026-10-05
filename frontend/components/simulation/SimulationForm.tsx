"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { TickerSelect } from "@/components/market/TickerSelect";
import { unidadeAtivo } from "@/lib/ativos";
import { fracaoParaPercentual, lerNumero } from "@/lib/numero";

export interface SimulationResult {
  id: string;
  ticker: string;
  preco_inicial: number;
  dias_simulados: number;
  num_simulacoes: number;
  pct_bound: number;
  label: string | null;
  p5: number;
  p20: number;
  p50: number;
  p80: number;
  p95: number;
  percentiles_series: Record<string, number[]>;
  created_at: string;
}

interface SimulationFormProps {
  onResult: (result: SimulationResult) => void;
}

export default function SimulationForm({ onResult }: SimulationFormProps) {
  const [ticker, setTicker] = useState("SB=F");
  const [precoInicial, setPrecoInicial] = useState("");
  const [diasSimulados, setDiasSimulados] = useState("252");
  const [numSimulacoes, setNumSimulacoes] = useState("10000");
  const [variacaoMax, setVariacaoMax] = useState("50");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);

  // Faixas aceitas pela API (backend/main.py SimulationRequest)
  const FAIXAS = {
    preco: { min: 0.0001, max: 100_000 },
    dias: { min: 1, max: 1260 },
    cenarios: { min: 100, max: 50_000 },
    variacao: { min: 1, max: 200 },
  };

  useEffect(() => {
    async function loadParams() {
      try {
        const data = await apiFetch<{ pct_bound_preferido?: number | null }>(
          `/api/params/${encodeURIComponent(ticker)}`
        );
        // Parâmetro salvo como fração (0.5); a tela trabalha em % (50).
        if (data.pct_bound_preferido != null) setVariacaoMax(fracaoParaPercentual(data.pct_bound_preferido));
      } catch {
        // Sem parâmetro salvo: fica o padrão da tela.
      }
    }
    loadParams();
  }, [ticker]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok =
      campoValido(precoInicial, FAIXAS.preco) &&
      campoValido(diasSimulados, FAIXAS.dias) &&
      campoValido(numSimulacoes, FAIXAS.cenarios) &&
      campoValido(variacaoMax, FAIXAS.variacao);
    if (!ok) {
      toast.error("Corrija os campos destacados antes de simular.");
      return;
    }
    setLoading(true);

    try {
      const data = await apiFetch<SimulationResult>("/api/simulations", {
        method: "POST",
        timeoutMs: 120_000,
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          preco_inicial: lerNumero(precoInicial),
          dias_simulados: Math.round(lerNumero(diasSimulados)!),
          num_simulacoes: Math.round(lerNumero(numSimulacoes)!),
          pct_bound: lerNumero(variacaoMax)! / 100,
          label: label.trim() || null,
        }),
      });
      onResult(data);
      toast.success("Simulação concluída e salva no histórico.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const unidade = unidadeAtivo(ticker);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TickerSelect value={ticker} onChange={setTicker} disabled={loading} />

      <CampoNumero
        id="preco_inicial"
        rotulo="Preço de partida"
        unidade={unidade || undefined}
        ajuda="Preço de onde os cenários começam. Use o preço atual para ver o futuro a partir de hoje."
        valor={precoInicial}
        onChange={setPrecoInicial}
        {...FAIXAS.preco}
        placeholder="ex.: 19,50"
        disabled={loading}
      />

      <CampoNumero
        id="dias_simulados"
        rotulo="Prazo da simulação"
        unidade="dias úteis"
        ajuda="Até onde os cenários vão. 252 dias úteis são cerca de 1 ano."
        valor={diasSimulados}
        onChange={setDiasSimulados}
        {...FAIXAS.dias}
        disabled={loading}
      />

      <CampoNumero
        id="num_simulacoes"
        rotulo="Quantidade de cenários"
        ajuda="Mais cenários deixam o resultado mais estável, mas a simulação demora mais."
        valor={numSimulacoes}
        onChange={setNumSimulacoes}
        {...FAIXAS.cenarios}
        disabled={loading}
      />

      <CampoNumero
        id="variacao_max"
        rotulo="Variação máxima do preço"
        unidade="%"
        ajuda="O preço simulado fica limitado a esta variação, para cima ou para baixo, em relação ao preço de partida."
        valor={variacaoMax}
        onChange={setVariacaoMax}
        {...FAIXAS.variacao}
        disabled={loading}
      />

      <div className="space-y-1">
        <Label htmlFor="label">
          Nome da simulação <span className="font-normal text-muted-foreground">· opcional</span>
          <FieldTooltip text="Ajuda a encontrar esta simulação depois, na aba Histórico." />
        </Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="ex.: Safra 26/27 pessimista"
          disabled={loading}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Simulando..." : "Simular"}
      </Button>
    </form>
  );
}
