"use client";

import { useState } from "react";
import { apiFetch, getToken, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

export function ConsolidadoActions({ isPro }: { isPro: boolean }) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/reports/posicao`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        toast.error("Relatórios PDF disponíveis no plano Profissional ou superior.");
        return;
      }
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_consolidado_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao gerar PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const data = await apiFetch<{ url: string }>(`/api/share`, {
        method: "POST",
        body: JSON.stringify({ type: "consolidado", expires_days: 30 }),
      });
      setShareUrl(data.url);
    } catch {
      toast.error("Erro ao criar link de compartilhamento.");
    } finally {
      setSharing(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado!");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
          {sharing ? "Gerando..." : "Compartilhar"}
        </Button>

        {isPro ? (
          <Button size="sm" onClick={handleDownloadPdf} disabled={downloading}>
            {downloading ? "Gerando PDF..." : "Gerar PDF"}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button size="sm" disabled>Gerar PDF</Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Disponível no plano Profissional ou superior</TooltipContent>
          </Tooltip>
        )}
      </div>

      {shareUrl && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground truncate max-w-xs">{shareUrl}</span>
          <Button size="sm" variant="outline" onClick={copyShareUrl}>Copiar</Button>
          <button
            onClick={() => setShareUrl(null)}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
