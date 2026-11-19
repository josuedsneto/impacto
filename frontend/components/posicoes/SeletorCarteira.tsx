"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safraAtual, type Exposicao } from "@/lib/posicoes";

interface Usina { id: string; nome: string }

/**
 * Escolhe usina e safra da carteira e busca a exposição aberta (GET /api/posicoes/exposicao).
 * Quem usa decide o que preencher com o resultado, via onUsar.
 */
export function SeletorCarteira({ rotuloBotao, onUsar }: { rotuloBotao: string; onUsar: (ex: Exposicao) => void }) {
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [usinaId, setUsinaId] = useState("");
  const [safra, setSafra] = useState(safraAtual);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    apiFetch<{ usinas: Usina[] }>("/api/atr/usinas")
      .then((d) => {
        setUsinas(d.usinas);
        setUsinaId((atual) => atual || d.usinas[0]?.id || "");
      })
      .catch((e) => toast.error((e as Error).message));
  }, []);

  async function usar() {
    if (!usinaId || !/^\d{4}\/\d{2}$/.test(safra)) {
      toast.error("Escolha a usina e informe a safra no formato 2026/27.");
      return;
    }
    setBuscando(true);
    try {
      const ex = await apiFetch<Exposicao>(`/api/posicoes/exposicao?usina_id=${usinaId}&safra=${encodeURIComponent(safra)}`);
      onUsar(ex);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Usina</span>
        <select aria-label="Usina da carteira" className="h-9 rounded-md border bg-background px-3 text-sm"
          value={usinaId} onChange={(e) => setUsinaId(e.target.value)}>
          {usinas.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Safra</span>
        <Input aria-label="Safra da carteira" className="h-9 w-32" value={safra} onChange={(e) => setSafra(e.target.value)} placeholder="2026/27" />
      </label>
      <Button type="button" variant="outline" onClick={usar} disabled={buscando || !usinaId}>
        {buscando ? "Buscando..." : rotuloBotao}
      </Button>
    </div>
  );
}
