"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OptionLeg {
  id: string;
  type: "call" | "put";
  strike: number;
  premium: number;
  position: "long" | "short";
  quantity: number;
}

export interface PayoffResult {
  prices: number[];
  payoff: number[];
}

interface PayoffBuilderProps {
  onPayoffResult: (result: PayoffResult) => void;
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

let legCounter = 0;

function newLeg(): OptionLeg {
  legCounter += 1;
  return {
    id: `leg-${legCounter}`,
    type: "call",
    strike: 20,
    premium: 1,
    position: "long",
    quantity: 1,
  };
}

export default function PayoffBuilder({ onPayoffResult }: PayoffBuilderProps) {
  const [legs, setLegs] = useState<OptionLeg[]>([newLeg()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/options/payoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ legs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Erro ao calcular payoff.");
      } else {
        onPayoffResult(data as PayoffResult);
      }
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {legs.map((leg, idx) => (
        <div
          key={leg.id}
          className="rounded-lg border p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Leg {idx + 1}</span>
            <button
              type="button"
              onClick={() => removeLeg(leg.id)}
              className="text-sm text-red-600 hover:underline"
            >
              Remover
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select
                value={leg.type}
                onChange={(e) =>
                  updateLeg(leg.id, "type", e.target.value as "call" | "put")
                }
                className="w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Posição</Label>
              <select
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
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Strike</Label>
              <Input
                type="number"
                step={0.5}
                value={leg.strike}
                onChange={(e) =>
                  updateLeg(leg.id, "strike", parseFloat(e.target.value))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Prêmio</Label>
              <Input
                type="number"
                step={0.01}
                min={0}
                value={leg.premium}
                onChange={(e) =>
                  updateLeg(leg.id, "premium", parseFloat(e.target.value))
                }
              />
            </div>

            <div className="space-y-1">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={leg.quantity}
                onChange={(e) =>
                  updateLeg(leg.id, "quantity", parseInt(e.target.value, 10))
                }
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={addLeg}>
          Adicionar Leg
        </Button>
        <Button type="button" onClick={handleCalculate} disabled={loading || legs.length === 0}>
          {loading ? "Calculando..." : "Calcular Payoff"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
