"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

interface FanChartProps {
  series: Record<string, number[]>;
  dias_simulados: number;
  /** Unidade do eixo de preço, ex.: "¢/lb" (vem de unidadeAtivo). */
  unidade?: string;
}

const eixo = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Leque de preços: faixa de 90% (P5–P95), faixa de 60% (P20–P80) e mediana. */
export default function FanChart({ series, dias_simulados, unidade }: FanChartProps) {
  const data = Array.from({ length: dias_simulados }, (_, i) => ({
    dia: i + 1,
    faixa90: [series.p5?.[i], series.p95?.[i]],
    faixa60: [series.p20?.[i], series.p80?.[i]],
    p50: series.p50?.[i],
  }));
  const ultimo = dias_simulados - 1;
  const resumo = `Leque de preços em ${dias_simulados} dias. Mediana final ${formatNumber(series.p50?.[ultimo], 2)}${unidade ? ` ${unidade}` : ""}; faixa de 90% entre ${formatNumber(series.p5?.[ultimo], 2)} e ${formatNumber(series.p95?.[ultimo], 2)}.`;
  const rotuloEixo = unidade ? `Preço (${unidade})` : "Preço";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div role="img" aria-label={resumo}>
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="dia"
            tick={eixo}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            label={{ value: "Dias", position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            tick={eixo}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatNumber(v, 2)}
            label={{ value: rotuloEixo, angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            labelFormatter={(d) => `Dia ${d}`}
            formatter={(v: number | number[], nome: string) => [
              Array.isArray(v) ? `${formatNumber(v[0], 2)} a ${formatNumber(v[1], 2)}` : formatNumber(v, 2),
              nome,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            dataKey="faixa90"
            name="90% dos cenários"
            fill="var(--chart-1)"
            fillOpacity={0.15}
            stroke="none"
            isAnimationActive={false}
          />
          <Area
            dataKey="faixa60"
            name="60% dos cenários"
            fill="var(--chart-1)"
            fillOpacity={0.3}
            stroke="none"
            isAnimationActive={false}
          />
          <Line dataKey="p50" name="Mediana" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground underline underline-offset-2">Ver dados em tabela</summary>
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-xs tabular-nums">
            <caption className="sr-only">Percentis por dia da simulação{unidade ? ` (${unidade})` : ""}</caption>
            <thead className="sticky top-0 bg-card text-left">
              <tr>
                <th scope="col" className="px-2 py-1 font-medium">Dia</th>
                <th scope="col" className="px-2 py-1 font-medium">P5</th>
                <th scope="col" className="px-2 py-1 font-medium">P20</th>
                <th scope="col" className="px-2 py-1 font-medium">Mediana</th>
                <th scope="col" className="px-2 py-1 font-medium">P80</th>
                <th scope="col" className="px-2 py-1 font-medium">P95</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.dia} className="border-t border-border">
                  <td className="px-2 py-1">{d.dia}</td>
                  <td className="px-2 py-1">{formatNumber(series.p5?.[d.dia - 1], 2)}</td>
                  <td className="px-2 py-1">{formatNumber(series.p20?.[d.dia - 1], 2)}</td>
                  <td className="px-2 py-1">{formatNumber(series.p50?.[d.dia - 1], 2)}</td>
                  <td className="px-2 py-1">{formatNumber(series.p80?.[d.dia - 1], 2)}</td>
                  <td className="px-2 py-1">{formatNumber(series.p95?.[d.dia - 1], 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
