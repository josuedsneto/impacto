"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// react-plotly.js requires dynamic import (no SSR) — Plotly uses window
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export interface OhlcvRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  bb_upper?: number | null;
  bb_mid?: number | null;
  bb_lower?: number | null;
  rsi?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  stoch_k?: number | null;
  stoch_d?: number | null;
  cci?: number | null;
  [key: string]: number | string | null | undefined;
}

export interface AnalysisSignal {
  date: string;
  type: "buy" | "sell";
  indicator: string;
  price: number;
}

interface Props {
  rows: OhlcvRow[];
  signals: AnalysisSignal[];
  selectedIndicators: string[];
  smaPeriods: number[];
  emaPeriods: number[];
  chartType: "candlestick" | "line";
}

const SMA_COLORS = ["#94a3b8", "#64748b", "#475569"];
const EMA_COLORS = ["#38bdf8", "#0ea5e9"];

const INDICATOR_COLORS: Record<string, string> = {
  bollinger: "#f59e0b",
  rsi: "#8b5cf6",
  macd: "#3b82f6",
  stoch: "#10b981",
  cci: "#f43f5e",
};

export function FixacoesChart({
  rows,
  signals,
  selectedIndicators,
  smaPeriods,
  emaPeriods,
  chartType,
}: Props) {
  const oscillators = selectedIndicators.filter((i) =>
    ["rsi", "macd", "stoch", "cci"].includes(i)
  );
  const totalRows = 1 + oscillators.length;
  const dates = rows.map((r) => r.date);

  const traces = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t: any[] = [];

    // ── Price trace ──────────────────────────────────────────────────────
    if (chartType === "candlestick") {
      t.push({
        type: "candlestick",
        x: dates,
        open: rows.map((r) => r.open),
        high: rows.map((r) => r.high),
        low: rows.map((r) => r.low),
        close: rows.map((r) => r.close),
        name: "Preço",
        xaxis: "x",
        yaxis: "y",
        increasing: { line: { color: "#22c55e" } },
        decreasing: { line: { color: "#ef4444" } },
      });
    } else {
      t.push({
        type: "scatter",
        mode: "lines",
        x: dates,
        y: rows.map((r) => r.close),
        name: "Preço",
        line: { color: "#3b82f6", width: 1.5 },
        xaxis: "x",
        yaxis: "y",
      });
    }

    // ── Bollinger Bands (overlays) ───────────────────────────────────────
    if (selectedIndicators.includes("bollinger")) {
      const c = INDICATOR_COLORS.bollinger;
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r.bb_upper),
        name: "BB Superior", line: { color: c, width: 1, dash: "dot" },
        xaxis: "x", yaxis: "y",
      });
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r.bb_mid),
        name: "BB Média", line: { color: c, width: 1 },
        xaxis: "x", yaxis: "y",
      });
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r.bb_lower),
        name: "BB Inferior", line: { color: c, width: 1, dash: "dot" },
        fill: "tonexty", fillcolor: `${c}18`,
        xaxis: "x", yaxis: "y",
      });
    }

    // ── SMAs ─────────────────────────────────────────────────────────────
    smaPeriods.forEach((period, i) => {
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r[`sma_${period}`]),
        name: `SMA ${period}`,
        line: { color: SMA_COLORS[i % SMA_COLORS.length], width: 1.2 },
        xaxis: "x", yaxis: "y",
      });
    });

    // ── EMAs ─────────────────────────────────────────────────────────────
    emaPeriods.forEach((period, i) => {
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r[`ema_${period}`]),
        name: `EMA ${period}`,
        line: { color: EMA_COLORS[i % EMA_COLORS.length], width: 1.2 },
        xaxis: "x", yaxis: "y",
      });
    });

    // ── Buy/Sell signal markers on price row ─────────────────────────────
    const buySignals = signals.filter((s) => s.type === "buy");
    const sellSignals = signals.filter((s) => s.type === "sell");

    if (buySignals.length > 0) {
      t.push({
        type: "scatter", mode: "markers",
        x: buySignals.map((s) => s.date),
        y: buySignals.map((s) => s.price),
        name: "Compra",
        marker: { symbol: "triangle-up", size: 12, color: "#22c55e" },
        customdata: buySignals.map((s) => s.indicator),
        hovertemplate: "Compra (%{customdata})<br>%{x}<br>%{y:.4f}<extra></extra>",
        xaxis: "x", yaxis: "y",
      });
    }

    if (sellSignals.length > 0) {
      t.push({
        type: "scatter", mode: "markers",
        x: sellSignals.map((s) => s.date),
        y: sellSignals.map((s) => s.price),
        name: "Venda",
        marker: { symbol: "triangle-down", size: 12, color: "#ef4444" },
        customdata: sellSignals.map((s) => s.indicator),
        hovertemplate: "Venda (%{customdata})<br>%{x}<br>%{y:.4f}<extra></extra>",
        xaxis: "x", yaxis: "y",
      });
    }

    // ── Oscillator subplots ───────────────────────────────────────────────
    oscillators.forEach((ind, i) => {
      const row = i + 2;
      const xaxis = row === 1 ? "x" : `x${row}`;
      const yaxis = row === 1 ? "y" : `y${row}`;

      if (ind === "rsi") {
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.rsi),
          name: "RSI",
          line: { color: INDICATOR_COLORS.rsi, width: 1.5 },
          xaxis, yaxis,
        });
      }

      if (ind === "macd") {
        t.push({
          type: "bar", x: dates,
          y: rows.map((r) => r.macd_hist),
          name: "MACD Hist.",
          marker: { color: rows.map((r) => ((r.macd_hist ?? 0) >= 0 ? "#22c55e" : "#ef4444")) },
          xaxis, yaxis,
        });
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.macd),
          name: "MACD",
          line: { color: INDICATOR_COLORS.macd, width: 1.5 },
          xaxis, yaxis,
        });
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.macd_signal),
          name: "Sinal MACD",
          line: { color: "#f59e0b", width: 1.5 },
          xaxis, yaxis,
        });
      }

      if (ind === "stoch") {
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.stoch_k),
          name: "%K",
          line: { color: INDICATOR_COLORS.stoch, width: 1.5 },
          xaxis, yaxis,
        });
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.stoch_d),
          name: "%D",
          line: { color: "#34d399", width: 1.5, dash: "dot" },
          xaxis, yaxis,
        });
      }

      if (ind === "cci") {
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.cci),
          name: "CCI",
          line: { color: INDICATOR_COLORS.cci, width: 1.5 },
          xaxis, yaxis,
        });
      }
    });

    return t;
  }, [rows, signals, selectedIndicators, smaPeriods, emaPeriods, chartType, dates, oscillators]);

  // Reference line shapes for oscillator panels
  const shapes = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any[] = [];
    oscillators.forEach((ind, i) => {
      const row = i + 2;
      const yref = `y${row}`;
      const base = { type: "line", xref: "paper", yref, x0: 0, x1: 1, line: { dash: "dot", width: 1, color: "#6b7280" } };
      if (ind === "rsi") {
        s.push({ ...base, y0: 70, y1: 70 });
        s.push({ ...base, y0: 30, y1: 30 });
      }
      if (ind === "stoch") {
        s.push({ ...base, y0: 80, y1: 80 });
        s.push({ ...base, y0: 20, y1: 20 });
      }
      if (ind === "cci") {
        s.push({ ...base, y0: 100, y1: 100 });
        s.push({ ...base, y0: -100, y1: -100 });
      }
    });
    return s;
  }, [oscillators]);

  const priceHeight = totalRows === 1 ? 1 : 0.55;
  const oscHeight = oscillators.length > 0 ? 0.45 / oscillators.length : 0;

  const layout = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const l: any = {
      height: 320 + oscillators.length * 200,
      margin: { t: 20, b: 40, l: 60, r: 20 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#374151", size: 11 },
      showlegend: true,
      legend: { orientation: "h", y: -0.06, font: { size: 10 } },
      shapes,
      xaxis: {
        showgrid: true,
        gridcolor: "#e5e7eb",
        rangeslider: { visible: false },
        domain: [0, 1],
      },
      yaxis: {
        showgrid: true,
        gridcolor: "#e5e7eb",
        domain: [1 - priceHeight, 1],
      },
    };

    // Build oscillator axes with stacked domains
    oscillators.forEach((ind, i) => {
      const row = i + 2;
      const top = 1 - priceHeight - i * oscHeight;
      const bottom = top - oscHeight + 0.02; // small gap between panels

      l[`xaxis${row}`] = {
        showgrid: true,
        gridcolor: "#e5e7eb",
        matches: "x",
        showticklabels: i === oscillators.length - 1,
        domain: [0, 1],
        anchor: `y${row}`,
      };
      l[`yaxis${row}`] = {
        title: { text: ind.toUpperCase(), font: { size: 10 } },
        showgrid: true,
        gridcolor: "#e5e7eb",
        domain: [Math.max(0, bottom), top - 0.01],
        anchor: `x${row}`,
      };
    });

    return l;
  }, [totalRows, oscillators, shapes, priceHeight, oscHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum dado para exibir.</p>
    );
  }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ displayModeBar: true, responsive: true, scrollZoom: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}
