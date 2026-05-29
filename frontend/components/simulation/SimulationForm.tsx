"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { ComputingLoader } from "@/components/ui/computing-loader";
import { apiFetch, getToken, API_URL } from "@/lib/api";

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
  const [precoInicial, setPrecoInicial] = useState<number>(0);
  const [diasSimulados, setDiasSimulados] = useState<number>(252);
  const [numSimulacoes, setNumSimulacoes] = useState<number>(10000);
  const [pctBound, setPctBound] = useState<number>(0.5);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadParams() {
      try {
        const data = await apiFetch<{ pct_bound_preferido?: number | null }>(
          `/api/params/${encodeURIComponent(ticker)}`
        );
        if (data.pct_bound_preferido != null) setPctBound(data.pct_bound_preferido);
      } catch {
        // silently ignore — defaults remain (ex.: 404 sem params salvos)
      }
    }
    loadParams();
  }, [ticker]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/simulations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          preco_inicial: precoInicial,
          dias_simulados: diasSimulados,
          num_simulacoes: numSimulacoes,
          pct_bound: pctBound,
          label: label.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data.detail;
        setError(
          Array.isArray(detail)
            ? detail.map((e: { msg: string }) => e.msg).join(", ")
            : (detail ?? "Erro ao executar simulação.")
        );
        return;
      }

      // Poll until simulation completes (backend runs it as a background task)
      const simId: string = data.id;
      let result = data;
      for (let i = 0; i < 60; i++) {
        if (result.status !== "running") break;
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(`${API_URL}/api/simulations/${simId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!pollRes.ok) break;
        result = await pollRes.json();
      }

      if (result.status === "error") {
        setError("Simulação falhou no servidor. Tente novamente.");
      } else if (result.status === "done") {
        onResult(result as SimulationResult);
      } else {
        setError("Simulação demorou muito. Verifique o histórico.");
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div className="space-y-1">
        <Label htmlFor="ticker">Ticker <FieldTooltip text="Símbolo do ativo no Yahoo Finance. Ex: SB=F (açúcar NY #11), USDBRL=X (dólar/real)" /></Label>
        <Input
          id="ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="SB=F"
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="preco_inicial">Preço inicial <FieldTooltip text="Preço de entrada para a simulação, em centavos/libra (açúcar) ou reais (câmbio)" /></Label>
        <Input
          id="preco_inicial"
          type="number"
          step={0.01}
          value={precoInicial}
          onChange={(e) => setPrecoInicial(parseFloat(e.target.value))}
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="dias_simulados">Dias simulados <FieldTooltip text="Dias úteis a simular. 252 = 1 ano útil" /></Label>
        <Input
          id="dias_simulados"
          type="number"
          min={1}
          max={1260}
          value={diasSimulados}
          onChange={(e) => setDiasSimulados(parseInt(e.target.value, 10))}
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="num_simulacoes">Número de simulações <FieldTooltip text="Quantidade de caminhos Monte Carlo. Mais = maior precisão, porém mais lento" /></Label>
        <Input
          id="num_simulacoes"
          type="number"
          min={100}
          max={50000}
          value={numSimulacoes}
          onChange={(e) => setNumSimulacoes(parseInt(e.target.value, 10))}
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="pct_bound">Limite percentual (pct_bound) <FieldTooltip text="Limite de variação diária máxima como fração do preço. 0.5 = ±50% por dia" /></Label>
        <Input
          id="pct_bound"
          type="number"
          step={0.01}
          min={0.01}
          max={1.0}
          value={pctBound}
          onChange={(e) => setPctBound(parseFloat(e.target.value))}
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="label">Nome da simulação (opcional) <FieldTooltip text="Nome opcional para identificar esta simulação no histórico" /></Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nome da simulação (opcional)"
          disabled={loading}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Aguarde..." : "Simular"}
      </Button>

      {loading && (
        <ComputingLoader label="Executando simulação Monte Carlo..." expectedSeconds={20} />
      )}
    </form>
  );
}
