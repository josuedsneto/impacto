"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";

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

// Plotly precisa da cor resolvida (não aceita var(--x)); lemos os tokens do tema ativo.
// O tema é parâmetro só para deixar explícito que as cores mudam com ele.
function lerCores(_tema: string) {  // eslint-disable-line @typescript-eslint/no-unused-vars
  const css = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
  const v = (nome: string) => css?.getPropertyValue(`--${nome}`).trim() ?? "";
  return {
    serie: [v("chart-1"), v("chart-2"), v("chart-3"), v("chart-4"), v("chart-5")],
    alta: v("positive"),
    baixa: v("negative"),
    texto: v("muted-foreground"),
    grade: v("chart-grid"),
  };
}

export function FixacoesChart({
  rows,
  signals,
  selectedIndicators,
  smaPeriods,
  emaPeriods,
  chartType,
}: Props) {
  const { theme } = useTheme();
  const cor = useMemo(() => lerCores(theme), [theme]);

  const oscillators = selectedIndicators.filter((i) =>
    ["rsi", "macd", "stoch", "cci"].includes(i)
  );
  const totalRows = 1 + oscillators.length;
  const dates = rows.map((r) => r.date);

  const traces = useMemo(() => {
    const [c1, c2, c3, c4, c5] = cor.serie;
    const SMA_COLORS = [c3, c4, c5];
    const EMA_COLORS = [c1, c2];
    const INDICATOR_COLORS: Record<string, string> = { bollinger: c4, rsi: c5, macd: c1, stoch: c3, cci: c2 };
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
        increasing: { line: { color: cor.alta } },
        decreasing: { line: { color: cor.baixa } },
      });
    } else {
      t.push({
        type: "scatter",
        mode: "lines",
        x: dates,
        y: rows.map((r) => r.close),
        name: "Preço",
        line: { color: c1, width: 1.5 },
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
        marker: { symbol: "triangle-up", size: 12, color: cor.alta },
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
        marker: { symbol: "triangle-down", size: 12, color: cor.baixa },
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
          marker: { color: rows.map((r) => ((r.macd_hist ?? 0) >= 0 ? cor.alta : cor.baixa)) },
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
          line: { color: c4, width: 1.5 },
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
          line: { color: c3, width: 1.5, dash: "dot" },
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
  }, [rows, signals, selectedIndicators, smaPeriods, emaPeriods, chartType, dates, oscillators, cor]);

  // Reference line shapes for oscillator panels
  const shapes = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any[] = [];
    oscillators.forEach((ind, i) => {
      const row = i + 2;
      const yref = `y${row}`;
      const base = { type: "line", xref: "paper", yref, x0: 0, x1: 1, line: { dash: "dot", width: 1, color: cor.texto } };
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
  }, [oscillators, cor]);

  const priceHeight = totalRows === 1 ? 1 : 0.55;
  const oscHeight = oscillators.length > 0 ? 0.45 / oscillators.length : 0;

  const layout = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const l: any = {
      height: 320 + oscillators.length * 200,
      margin: { t: 20, b: 40, l: 60, r: 20 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: cor.texto, size: 11 },
      showlegend: true,
      legend: { orientation: "h", y: -0.06, font: { size: 10 } },
      shapes,
      xaxis: {
        showgrid: true,
        gridcolor: cor.grade,
        rangeslider: { visible: false },
        domain: [0, 1],
      },
      yaxis: {
        showgrid: true,
        gridcolor: cor.grade,
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
        gridcolor: cor.grade,
        matches: "x",
        showticklabels: i === oscillators.length - 1,
        domain: [0, 1],
        anchor: `y${row}`,
      };
      l[`yaxis${row}`] = {
        title: { text: ind.toUpperCase(), font: { size: 10 } },
        showgrid: true,
        gridcolor: cor.grade,
        domain: [Math.max(0, bottom), top - 0.01],
        anchor: `x${row}`,
      };
    });

    return l;
  }, [totalRows, oscillators, shapes, priceHeight, oscHeight, cor]); // eslint-disable-line react-hooks/exhaustive-deps

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
