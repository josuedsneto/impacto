"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@supabase/ssr";

export interface DolarResult {
  taxa_prevista: number;
  r2: number;
  rmse: number;
  coeficientes: Record<string, number>;
  correlacao: Record<string, Record<string, number>>;
}

export interface DolarDefaults {
  selic: number | null;
  m2_bcb: number | null;
  prod_industrial: number | null;
  fed_funds: number | null;
  m2_fred: number | null;
  indpro: number | null;
}

interface DolarFormProps {
  defaults: DolarDefaults | null;
  onResult: (r: DolarResult) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function DolarForm({ defaults, onResult }: DolarFormProps) {
  const [selic, setSelic] = useState<string>("");
  const [m2Bcb, setM2Bcb] = useState<string>("");
  const [prodIndustrial, setProdIndustrial] = useState<string>("");
  const [fedFunds, setFedFunds] = useState<string>("");
  const [m2Fred, setM2Fred] = useState<string>("");
  const [indpro, setIndpro] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!defaults) return;
    if (defaults.selic != null) setSelic(String(defaults.selic));
    if (defaults.m2_bcb != null) setM2Bcb(String(defaults.m2_bcb));
    if (defaults.prod_industrial != null) setProdIndustrial(String(defaults.prod_industrial));
    if (defaults.fed_funds != null) setFedFunds(String(defaults.fed_funds));
    if (defaults.m2_fred != null) setM2Fred(String(defaults.m2_fred));
    if (defaults.indpro != null) setIndpro(String(defaults.indpro));
  }, [defaults]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/regression/dolar/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          selic: selic !== "" ? parseFloat(selic) : null,
          m2_bcb: m2Bcb !== "" ? parseFloat(m2Bcb) : null,
          prod_industrial: prodIndustrial !== "" ? parseFloat(prodIndustrial) : null,
          fed_funds: fedFunds !== "" ? parseFloat(fedFunds) : null,
          m2_fred: m2Fred !== "" ? parseFloat(m2Fred) : null,
          indpro: indpro !== "" ? parseFloat(indpro) : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data.detail;
        setError(
          Array.isArray(detail)
            ? detail.map((e: { msg: string }) => e.msg).join(", ")
            : (detail ?? "Erro ao executar regressão.")
        );
      } else {
        onResult(data as DolarResult);
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="selic">Selic (% a.a.)</Label>
          <Input
            id="selic"
            type="number"
            step="0.01"
            value={selic}
            onChange={(e) => setSelic(e.target.value)}
            placeholder="Ex: 10.5"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="m2_bcb">M2 BCB (R$ bi)</Label>
          <Input
            id="m2_bcb"
            type="number"
            step="0.01"
            value={m2Bcb}
            onChange={(e) => setM2Bcb(e.target.value)}
            placeholder="Ex: 4800"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="prod_industrial">Prod. Industrial BCB (índice)</Label>
          <Input
            id="prod_industrial"
            type="number"
            step="0.01"
            value={prodIndustrial}
            onChange={(e) => setProdIndustrial(e.target.value)}
            placeholder="Ex: 105.2"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="fed_funds">Fed Funds (% a.a.)</Label>
          <Input
            id="fed_funds"
            type="number"
            step="0.01"
            value={fedFunds}
            onChange={(e) => setFedFunds(e.target.value)}
            placeholder="Ex: 5.25"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="m2_fred">M2 EUA (bi USD)</Label>
          <Input
            id="m2_fred"
            type="number"
            step="0.01"
            value={m2Fred}
            onChange={(e) => setM2Fred(e.target.value)}
            placeholder="Ex: 20800"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="indpro">Prod. Industrial EUA (índice)</Label>
          <Input
            id="indpro"
            type="number"
            step="0.01"
            value={indpro}
            onChange={(e) => setIndpro(e.target.value)}
            placeholder="Ex: 102.5"
            disabled={loading}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Calculando..." : "Calcular Previsão"}
      </Button>
    </form>
  );
}
