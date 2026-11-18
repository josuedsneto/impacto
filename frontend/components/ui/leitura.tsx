import { Lightbulb } from "lucide-react";

/** Frase em português que diz o que o resultado significa (LING-03). */
export function Leitura({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <p className="text-sm leading-relaxed text-foreground">{children}</p>
    </div>
  );
}
