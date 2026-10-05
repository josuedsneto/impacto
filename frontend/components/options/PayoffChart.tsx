"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";

interface PayoffChartProps {
  prices: number[];
  payoff: number[];
}

const eixo = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Resultado da estratégia no vencimento para cada preço do ativo. */
export default function PayoffChart({ prices, payoff }: PayoffChartProps) {
  const data = prices.map((preco, i) => ({ preco, payoff: payoff[i] }));

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="preco"
            type="number"
            domain={["dataMin", "dataMax"]}
            tick={eixo}
            tickLine={false}
            tickFormatter={(v: number) => formatNumber(v, 2)}
            label={{ value: "Preço do ativo no vencimento", position: "insideBottom", offset: -16, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis tick={eixo} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatNumber(v, 2)} />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(v: number) => `Preço ${formatNumber(v, 2)}`}
            formatter={(v: number) => [formatNumber(v, 4), "Resultado"]}
          />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="payoff" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
