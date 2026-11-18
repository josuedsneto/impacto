"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { gerarCsv, nomeArquivo } from "@/lib/csv";
import { TickerSelect } from "@/components/market/TickerSelect";
import { TickerSuggestForm } from "@/components/market/TickerSuggestForm";
import { PriceChart } from "@/components/market/PriceChart";
import { IndicatorSelector, DEFAULT_CONFIG, type IndicatorConfig } from "@/components/market/IndicatorSelector";
import { FixacoesChart, type OhlcvRow, type AnalysisSignal } from "@/components/market/FixacoesChart";

type Aba = "precos" | "indicadores" | "sinais";
const ABAS: Aba[] = ["precos", "indicadores", "sinais"];

// Nomes das colunas do CSV; indicadores sem nome aqui (sma_20, ema_9…) usam o próprio código.
const COLUNAS_CSV: Record<string, string> = {
  date: "Data", open: "Abertura", high: "Máxima", low: "Mínima", close: "Fechamento", volume: "Volume",
  bb_upper: "Bollinger superior", bb_mid: "Bollinger média", bb_lower: "Bollinger inferior",
  rsi: "RSI", macd: "MACD", macd_signal: "MACD sinal", macd_hist: "MACD histograma",
  stoch_k: "Estocástico %K", stoch_d: "Estocástico %D", cci: "CCI",
};

interface PriceRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

function datasPadrao(dias: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(Date.now() - dias * 864e5);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function AbaPrecos() {
  const [ticker, setTicker] = useState("SB=F");
  const [{ start, end }, setPeriodo] = useState(() => datasPadrao(30));
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [queriedTicker, setQueriedTicker] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams({ ticker, start, end });
      const data = await apiFetch<{ ticker: string; rows: PriceRow[] }>(`/api/market/prices?${params}`);
      setRows(data.rows);
      setQueriedTicker(data.ticker);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Consultar preços</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleQuery} className="mb-6 flex flex-wrap items-end gap-4">
            <TickerSelect value={ticker} onChange={setTicker} disabled={loading} />
            <div className="space-y-1">
              <Label htmlFor="q-start">De</Label>
              <Input
                id="q-start"
                type="date"
                value={start}
                onChange={(e) => setPeriodo((p) => ({ ...p, start: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="q-end">Até</Label>
              <Input
                id="q-end"
                type="date"
                value={end}
                onChange={(e) => setPeriodo((p) => ({ ...p, end: e.target.value }))}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Consultando..." : "Consultar"}
            </Button>
          </form>

          {queriedTicker && <PriceChart ticker={queriedTicker} rows={rows} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sugerir novo ticker</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Sugira um ativo pelo código do Yahoo Finance. O administrador revisa antes de ele entrar no catálogo;
            códigos sem dados são recusados na hora.
          </p>
          <TickerSuggestForm />
        </CardContent>
      </Card>
    </div>
  );
}

function AbasAnalise({ aba }: { aba: "indicadores" | "sinais" }) {
  const [ticker, setTicker] = useState("SB=F");
  const [{ start, end }, setPeriodo] = useState(() => datasPadrao(365));
  const [config, setConfig] = useState<IndicatorConfig>(DEFAULT_CONFIG);
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OhlcvRow[]>([]);
  const [signals, setSignals] = useState<AnalysisSignal[]>([]);
  const [queriedTicker, setQueriedTicker] = useState("");

  const handleAnalyze = useCallback(async () => {
    if (!ticker.trim()) {
      toast.error("Informe o ativo.");
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

  const exportar = (
    <BotaoExportar
      arquivo={nomeArquivo("Mercado e sinais", queriedTicker)}
      montar={
        queriedTicker && rows.length
          ? () => {
              const chaves = Object.keys(rows[0]);
              return gerarCsv({
                parametros: [
                  ["Ativo", queriedTicker],
                  ["De", formatDate(start)],
                  ["Até", formatDate(end)],
                  ["Indicadores", config.indicators.join(", ")],
                ],
                tabelas: [
                  { colunas: chaves.map((k) => COLUNAS_CSV[k] ?? k), linhas: rows.map((r) => chaves.map((k) => r[k])) },
                  {
                    colunas: ["Data", "Sinal", "Indicador", "Preço"],
                    linhas: signals.map((s) => [s.date, s.type === "buy" ? "entrada" : "saída", s.indicator, s.price]),
                  },
                ],
              });
            }
          : null
      }
    />
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <TickerSelect value={ticker} onChange={setTicker} disabled={loading} />
            <div className="space-y-1">
              <Label>De</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setPeriodo((p) => ({ ...p, start: e.target.value }))}
                disabled={loading}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setPeriodo((p) => ({ ...p, end: e.target.value }))}
                disabled={loading}
                className="w-40"
              />
            </div>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analisando..." : "Analisar"}
            </Button>
          </div>

          <IndicatorSelector config={config} onChange={setConfig} disabled={loading} />

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Gráfico:</Label>
            {(["candlestick", "line"] as const).map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => setChartType(ct)}
                className={`rounded border px-3 py-1 text-sm transition-colors ${
                  chartType === ct
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary"
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

      {queriedTicker && aba === "indicadores" && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <span>{queriedTicker} · {formatDate(start)} a {formatDate(end)}</span>
              <span className="ml-auto">{exportar}</span>
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

      {queriedTicker && aba === "sinais" && (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3">
              <span>Sinais · {queriedTicker}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {buyCount} entr{buyCount === 1 ? "ada" : "adas"} · {sellCount} saíd{sellCount === 1 ? "a" : "as"}
              </span>
              <span className="ml-auto">{exportar}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
              Sinais técnicos automáticos, não são recomendação de operação.
            </p>
            {signals.length === 0 ? (
              <EmptyState mensagem="Nenhum sinal no período escolhido." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Data</th>
                      <th className="px-3 py-2 text-left font-medium">Sinal</th>
                      <th className="px-3 py-2 text-left font-medium">Indicador</th>
                      <th className="px-3 py-2 text-right font-medium">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s, i) => (
                      <tr key={`${s.date}-${s.indicator}-${i}`} className="border-b border-border last:border-b-0">
                        <td className="px-3 py-2">{formatDate(s.date)}</td>
                        <td className="px-3 py-2">{s.type === "buy" ? "Entrada" : "Saída"}</td>
                        <td className="px-3 py-2">{s.indicator}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{s.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MercadoConteudo() {
  const router = useRouter();
  const params = useSearchParams();
  const abaUrl = params?.get("aba") ?? "";
  const aba: Aba = ABAS.includes(abaUrl as Aba) ? (abaUrl as Aba) : "precos";

  function trocarAba(v: string) {
    router.replace(`/app/mercado?aba=${v}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Mercado"
        descricao="Preços diários, indicadores técnicos e sinais de entrada e saída de um mesmo ativo."
      />
      {/* Conteúdo fica montado e só é escondido: a análise feita em Indicadores continua disponível em Sinais. */}
      <Tabs value={aba} onValueChange={trocarAba}>
        <TabsList>
          <TabsTrigger value="precos">Preços</TabsTrigger>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="sinais">Sinais</TabsTrigger>
        </TabsList>
      </Tabs>
      <div hidden={aba !== "precos"}>
        <AbaPrecos />
      </div>
      <div hidden={aba === "precos"}>
        <AbasAnalise aba={aba === "sinais" ? "sinais" : "indicadores"} />
      </div>
    </div>
  );
}

export default function MercadoPage() {
  return (
    <Suspense fallback={null}>
      <MercadoConteudo />
    </Suspense>
  );
}
