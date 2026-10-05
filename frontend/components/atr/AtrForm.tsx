"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { lerNumero } from "@/lib/numero";

// Faixas aceitas pela API (backend/main.py AtrSimulateBody).
const FAIXAS = {
  chuva: { min: 0.1, max: 1000 },
  impureza: { min: 0.1, max: 99.9 },
  volume: { min: 1, max: 100_000_000, opcional: true },
};

export interface Usina {
  id: string;
  nome: string;
}

export interface AtrResult {
  atr_min: number;
  atr_esperado: number;
  atr_max: number;
  producao_total: number | null;
  /** Valores informados, para a frase de leitura (preenchido pelo formulário, não pela API). */
  entrada?: { chuva_mm: number; impureza_pct: number };
}

interface AtrFormProps {
  usinas: Usina[];
  onResult: (r: AtrResult) => void;
  onUsinaChange?: (id: string) => void;
}

export default function AtrForm({ usinas, onResult, onUsinaChange }: AtrFormProps) {
  const [usinaId, setUsinaId] = useState<string>("");
  const [chuva, setChuva] = useState<string>("");
  const [impureza, setImpureza] = useState<string>("");
  const [volume, setVolume] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (usinas.length > 0 && !usinaId) {
      const first = usinas[0].id;
      setUsinaId(first);
      onUsinaChange?.(first);
    }
  }, [usinas, usinaId, onUsinaChange]);

  function handleUsinaChange(id: string) {
    setUsinaId(id);
    onUsinaChange?.(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !campoValido(chuva, FAIXAS.chuva) ||
      !campoValido(impureza, FAIXAS.impureza) ||
      !campoValido(volume, FAIXAS.volume)
    ) {
      toast.error("Corrija os campos destacados antes de simular.");
      return;
    }
    setLoading(true);

    try {
      const entrada = { chuva_mm: lerNumero(chuva)!, impureza_pct: lerNumero(impureza)! };
      const body: Record<string, unknown> = { usina_id: usinaId, ...entrada };
      if (volume.trim()) {
        body.volume_moagem = lerNumero(volume);
      }

      const resultado = await apiFetch<AtrResult>("/api/atr/simulate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onResult({ ...resultado, entrada });
      toast.success("Simulação de ATR salva no histórico.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="usina">Usina</Label>
        <select
          id="usina"
          value={usinaId}
          onChange={(e) => handleUsinaChange(e.target.value)}
          disabled={loading || usinas.length === 0}
          className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {usinas.length === 0 && (
            <option value="">Nenhuma usina disponível</option>
          )}
          {usinas.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CampoNumero
          id="chuva"
          rotulo="Chuva no mês"
          unidade="mm"
          ajuda="Chuva acumulada no mês. Mais chuva costuma diluir a sacarose e baixar o ATR."
          valor={chuva}
          onChange={setChuva}
          {...FAIXAS.chuva}
          placeholder="ex.: 80"
          disabled={loading}
        />
        <CampoNumero
          id="impureza"
          rotulo="Impureza total"
          unidade="%"
          ajuda="Terra e palha que chegam com a cana (vegetal + mineral). Mais impureza reduz o ATR."
          valor={impureza}
          onChange={setImpureza}
          {...FAIXAS.impureza}
          placeholder="ex.: 12,5"
          disabled={loading}
        />
        <CampoNumero
          id="volume"
          rotulo="Moagem da safra"
          unidade="t de cana"
          ajuda="Se informada, a tela estima também a produção total de açúcar."
          valor={volume}
          onChange={setVolume}
          {...FAIXAS.volume}
          placeholder="ex.: 1.300.000"
          disabled={loading}
        />
      </div>

      <Button type="submit" disabled={loading || usinas.length === 0} className="w-full">
        {loading ? "Simulando..." : "Simular"}
      </Button>
    </form>
  );
}
