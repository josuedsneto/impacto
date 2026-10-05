"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { TickerSelect } from "@/components/market/TickerSelect";
import { IndicatorSelector, DEFAULT_CONFIG, type IndicatorConfig } from "@/components/market/IndicatorSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import { FixacoesChart, type OhlcvRow, type AnalysisSignal } from "@/components/market/FixacoesChart";

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function FixacoesPage() {
  const { start: defaultStart, end: defaultEnd } = defaultDateRange();

  const [ticker, setTicker] = useState("SB=F");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [config, setConfig] = useState<IndicatorConfig>(DEFAULT_CONFIG);
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OhlcvRow[]>([]);
  const [signals, setSignals] = useState<AnalysisSignal[]>([]);
  const [queriedTicker, setQueriedTicker] = useState("");

  const handleAnalyze = useCallback(async () => {
    if (!ticker.trim()) {
      toast.error("Informe o ticker.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ticker: ticker.trim().toUpperCase(),
        start,
        end,
        indicators: config.indicators.join(","),
        rsi_period: String(config.rsiPeriod),
        bb_window: String(config.bbWindow),
        bb_std: String(config.bbStd),
        macd_fast: String(config.macdFast),
        macd_slow: String(config.macdSlow),
        macd_signal: String(config.macdSignal),
        stoch_k: String(config.stochK),
        stoch_d: String(config.stochD),
        cci_period: String(config.cciPeriod),
        sma_periods: config.smaPeriods.join(","),
        ema_periods: config.emaPeriods.join(","),
      });

      const data = await apiFetch<{ ticker: string; rows: OhlcvRow[]; signals: AnalysisSignal[] }>(
        `/api/market/analysis?${params}`
      );
      if (data.rows.length === 0) {
        toast.warning(`Nenhum dado encontrado para ${ticker.toUpperCase()} no período.`);
      }
      setRows(data.rows);
      setSignals(data.signals);
      setQueriedTicker(data.ticker);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ticker, start, end, config]);

  const buyCount = signals.filter((s) => s.type === "buy").length;
  const sellCount = signals.filter((s) => s.type === "sell").length;

  return (
    <div>
      <PageHeader
        titulo="Fixações"
        descricao="Preços, indicadores técnicos e sinais de entrada e saída para planejar fixações."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Ticker + dates + button */}
          <div className="flex flex-wrap gap-4 items-end">
            <TickerSelect value={ticker} onChange={setTicker} disabled={loading} />
            <div className="space-y-1">
              <Label>De</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={loading}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={loading}
                className="w-40"
              />
            </div>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analisando..." : "Analisar"}
            </Button>
          </div>

          {/* Indicators */}
          <IndicatorSelector config={config} onChange={setConfig} disabled={loading} />

          {/* Chart type toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Gráfico:</Label>
            {(["candlestick", "line"] as const).map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => setChartType(ct)}
                className={`px-3 py-1 rounded text-sm border transition-colors ${
                  chartType === ct
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary"
                }`}
              >
                {ct === "candlestick" ? "Candlestick" : "Linha"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!queriedTicker && (
        <EmptyState mensagem="Escolha o ativo, o período e os indicadores, e clique em Analisar." />
      )}

      {queriedTicker && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 flex-wrap">
              <span>{queriedTicker} · {formatDate(start)} a {formatDate(end)}</span>
              {signals.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {buyCount} entr{buyCount === 1 ? "ada" : "adas"} ·{" "}
                  {sellCount} saíd{sellCount === 1 ? "a" : "as"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FixacoesChart
              rows={rows}
              signals={signals}
              selectedIndicators={config.indicators}
              smaPeriods={config.smaPeriods}
              emaPeriods={config.emaPeriods}
              chartType={chartType}
            />
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
