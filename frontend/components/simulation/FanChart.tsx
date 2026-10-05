"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

interface FanChartProps {
  series: Record<string, number[]>;
  dias_simulados: number;
}

const eixo = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Leque de preços: faixa de 90% (P5–P95), faixa de 60% (P20–P80) e mediana. */
export default function FanChart({ series, dias_simulados }: FanChartProps) {
  const data = Array.from({ length: dias_simulados }, (_, i) => ({
    dia: i + 1,
    faixa90: [series.p5?.[i], series.p95?.[i]],
    faixa60: [series.p20?.[i], series.p80?.[i]],
    p50: series.p50?.[i],
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="dia" tick={eixo} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis
            tick={eixo}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatNumber(v, 2)}
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
  );
}
