"use client";

import dynamic from "next/dynamic";
import { DolarResult } from "./DolarForm";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface DolarChartsProps {
  result: DolarResult;
}

export function CorrelationHeatmap({ result }: DolarChartsProps) {
  const labels = Object.keys(result.correlacao);
  const z = labels.map((row) => labels.map((col) => result.correlacao[row][col] ?? 0));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Matriz de Correlação</h3>
      <Plot
        data={[
          {
            type: "heatmap",
            x: labels,
            y: labels,
            z,
            colorscale: "RdBu",
            zmin: -1,
            zmax: 1,
            reversescale: true,
          },
        ]}
        layout={{
          title: { text: "Matriz de Correlação" },
          height: 400,
          margin: { t: 40, l: 100, r: 20, b: 100 },
          xaxis: { tickangle: -45 },
        }}
        style={{ width: "100%" }}
        config={{ responsive: true, displayModeBar: false }}
      />
    </div>
  );
}

export function CoeficientesChart({ result }: DolarChartsProps) {
  const variables = Object.keys(result.coeficientes);
  const values = Object.values(result.coeficientes);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Coeficientes do Modelo OLS</h3>
      <Plot
        data={[
          {
            type: "bar",
            x: variables,
            y: values,
            marker: {
              color: values.map((v) => (v >= 0 ? "#3b82f6" : "#ef4444")),
            },
          },
        ]}
        layout={{
          title: { text: "Coeficientes do Modelo OLS" },
          height: 350,
          margin: { t: 40, l: 60, r: 20, b: 80 },
          xaxis: { tickangle: -30 },
          yaxis: { title: { text: "Valor" } },
        }}
        style={{ width: "100%" }}
        config={{ responsive: true, displayModeBar: false }}
      />
    </div>
  );
}
