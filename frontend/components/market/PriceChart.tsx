"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PriceRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

interface PriceChartProps {
  ticker: string;
  rows: PriceRow[];
}

function fmt(v: number | null, decimals = 4) {
  if (v === null) return "—";
  return v.toFixed(decimals);
}

export function PriceChart({ ticker, rows }: PriceChartProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum dado encontrado para <strong>{ticker}</strong>.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Abertura</TableHead>
            <TableHead className="text-right">Máximo</TableHead>
            <TableHead className="text-right">Mínimo</TableHead>
            <TableHead className="text-right">Fechamento</TableHead>
            <TableHead className="text-right">Volume</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.date}>
              <TableCell>{r.date}</TableCell>
              <TableCell className="text-right">{fmt(r.open)}</TableCell>
              <TableCell className="text-right">{fmt(r.high)}</TableCell>
              <TableCell className="text-right">{fmt(r.low)}</TableCell>
              <TableCell className="text-right">{fmt(r.close)}</TableCell>
              <TableCell className="text-right">
                {r.volume !== null ? r.volume.toLocaleString("pt-BR") : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
