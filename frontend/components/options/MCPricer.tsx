"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function MCPricer() {
  const [S, setS] = useState(20);
  const [K, setK] = useState(20);
  const [T, setT] = useState(1);
  const [r, setR] = useState(0.05);
  const [sigma, setSigma] = useState(0.2);
  const [numSimulacoes, setNumSimulacoes] = useState(10000);
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/options/mc-price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ S, K, T, r, sigma, num_simulacoes: numSimulacoes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Erro ao calcular preço MC.");
      } else {
        setPrice(data.price);
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="mc-S">S (Preço atual) <FieldTooltip text="Preço spot atual do ativo subjacente" /></Label>
          <Input
            id="mc-S"
            type="number"
            step={0.5}
            value={S}
            onChange={(e) => setS(parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="mc-K">K (Strike) <FieldTooltip text="Preço de exercício (strike) da opção" /></Label>
          <Input
            id="mc-K"
            type="number"
            step={0.5}
            value={K}
            onChange={(e) => setK(parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="mc-T">T (Anos até vencimento) <FieldTooltip text="Tempo até vencimento em anos. Ex: 0.25 = 3 meses" /></Label>
          <Input
            id="mc-T"
            type="number"
            step={0.1}
            min={0.01}
            value={T}
            onChange={(e) => setT(parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="mc-r">r (Taxa livre de risco) <FieldTooltip text="Taxa de juros livre de risco anualizada. Ex: 0.105 = 10,5% a.a." /></Label>
          <Input
            id="mc-r"
            type="number"
            step={0.005}
            min={0}
            value={r}
            onChange={(e) => setR(parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="mc-sigma">σ (Volatilidade) <FieldTooltip text="Volatilidade anualizada. Ex: 0.25 = 25% a.a." /></Label>
          <Input
            id="mc-sigma"
            type="number"
            step={0.01}
            min={0.001}
            value={sigma}
            onChange={(e) => setSigma(parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="mc-n">Nº de simulações <FieldTooltip text="Quantidade de caminhos Monte Carlo para estimar o preço" /></Label>
          <Input
            id="mc-n"
            type="number"
            min={100}
            max={100000}
            step={1000}
            value={numSimulacoes}
            onChange={(e) => setNumSimulacoes(parseInt(e.target.value, 10))}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="button" onClick={handleCalculate} disabled={loading}>
        {loading ? "Calculando..." : "Calcular (MC)"}
      </Button>

      <p className="text-2xl font-bold">
        Preço MC:{" "}
        <span className="text-primary">
          {price !== null ? price.toFixed(4) : "—"}
        </span>
      </p>
    </div>
  );
}
