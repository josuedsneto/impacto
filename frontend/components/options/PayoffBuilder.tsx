"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { lerNumero } from "@/lib/numero";

interface OptionLeg {
  id: string;
  type: "call" | "put";
  // Texto digitado; convertido com lerNumero só no envio.
  strike: string;
  premium: string;
  position: "long" | "short";
  quantity: string;
}

const FAIXAS = {
  strike: { min: 0.0001, max: 1_000_000 },
  premium: { min: 0, max: 1_000_000 },
  quantity: { min: 1, max: 100_000 },
};

export interface PayoffResult {
  prices: number[];
  payoff: number[];
}

interface PayoffBuilderProps {
  onPayoffResult: (result: PayoffResult) => void;
}

let legCounter = 0;

function newLeg(): OptionLeg {
  legCounter += 1;
  return {
    id: `leg-${legCounter}`,
    type: "call",
    strike: "20",
    premium: "1",
    position: "long",
    quantity: "1",
  };
}

export default function PayoffBuilder({ onPayoffResult }: PayoffBuilderProps) {
  const [legs, setLegs] = useState<OptionLeg[]>([newLeg()]);
  const [loading, setLoading] = useState(false);

  function addLeg() {
    setLegs((prev) => [...prev, newLeg()]);
  }

  function removeLeg(id: string) {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLeg<K extends keyof OptionLeg>(
    id: string,
    field: K,
    value: OptionLeg[K]
  ) {
    setLegs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  async function handleCalculate() {
    if (legs.length === 0) return;
    const validas = legs.every(
      (l) =>
        campoValido(l.strike, FAIXAS.strike) &&
        campoValido(l.premium, FAIXAS.premium) &&
        campoValido(l.quantity, FAIXAS.quantity)
    );
    if (!validas) {
      toast.error("Corrija os campos destacados antes de calcular.");
      return;
    }
    setLoading(true);
    try {
      const payload = legs.map((l) => ({
        type: l.type,
        position: l.position,
        strike: lerNumero(l.strike),
        premium: lerNumero(l.premium),
        quantity: Math.round(lerNumero(l.quantity)!),
      }));
      onPayoffResult(await apiFetch<PayoffResult>("/api/options/payoff", {
        method: "POST",
        body: JSON.stringify({ legs: payload }),
      }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {legs.map((leg, idx) => (
        <div
          key={leg.id}
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Perna {idx + 1}</span>
            <button
              type="button"
              onClick={() => removeLeg(leg.id)}
              className="text-sm text-negative hover:underline"
            >
              Remover
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor={`${leg.id}-tipo`}>Tipo <FieldTooltip text="Call dá o direito de comprar o ativo no strike; put dá o direito de vender." /></Label>
              <select
                id={`${leg.id}-tipo`}
                value={leg.type}
                onChange={(e) =>
                  updateLeg(leg.id, "type", e.target.value as "call" | "put")
                }
                className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="call">Call (direito de comprar)</option>
                <option value="put">Put (direito de vender)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`${leg.id}-posicao`}>Posição <FieldTooltip text="Comprado paga o prêmio e ganha se a opção valer a pena; vendido recebe o prêmio e assume o risco." /></Label>
              <select
                id={`${leg.id}-posicao`}
                value={leg.position}
                onChange={(e) =>
                  updateLeg(
                    leg.id,
                    "position",
                    e.target.value as "long" | "short"
                  )
                }
                className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="long">Comprado (paga o prêmio)</option>
                <option value="short">Vendido (recebe o prêmio)</option>
              </select>
            </div>

            <CampoNumero
              id={`${leg.id}-strike`}
              rotulo="Preço de exercício"
              ajuda="Preço do ativo em que a opção desta perna passa a valer a pena."
              valor={leg.strike}
              onChange={(t) => updateLeg(leg.id, "strike", t)}
              {...FAIXAS.strike}
            />
            <CampoNumero
              id={`${leg.id}-premio`}
              rotulo="Prêmio por contrato"
              ajuda="Quanto se paga (comprado) ou se recebe (vendido) por esta opção."
              valor={leg.premium}
              onChange={(t) => updateLeg(leg.id, "premium", t)}
              {...FAIXAS.premium}
            />
            <CampoNumero
              id={`${leg.id}-qtd`}
              rotulo="Contratos"
              ajuda="Quantidade de opções desta perna."
              valor={leg.quantity}
              onChange={(t) => updateLeg(leg.id, "quantity", t)}
              {...FAIXAS.quantity}
            />
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={addLeg}>
          Adicionar perna
        </Button>
        <Button type="button" onClick={handleCalculate} disabled={loading || legs.length === 0}>
          {loading ? "Calculando..." : "Calcular resultado"}
        </Button>
      </div>

    </div>
  );
}
