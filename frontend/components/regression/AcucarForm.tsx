"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@supabase/ssr";

export interface AcucarDefaults {
  sb_f: number | null;
  usdbrl: number | null;
  cl_f: number | null;
  estoque_inicial: number | null;
  producao: number | null;
  demanda: number | null;
  estoque_final: number | null;
  estoque_uso_pct: number | null;
}

export interface HistoricoPoint {
  year: number;
  sb_f_real: number;
  sb_f_previsto: number;
}

export interface AcucarResult {
  sb_f_previsto: number;
  sb_f_min: number;
  sb_f_max: number;
  r2: number;
  rmse: number;
  historico: HistoricoPoint[];
}

interface AcucarFormProps {
  defaults: AcucarDefaults | null;
  onResult: (r: AcucarResult) => void;
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

export default function AcucarForm({ defaults, onResult }: AcucarFormProps) {
  const [estoqueInicial, setEstoqueInicial] = useState<string>("");
  const [producao, setProducao] = useState<string>("");
  const [demanda, setDemanda] = useState<string>("");
  const [estoqueFinal, setEstoqueFinal] = useState<string>("");
  const [estoqueUsoPct, setEstoqueUsoPct] = useState<string>("");
  const [usdbrl, setUsdbrl] = useState<string>("");
  const [clF, setClF] = useState<string>("");
  const [modelType, setModelType] = useState<string>("ridge");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!defaults) return;
    if (defaults.estoque_inicial != null) setEstoqueInicial(String(defaults.estoque_inicial));
    if (defaults.producao != null) setProducao(String(defaults.producao));
    if (defaults.demanda != null) setDemanda(String(defaults.demanda));
    if (defaults.estoque_final != null) setEstoqueFinal(String(defaults.estoque_final));
    if (defaults.estoque_uso_pct != null) setEstoqueUsoPct(String(defaults.estoque_uso_pct));
    if (defaults.usdbrl != null) setUsdbrl(String(defaults.usdbrl));
    if (defaults.cl_f != null) setClF(String(defaults.cl_f));
  }, [defaults]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/regression/acucar/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          model: modelType,
          estoque_inicial: estoqueInicial !== "" ? parseFloat(estoqueInicial) : null,
          producao: producao !== "" ? parseFloat(producao) : null,
          demanda: demanda !== "" ? parseFloat(demanda) : null,
          estoque_final: estoqueFinal !== "" ? parseFloat(estoqueFinal) : null,
          estoque_uso_pct: estoqueUsoPct !== "" ? parseFloat(estoqueUsoPct) : null,
          usdbrl: usdbrl !== "" ? parseFloat(usdbrl) : null,
          cl_f: clF !== "" ? parseFloat(clF) : null,
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
        onResult(data as AcucarResult);
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label htmlFor="estoque_inicial">Estoque Inicial (Mt)</Label>
          <Input
            id="estoque_inicial"
            type="number"
            step="0.01"
            value={estoqueInicial}
            onChange={(e) => setEstoqueInicial(e.target.value)}
            placeholder="Ex: 46.5"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="producao">Produção (Mt)</Label>
          <Input
            id="producao"
            type="number"
            step="0.01"
            value={producao}
            onChange={(e) => setProducao(e.target.value)}
            placeholder="Ex: 186.0"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="demanda">Demanda (Mt)</Label>
          <Input
            id="demanda"
            type="number"
            step="0.01"
            value={demanda}
            onChange={(e) => setDemanda(e.target.value)}
            placeholder="Ex: 178.5"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="estoque_final">Estoque Final (Mt)</Label>
          <Input
            id="estoque_final"
            type="number"
            step="0.01"
            value={estoqueFinal}
            onChange={(e) => setEstoqueFinal(e.target.value)}
            placeholder="Ex: 47.0"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="estoque_uso_pct">Estoque/Uso (%)</Label>
          <Input
            id="estoque_uso_pct"
            type="number"
            step="0.01"
            value={estoqueUsoPct}
            onChange={(e) => setEstoqueUsoPct(e.target.value)}
            placeholder="Ex: 26.3"
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="usdbrl">USD/BRL</Label>
          <Input
            id="usdbrl"
            type="number"
            step="0.01"
            value={usdbrl}
            onChange={(e) => setUsdbrl(e.target.value)}
            placeholder="Ex: 5.10"
            disabled={loading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cl_f">CL=F (Petróleo, USD/bbl)</Label>
          <Input
            id="cl_f"
            type="number"
            step="0.01"
            value={clF}
            onChange={(e) => setClF(e.target.value)}
            placeholder="Ex: 72.0"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="model_type">Modelo</Label>
        <select
          id="model_type"
          value={modelType}
          onChange={(e) => setModelType(e.target.value)}
          disabled={loading}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="ridge">Ridge Regression</option>
          <option value="xgboost">XGBoost</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading}>
        {loading ? "Calculando..." : "Calcular Previsão SB=F"}
      </Button>
    </form>
  );
}
