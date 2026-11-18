"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { leituraCall } from "@/lib/leitura";
import { Leitura } from "@/components/ui/leitura";
import { CAMPOS_OPCAO_PADRAO, CamposOpcao, paraApi, type CamposOpcaoValor } from "./CamposOpcao";

/** Preço justo da call sobre futuro (Black-76), recalculado a cada mudança nos campos. */
export default function BSPricer() {
  const [campos, setCampos] = useState<CamposOpcaoValor>(CAMPOS_OPCAO_PADRAO);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valido = paraApi(campos) !== null;

  useEffect(() => {
    const params = paraApi(campos);
    if (!params) return;
    let atual = true; // descarta resposta de uma entrada que já foi trocada
    // Espera o usuário parar de digitar antes de chamar a API.
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ price: number }>("/api/options/bs-price", {
          method: "POST",
          body: JSON.stringify(params),
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
      }
    }, 300);
    return () => {
      atual = false;
      clearTimeout(timer);
    };
  }, [campos]);

  // Com entrada inválida não mostramos o último preço: ele não corresponde aos campos.
  const mostrarPreco = valido && price !== null;

  return (
    <div className="max-w-xl space-y-4">
      <CamposOpcao prefixo="bs" valor={campos} onChange={setCampos} />

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
        Preço da call: <span className="tabular-nums text-brand">{mostrarPreco ? `${formatNumber(price, 4)} ¢/lb` : "—"}</span>
      </p>
      {mostrarPreco && <Leitura>{leituraCall(price)}</Leitura>}
    </div>
  );
}
