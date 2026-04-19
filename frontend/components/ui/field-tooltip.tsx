"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FieldTooltipProps {
  text: string;
}

export function FieldTooltip({ text }: FieldTooltipProps) {
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
      </TooltipContent>
    </Tooltip>
  );
}
