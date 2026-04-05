"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FanChartProps {
  series: Record<string, number[]>;
  dias_simulados: number;
}

export default function FanChart({ series, dias_simulados }: FanChartProps) {
  const data = Array.from({ length: dias_simulados }, (_, i) => ({
    dia: i + 1,
    p5: series.p5?.[i],
    p20: series.p20?.[i],
    p50: series.p50?.[i],
    p80: series.p80?.[i],
    p95: series.p95?.[i],
  }));

  return (
    <div className="h-[260px] md:h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
        <XAxis
          dataKey="dia"
          label={{ value: "Dias", position: "insideBottomRight", offset: -10 }}
        />
        <YAxis />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="p95"
          fill="#93c5fd"
          fillOpacity={0.3}
          stroke="#3b82f6"
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p80"
          fill="#bfdbfe"
          fillOpacity={0.3}
          stroke="none"
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p50"
          fill="none"
          stroke="#1d4ed8"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p20"
          fill="#bfdbfe"
          fillOpacity={0.3}
          stroke="none"
          dot={false}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p5"
          fill="#93c5fd"
          fillOpacity={0.3}
          stroke="#3b82f6"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
    </div>
  );
}
