"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { lerNumero } from "@/lib/numero";

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

// Campos na ordem da tela; a chave é o nome do campo na API.
const CAMPOS = [
  { chave: "selic", rotulo: "Selic", unidade: "% ao ano", ajuda: "Juros básicos do Brasil. Juros mais altos tendem a atrair dólares e baixar a cotação.", placeholder: "ex.: 10,5" },
  { chave: "m2_bcb", rotulo: "Dinheiro em circulação no Brasil, M2", unidade: "R$ bilhões", ajuda: "Quantidade de moeda na economia brasileira, segundo o Banco Central.", placeholder: "ex.: 5.800" },
  { chave: "prod_industrial", rotulo: "Produção industrial no Brasil", unidade: "índice", ajuda: "Índice de atividade da indústria brasileira (IBGE).", placeholder: "ex.: 102,5" },
  { chave: "fed_funds", rotulo: "Juros dos EUA, Fed Funds", unidade: "% ao ano", ajuda: "Juros básicos dos EUA. Juros americanos mais altos tendem a fortalecer o dólar.", placeholder: "ex.: 5,25" },
  { chave: "m2_fred", rotulo: "Dinheiro em circulação nos EUA, M2", unidade: "US$ bilhões", ajuda: "Quantidade de moeda na economia americana, segundo o Fed.", placeholder: "ex.: 21.000" },
  { chave: "indpro", rotulo: "Produção industrial nos EUA", unidade: "índice", ajuda: "Índice de atividade da indústria americana (Fed).", placeholder: "ex.: 102,5" },
] as const;

type Chave = (typeof CAMPOS)[number]["chave"];
const FAIXA = { min: -1_000_000, max: 100_000_000 };

export default function DolarForm({ defaults, onResult }: DolarFormProps) {
  const [valores, setValores] = useState<Record<Chave, string>>(
    () => Object.fromEntries(CAMPOS.map((c) => [c.chave, ""])) as Record<Chave, string>
  );
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
      const data = await apiFetch<DolarResult>("/api/regression/dolar/run", {
        method: "POST",
        timeoutMs: 120_000,
        body: JSON.stringify({
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

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Calculando..." : "Calcular previsão"}
      </Button>
    </form>
  );
}
