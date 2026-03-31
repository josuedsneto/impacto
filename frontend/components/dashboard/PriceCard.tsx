"use client";

import { useMemo } from "react";

interface PriceRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

interface PriceCardProps {
  label: string;
  exchange: string;   // e.g. "ICE Futures · SB=F"
  unit: string;
  rows: PriceRow[];
  barColor: string;   // e.g. "#d97706"
}

function MiniBarChart({ rows, barColor }: { rows: PriceRow[]; barColor: string }) {
  const valid = rows.filter((r) => r.close !== null).slice(-90);
  if (valid.length === 0) return null;

  const closes = valid.map((r) => r.close!);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-[3px] mt-4" style={{ height: 48 }}>
      {valid.map((r, i) => {
        const heightPct = ((r.close! - min) / range) * 100;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${Math.max(heightPct, 4)}%`,
              background: barColor,
              opacity: 0.7 + (i / valid.length) * 0.3,
            }}
          />
        );
      })}
    </div>
  );
}

export function PriceCard({ label, exchange, unit, rows, barColor }: PriceCardProps) {
  const valid = useMemo(() => rows.filter((r) => r.close !== null), [rows]);
  const latest = valid.at(-1);
  const prev = valid.at(-2);
  const change =
    latest && prev && prev.close
      ? ((latest.close! - prev.close!) / prev.close!) * 100
      : null;

  const allCloses = valid.map((r) => r.close!);
  const max12m = allCloses.length ? Math.max(...allCloses) : null;
  const min12m = allCloses.length ? Math.min(...allCloses) : null;

  const isUp = change !== null && change >= 0;

  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: "#fff", border: "1px solid #e5e7eb" }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p
            className="font-semibold tracking-[0.5px]"
            style={{ color: "#6b7280", fontSize: 12 }}
          >
            {label}
          </p>
          <p style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>
            {exchange}
          </p>
        </div>
        {change !== null && (
          <span
            className="font-bold rounded-md px-2.5 py-1"
            style={{
              fontSize: 12,
              background: isUp ? "#f0fdf4" : "#fef2f2",
              color: isUp ? "#15803d" : "#b91c1c",
            }}
          >
            {isUp ? "+" : ""}
            {change.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Price */}
      <p
        className="font-bold leading-none"
        style={{ fontSize: 32, color: "#111827", fontVariantNumeric: "tabular-nums" }}
      >
        {latest?.close?.toFixed(2) ?? "—"}
        <span
          className="font-normal ml-1"
          style={{ fontSize: 15, color: "#9ca3af" }}
        >
          {unit}
        </span>
      </p>

      {/* Range */}
      {max12m !== null && min12m !== null && (
        <p className="mt-1" style={{ fontSize: 12, color: "#9ca3af" }}>
          Máx 12m: {max12m.toFixed(2)} · Mín 12m: {min12m.toFixed(2)}
        </p>
      )}

      {/* Bar chart */}
      <MiniBarChart rows={valid} barColor={barColor} />
    </div>
  );
}
