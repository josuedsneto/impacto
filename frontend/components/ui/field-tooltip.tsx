"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FieldTooltipProps {
  text: string;
  /** id de um termo de lib/glossario.ts; mostra o link "Ver no glossário" (LING-07 AC2). */
  termo?: string;
}

export function FieldTooltip({ text, termo }: FieldTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="ml-1 inline-flex h-4 w-4 cursor-help select-none items-center justify-center rounded-full border border-muted-foreground/40 bg-muted text-[10px] font-semibold leading-none text-muted-foreground"
          aria-label={text}
        >
          i
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-sm">
        {text}
        {termo && (
          <>
            {" "}
            <Link href={`/app/glossario#${termo}`} className="font-medium underline underline-offset-2">
              Ver no glossário
            </Link>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
