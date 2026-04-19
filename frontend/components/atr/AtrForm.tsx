"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBrowserClient } from "@supabase/ssr";

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

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function AtrForm({ usinas, onResult, onUsinaChange }: AtrFormProps) {
  const [usinaId, setUsinaId] = useState<string>("");
  const [chuva, setChuva] = useState<string>("");
  const [impureza, setImpureza] = useState<string>("");
  const [volume, setVolume] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    try {
      const token = await getAccessToken();
      const body: Record<string, unknown> = {
        usina_id: usinaId,
        chuva_mm: parseFloat(chuva),
        impureza_pct: parseFloat(impureza),
      };
      if (volume !== "") {
        body.volume_moagem = parseFloat(volume);
      }

      const res = await fetch(`${API}/api/atr/simulate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = (data as { detail?: unknown }).detail;
        setError(
          Array.isArray(detail)
            ? (detail as { msg: string }[]).map((e) => e.msg).join(", ")
            : ((detail as string) ?? "Erro ao executar simulação.")
        );
      } else {
        onResult(data as AtrResult);
      }
    } catch {
      setError("Erro de conexão com o servidor.");
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

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading || usinas.length === 0}>
        {loading ? "Simulando..." : "Simular"}
      </Button>
    </form>
  );
}
