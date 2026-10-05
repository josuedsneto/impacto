"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/format";

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

const eixo = { fontSize: 11, fill: "var(--muted-foreground)" };
const kg = (v: number) => `${formatNumber(v, 1)} kg/t`;

export function AtrHistorico({ historico, onToggleShare, currentUserId }: AtrHistoricoProps) {
  // A API devolve do mais recente para o mais antigo; o gráfico corre no tempo.
  const serie = [...historico].reverse().map((h) => ({
    data: formatDate(h.created_at),
    faixa: [h.atr_min, h.atr_max],
    esperado: h.atr_esperado,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Tendência do ATR (kg/t de cana)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={serie} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="data" tick={eixo} tickLine={false} minTickGap={24} />
            <YAxis tick={eixo} tickLine={false} axisLine={false} width={48} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number | number[], nome: string) => [
                Array.isArray(v) ? `${kg(v[0])} a ${kg(v[1])}` : kg(v),
                nome,
              ]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area dataKey="faixa" name="Faixa de 90%" fill="var(--chart-3)" fillOpacity={0.2} stroke="none" isAnimationActive={false} />
            <Line dataKey="esperado" name="ATR esperado" stroke="var(--chart-3)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Chuva (mm)</TableHead>
              <TableHead className="text-right">Impureza (%)</TableHead>
              <TableHead className="text-right">ATR esperado</TableHead>
              <TableHead className="text-right">Produção total</TableHead>
              <TableHead>Visibilidade</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {historico.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="text-sm">{formatDate(item.created_at)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatNumber(item.chuva_mm, 1)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatNumber(item.impureza_pct, 1)}</TableCell>
                <TableCell className="text-right text-sm font-medium tabular-nums">{kg(item.atr_esperado)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {item.producao_total != null ? `${formatNumber(item.producao_total / 1000, 0)} mil t` : "—"}
                </TableCell>
                <TableCell>
                  {item.compartilhado && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">Compartilhada</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.user_id === currentUserId && (
                    <button
                      onClick={() => onToggleShare(item.id, !item.compartilhado)}
                      className="rounded border border-input bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
                    >
                      {item.compartilhado ? "Tornar privada" : "Compartilhar"}
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
