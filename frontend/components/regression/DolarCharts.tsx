"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { DolarResult } from "./DolarForm";

interface DolarChartsProps {
  result: DolarResult;
}

export function CoeficientesChart({ result }: DolarChartsProps) {
  const data = Object.entries(result.coeficientes).map(([variavel, valor]) => ({ variavel, valor }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Coeficientes do modelo</h3>
      <div role="img" aria-label="Coeficientes do modelo de regressão do dólar.">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 40 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="variavel"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) => formatNumber(v, 2)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [formatNumber(v, 6), "Coeficiente"]}
          />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar dataKey="valor" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.variavel} fill={d.valor >= 0 ? "var(--chart-1)" : "var(--negative)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
