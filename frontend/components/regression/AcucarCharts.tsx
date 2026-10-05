"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCents, formatNumber } from "@/lib/format";
import { AcucarResult } from "./AcucarForm";

const eixo = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Preço anual real contra o previsto pelo modelo. */
export function AcucarHistoricoChart({ result }: { result: AcucarResult }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Açúcar NY: real e previsto por ano (¢/lb)</h3>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={result.historico} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="year" tick={eixo} tickLine={false} />
          <YAxis tick={eixo} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatNumber(v, 0)} />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number, nome: string) => [formatCents(v), nome]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line dataKey="sb_f_real" name="Real" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
          <Line
            dataKey="sb_f_previsto"
            name="Previsto"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
