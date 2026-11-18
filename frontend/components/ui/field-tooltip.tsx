"use client";

import { useState } from "react";
import Link from "next/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FieldTooltipProps {
  text: string;
  /** id de um termo de lib/glossario.ts; mostra o link "Ver no glossário" (LING-07 AC2). */
  termo?: string;
}

/** Ajuda de campo: botão que abre um popover por clique, toque ou Enter/Espaço (UXA-01). */
export function FieldTooltip({ text, termo }: FieldTooltipProps) {
  const [aberto, setAberto] = useState(false);

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={text}
          className="ml-1 inline-flex size-6 -m-1 cursor-help items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="inline-flex h-4 w-4 select-none items-center justify-center rounded-full border border-muted-foreground/40 bg-muted text-[10px] font-semibold leading-none text-muted-foreground">
            i
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm">
        {text}
        {termo && (
          <>
            {" "}
            <Link href={`/app/glossario#${termo}`} className="font-medium underline underline-offset-2">
              Ver no glossário
            </Link>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
