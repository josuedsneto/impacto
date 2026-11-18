"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { leituraCall } from "@/lib/leitura";
import { Leitura } from "@/components/ui/leitura";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { CAMPOS_OPCAO_PADRAO, CamposOpcao, paraApi, type CamposOpcaoValor } from "./CamposOpcao";
import { lerNumero } from "@/lib/numero";
import { LIMITE_CENARIOS_OPCOES } from "@/lib/simulacao";

/** Preço da call por simulação de Monte Carlo, recalculado a cada mudança nos campos. */
export default function MCPricer() {
  const [campos, setCampos] = useState<CamposOpcaoValor>(CAMPOS_OPCAO_PADRAO);
  const [cenarios, setCenarios] = useState("10000");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const valido = paraApi(campos) !== null && campoValido(cenarios, LIMITE_CENARIOS_OPCOES);

  useEffect(() => {
    const params = paraApi(campos);
    if (!params || !campoValido(cenarios, LIMITE_CENARIOS_OPCOES)) return;
    let atual = true; // descarta resposta de uma entrada que já foi trocada
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ price: number }>("/api/options/mc-price", {
          method: "POST",
          body: JSON.stringify({ ...params, num_simulacoes: Math.round(lerNumero(cenarios)!) }),
        });
        if (atual) {
          setPrice(data.price);
          setError(null);
        }
      } catch (e) {
        if (atual) {
          setPrice(null);
          setError((e as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      atual = false;
      clearTimeout(timer);
    };
  }, [campos, cenarios]);

  const mostrarPreco = valido && price !== null;

  return (
    <div className="max-w-xl space-y-4">
      <CamposOpcao prefixo="mc" valor={campos} onChange={setCampos} />
      <CampoNumero
        id="mc-cenarios"
        rotulo="Quantidade de cenários"
        ajuda="Mais cenários aproximam o resultado da fórmula, mas demoram mais."
        valor={cenarios}
        onChange={setCenarios}
        {...LIMITE_CENARIOS_OPCOES}
      />

      {!valido && (
        <p role="status" className="text-sm text-muted-foreground">
          Preencha os campos destacados para ver o preço.
        </p>
      )}
      {valido && error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <p className="text-2xl font-bold">
        Preço da call: <span className="tabular-nums text-brand">{mostrarPreco ? `${formatNumber(price, 4)} ¢/lb` : loading ? "Calculando..." : "—"}</span>
      </p>
      {mostrarPreco && <Leitura>{leituraCall(price)}</Leitura>}
    </div>
  );
}
