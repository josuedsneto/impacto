"use client";

import { useMemo } from "react";
import { formatCents, formatDate, formatFX, formatPercent } from "@/lib/format";
import type { PriceRow } from "@/lib/types/api";
import { cn } from "@/lib/utils";

interface PriceCardProps {
  label: string;
  exchange: string; // ex.: "ICE Futures · SB=F"
  tipo: "cents" | "fx";
  rows: PriceRow[];
}

export function PriceCard({ label, exchange, tipo, rows }: PriceCardProps) {
  const valid = useMemo(() => rows.filter((r) => r.close !== null), [rows]);
  const fmt = tipo === "fx" ? formatFX : formatCents;
  const latest = valid.at(-1);
  const prev = valid.at(-2);
  const change = latest && prev?.close ? (latest.close! - prev.close) / prev.close : null;

  const closes = valid.map((r) => r.close!);
  const max12m = closes.length ? Math.max(...closes) : null;
  const min12m = closes.length ? Math.min(...closes) : null;
  const isUp = change !== null && change >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.5px] text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{exchange}</p>
        </div>
        {change !== null && (
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-bold tabular-nums",
              isUp ? "bg-positive/10 text-positive" : "bg-negative/10 text-negative"
            )}
          >
            {isUp ? "+" : ""}
            {formatPercent(change)}
          </span>
        )}
      </div>

      <p className="text-3xl font-bold leading-none tabular-nums">{fmt(latest?.close)}</p>

      {latest && (
        <p className="mt-1 text-xs text-muted-foreground">Fechamento de {formatDate(latest.date)}</p>
      )}

      {max12m !== null && (
        <p className="mt-1 text-xs text-muted-foreground">
          Máx 12m: {fmt(max12m)} · Mín 12m: {fmt(min12m)}
        </p>
      )}

    </div>
  );
}
