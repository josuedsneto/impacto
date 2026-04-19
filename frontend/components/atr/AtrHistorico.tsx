"use client";

import dynamic from "next/dynamic";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export interface HistoricoItem {
  id: string;
  chuva_mm: number;
  impureza_pct: number;
  atr_min: number;
  atr_esperado: number;
  atr_max: number;
  producao_total: number | null;
  compartilhado: boolean;
  user_id: string;
  created_at: string;
}

interface AtrHistoricoProps {
  historico: HistoricoItem[];
  onToggleShare: (id: string, compartilhado: boolean) => void;
  currentUserId: string;
}

export function AtrHistorico({ historico, onToggleShare, currentUserId }: AtrHistoricoProps) {
  const datas = historico.map((h) => new Date(h.created_at).toLocaleDateString("pt-BR"));

  return (
    <div className="space-y-6">
      {/* Trend chart */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Tendência ATR (kg/tc)</h3>
        <Plot
          data={[
            {
              type: "scatter",
              mode: "lines",
              x: datas,
              y: historico.map((h) => h.atr_min),
              name: "ATR Mínimo",
              line: { color: "rgba(99,102,241,0.3)", width: 0 },
              showlegend: false,
            },
            {
              type: "scatter",
              mode: "lines",
              x: datas,
              y: historico.map((h) => h.atr_max),
              name: "Intervalo Min–Max",
              fill: "tonexty",
              fillcolor: "rgba(99,102,241,0.15)",
              line: { color: "rgba(99,102,241,0.3)", width: 0 },
            },
            {
              type: "scatter",
              mode: "lines+markers",
              x: datas,
              y: historico.map((h) => h.atr_esperado),
              name: "ATR Esperado",
              line: { color: "#6366f1", width: 2 },
              marker: { size: 6, color: "#6366f1" },
            },
          ]}
          layout={{
            title: { text: "Tendência ATR (kg/tc)" },
            xaxis: { title: { text: "Data" } },
            yaxis: { title: { text: "ATR (kg/tc)" } },
            height: 300,
            margin: { t: 50, l: 60, r: 20, b: 60 },
          }}
          style={{ width: "100%" }}
          config={{ responsive: true, displayModeBar: false }}
        />
      </div>

      {/* History table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Chuva (mm)</TableHead>
              <TableHead>Impureza (%)</TableHead>
              <TableHead>ATR Esperado</TableHead>
              <TableHead>Produção Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historico.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">
                  {new Date(item.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-sm">{item.chuva_mm.toFixed(1)}</TableCell>
                <TableCell className="text-sm">{item.impureza_pct.toFixed(1)}</TableCell>
                <TableCell className="text-sm font-medium">{item.atr_esperado.toFixed(1)} kg/tc</TableCell>
                <TableCell className="text-sm">
                  {item.producao_total != null
                    ? `${(item.producao_total / 1000).toFixed(0)} mil t`
                    : "—"}
                </TableCell>
                <TableCell>
                  {item.compartilhado && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      Compartilhado
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {item.user_id === currentUserId && (
                    <button
                      onClick={() => onToggleShare(item.id, !item.compartilhado)}
                      className="px-3 py-1 rounded text-xs font-medium border border-input bg-background hover:bg-muted"
                    >
                      {item.compartilhado ? "Privado" : "Compartilhar"}
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
