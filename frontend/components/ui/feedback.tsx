import { AlertCircle, Inbox, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bloco cinza pulsante no formato do conteúdo que está carregando. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Substitui o conteúdo quando a carga inicial falha (UI-08 AC5). */
export function ErrorState({ mensagem, onRetry }: { mensagem: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center">
      <AlertCircle className="size-6 text-negative" aria-hidden />
      <p className="max-w-md text-sm text-foreground">{mensagem}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="size-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Lista sem itens: frase e, quando houver, a ação para criar o primeiro (UI-08 AC7). */
export function EmptyState({ mensagem, acao }: { mensagem: string; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <Inbox className="size-6 text-muted-foreground" aria-hidden />
      <p className="max-w-md text-sm text-muted-foreground">{mensagem}</p>
      {acao}
    </div>
  );
}
