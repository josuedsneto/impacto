"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface PayoffChartProps {
  prices: number[];
  payoff: number[];
}

export default function PayoffChart({ prices, payoff }: PayoffChartProps) {
  const data = prices.map((p, i) => ({
    preco: p.toFixed(2),
    payoff: payoff[i],
  }));

  return (
    <div className="h-[240px] md:h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
        <XAxis
          dataKey="preco"
          label={{ value: "Preço do Ativo", position: "insideBottomRight", offset: -10 }}
          tick={{ fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          label={{ value: "P&L", angle: -90, position: "insideLeft", offset: 10 }}
          tick={{ fontSize: 11 }}
        />
        <Tooltip formatter={(v: number) => v.toFixed(4)} />
        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
        <Line
          type="monotone"
          dataKey="payoff"
          stroke="#1d4ed8"
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}
