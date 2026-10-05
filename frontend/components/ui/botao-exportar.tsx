"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { baixarCsv } from "@/lib/csv";

interface BotaoExportarProps {
  /** Nome do arquivo, de lib/csv.ts nomeArquivo(). */
  arquivo: string;
  /** Monta o conteúdo do CSV; null enquanto não há resultado na tela (EXP-01 AC2). */
  montar: (() => string) | null;
}

export function BotaoExportar({ arquivo, montar }: BotaoExportarProps) {
  return (
    // Botão desabilitado não dispara hover; a dica fica no invólucro.
    <span title={montar ? undefined : "Gere um resultado para exportar."}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!montar}
        onClick={() => montar && baixarCsv(arquivo, montar())}
      >
        <Download className="size-4" aria-hidden />
        Exportar CSV
      </Button>
    </span>
  );
}
