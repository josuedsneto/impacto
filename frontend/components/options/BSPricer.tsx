"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { leituraCall } from "@/lib/leitura";
import { Leitura } from "@/components/ui/leitura";
import { CAMPOS_OPCAO_PADRAO, CamposOpcao, paraApi, type CamposOpcaoValor } from "./CamposOpcao";

/** Preço da call por Black-Scholes, recalculado a cada mudança nos campos. */
export default function BSPricer() {
  const [campos, setCampos] = useState<CamposOpcaoValor>(CAMPOS_OPCAO_PADRAO);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = paraApi(campos);
    if (!params) return;
    // Espera o usuário parar de digitar antes de chamar a API.
    const timer = setTimeout(async () => {
      try {
        const data = await apiFetch<{ price: number }>("/api/options/bs-price", {
          method: "POST",
          body: JSON.stringify(params),
        });
        setPrice(data.price);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [campos]);

  return (
    <div className="max-w-xl space-y-4">
      <CamposOpcao prefixo="bs" valor={campos} onChange={setCampos} />

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <p className="text-2xl font-bold">
        Preço da call: <span className="tabular-nums text-brand">{formatNumber(price, 4)}</span>
      </p>
      {price !== null && <Leitura>{leituraCall(price)}</Leitura>}
    </div>
  );
}
