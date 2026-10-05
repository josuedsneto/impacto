"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { leituraCall } from "@/lib/leitura";
import { lerNumero } from "@/lib/numero";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { Leitura } from "@/components/ui/leitura";
import { CAMPOS_OPCAO_PADRAO, CamposOpcao, paraApi, type CamposOpcaoValor } from "./CamposOpcao";

const FAIXA_CENARIOS = { min: 100, max: 100_000 };

/** Preço da call por simulação de Monte Carlo (botão Calcular). */
export default function MCPricer() {
  const [campos, setCampos] = useState<CamposOpcaoValor>(CAMPOS_OPCAO_PADRAO);
  const [cenarios, setCenarios] = useState("10000");
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCalculate() {
    const params = paraApi(campos);
    if (!params || !campoValido(cenarios, FAIXA_CENARIOS)) {
      toast.error("Corrija os campos destacados antes de calcular.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ price: number }>("/api/options/mc-price", {
        method: "POST",
        body: JSON.stringify({ ...params, num_simulacoes: Math.round(lerNumero(cenarios)!) }),
      });
      setPrice(data.price);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <CamposOpcao prefixo="mc" valor={campos} onChange={setCampos} disabled={loading} />
      <CampoNumero
        id="mc-cenarios"
        rotulo="Quantidade de cenários"
        ajuda="Mais cenários aproximam o resultado do Black-Scholes, mas demoram mais."
        valor={cenarios}
        onChange={setCenarios}
        {...FAIXA_CENARIOS}
        disabled={loading}
      />

      <Button type="button" onClick={handleCalculate} disabled={loading}>
        {loading ? "Calculando..." : "Calcular"}
      </Button>

      <p className="text-2xl font-bold">
        Preço da call: <span className="tabular-nums text-brand">{formatNumber(price, 4)}</span>
      </p>
      {price !== null && <Leitura>{leituraCall(price)}</Leitura>}
    </div>
  );
}
