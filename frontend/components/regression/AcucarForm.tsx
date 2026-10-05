"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { lerNumero } from "@/lib/numero";

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

// Campos na ordem da tela; a chave é o nome do campo na API.
const CAMPOS = [
  { chave: "estoque_inicial", rotulo: "Estoque inicial mundial", unidade: "milhões de t", ajuda: "Açúcar em estoque no mundo no começo da safra (USDA).", placeholder: "ex.: 46,5" },
  { chave: "producao", rotulo: "Produção mundial", unidade: "milhões de t", ajuda: "Açúcar produzido no mundo na safra (USDA).", placeholder: "ex.: 190" },
  { chave: "demanda", rotulo: "Consumo mundial", unidade: "milhões de t", ajuda: "Açúcar consumido no mundo na safra (USDA).", placeholder: "ex.: 182" },
  { chave: "estoque_final", rotulo: "Estoque final mundial", unidade: "milhões de t", ajuda: "Açúcar em estoque no fim da safra. Estoque maior tende a baixar o preço.", placeholder: "ex.: 48,5" },
  { chave: "estoque_uso_pct", rotulo: "Estoque sobre consumo", unidade: "%", ajuda: "Estoque final dividido pelo consumo. Quanto maior, mais folgado está o mercado.", placeholder: "ex.: 26,6" },
  { chave: "usdbrl", rotulo: "Câmbio", unidade: "R$/US$", ajuda: "Dólar mais caro incentiva o Brasil a exportar mais açúcar.", placeholder: "ex.: 5,40" },
  { chave: "cl_f", rotulo: "Petróleo WTI", unidade: "US$/barril", ajuda: "Petróleo mais caro favorece o etanol e tira cana do açúcar.", placeholder: "ex.: 75" },
] as const;

type Chave = (typeof CAMPOS)[number]["chave"];
const FAIXA = { min: -1_000_000, max: 100_000_000 };

export default function AcucarForm({ defaults, onResult }: AcucarFormProps) {
  const [valores, setValores] = useState<Record<Chave, string>>(
    () => Object.fromEntries(CAMPOS.map((c) => [c.chave, ""])) as Record<Chave, string>
  );
  const [modelType, setModelType] = useState<string>("ridge");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!defaults) return;
    // Valores atuais vindos da API, já em formato pt-BR para edição.
    setValores((prev) => {
      const novo = { ...prev };
      for (const c of CAMPOS) {
        const v = (defaults as unknown as Record<string, number | null>)[c.chave];
        if (v != null) novo[c.chave] = String(v).replace(".", ",");
      }
      return novo;
    });
  }, [defaults]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!CAMPOS.every((c) => campoValido(valores[c.chave], FAIXA))) {
      toast.error("Preencha todos os campos com números antes de calcular.");
      return;
    }
    setLoading(true);

    try {
      const data = await apiFetch<AcucarResult>("/api/regression/acucar/run", {
        method: "POST",
        timeoutMs: 120_000,
        body: JSON.stringify({
          model: modelType,
          ...Object.fromEntries(CAMPOS.map((c) => [c.chave, lerNumero(valores[c.chave])])),
        }),
      });
      onResult(data);
      toast.success("Previsão calculada e salva no histórico.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CAMPOS.map((c) => (
          <CampoNumero
            key={c.chave}
            id={c.chave}
            rotulo={c.rotulo}
            unidade={c.unidade}
            ajuda={c.ajuda}
            valor={valores[c.chave]}
            onChange={(t) => setValores((prev) => ({ ...prev, [c.chave]: t }))}
            {...FAIXA}
            placeholder={c.placeholder}
            disabled={loading}
          />
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="model_type">Modelo</Label>
        <select
          id="model_type"
          value={modelType}
          onChange={(e) => setModelType(e.target.value)}
          disabled={loading}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="ridge">Linear (Ridge)</option>
          <option value="xgboost">Árvores de decisão (XGBoost)</option>
        </select>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Calculando..." : "Calcular previsão"}
      </Button>
    </form>
  );
}
