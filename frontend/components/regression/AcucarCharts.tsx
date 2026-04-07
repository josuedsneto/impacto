"use client";

import dynamic from "next/dynamic";
import { AcucarResult } from "./AcucarForm";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface AcucarChartsProps {
  result: AcucarResult;
}

export function AcucarHistoricoChart({ result }: AcucarChartsProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">SB=F: Real vs Previsto (Anual)</h3>
      <Plot
        data={[
          {
            type: "scatter",
            mode: "lines+markers",
            x: result.historico.map((h) => h.year),
            y: result.historico.map((h) => h.sb_f_real),
            name: "Real",
          },
          {
            type: "scatter",
            mode: "lines+markers",
            x: result.historico.map((h) => h.year),
            y: result.historico.map((h) => h.sb_f_previsto),
            name: "Previsto",
            line: { dash: "dash" },
          },
        ]}
        layout={{
          title: { text: "SB=F: Real vs Previsto (Anual)" },
          xaxis: { title: { text: "Ano" } },
          yaxis: { title: { text: "Preço (¢/lb)" } },
          height: 400,
          margin: { t: 50, l: 60, r: 20, b: 60 },
        }}
        style={{ width: "100%" }}
        config={{ responsive: true, displayModeBar: false }}
      />
    </div>
  );
}
