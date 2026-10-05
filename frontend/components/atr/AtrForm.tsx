"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface Usina {
  id: string;
  nome: string;
}

export interface AtrResult {
  atr_min: number;
  atr_esperado: number;
  atr_max: number;
  producao_total: number | null;
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
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        usina_id: usinaId,
        chuva_mm: parseFloat(chuva),
        impureza_pct: parseFloat(impureza),
      };
      if (volume !== "") {
        body.volume_moagem = parseFloat(volume);
      }

      onResult(await apiFetch<AtrResult>("/api/atr/simulate", {
        method: "POST",
        body: JSON.stringify(body),
      }));
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
        <div className="space-y-1">
          <Label htmlFor="chuva">Chuva (mm)</Label>
          <Input
            id="chuva"
            type="number"
            step="0.1"
            value={chuva}
            onChange={(e) => setChuva(e.target.value)}
            placeholder="ex: 80"
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="impureza">Impureza (%)</Label>
          <Input
            id="impureza"
            type="number"
            step="0.1"
            value={impureza}
            onChange={(e) => setImpureza(e.target.value)}
            placeholder="ex: 5.2"
            disabled={loading}
            required
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="volume">Volume de Moagem (ton/safra)</Label>
          <Input
            id="volume"
            type="number"
            step="1"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder="opcional"
            disabled={loading}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading || usinas.length === 0} className="w-full">
        {loading ? "Simulando..." : "Simular"}
      </Button>
    </form>
  );
}
