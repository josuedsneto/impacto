"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { DolarResult } from "./DolarForm";

interface DolarChartsProps {
  result: DolarResult;
}

// Escala divergente: azul para correlação positiva, vermelho para negativa; intensidade pelo módulo.
function corCelula(v: number): React.CSSProperties {
  const cor = v >= 0 ? "var(--chart-1)" : "var(--negative)";
  return { background: `color-mix(in oklab, ${cor} ${Math.round(Math.abs(v) * 60)}%, transparent)` };
}

export function CorrelationHeatmap({ result }: DolarChartsProps) {
  const labels = Object.keys(result.correlacao);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Matriz de correlação</h3>
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th />
              {labels.map((l) => (
                <th key={l} className="px-2 py-1 text-center font-normal text-muted-foreground">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {labels.map((row) => (
              <tr key={row}>
                <th className="px-2 py-1 text-left font-medium text-muted-foreground">{row}</th>
                {labels.map((col) => {
                  const v = result.correlacao[row][col] ?? 0;
                  return (
                    <td key={col} className="min-w-[64px] px-2 py-1 text-center tabular-nums text-foreground" style={corCelula(v)}>
                      {formatNumber(v, 2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Azul: andam juntos. Vermelho: andam em sentidos opostos.</p>
    </div>
  );
}

export function CoeficientesChart({ result }: DolarChartsProps) {
  const data = Object.entries(result.coeficientes).map(([variavel, valor]) => ({ variavel, valor }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Coeficientes do modelo</h3>
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
  );
}
