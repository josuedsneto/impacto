"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatNumber, formatPercent, formatPreco } from "@/lib/format";
import { Leitura } from "@/components/ui/leitura";
import { leituraVaR } from "@/lib/leitura";
import { nomeAtivo, unidadeAtivo } from "@/lib/ativos";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { BotaoSalvarAnalise } from "@/components/analises/botao-salvar-analise";
import { useReabrirAnalise } from "@/lib/reabrir-analise";
import { toast } from "sonner";

import { gerarCsv, nomeArquivo } from "@/lib/csv";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VarResult {
  ticker: string;
  last_price: number;
  confidence: number;
  var_historico_abs: number;
  var_historico_pct: number;
  var_parametrico_abs: number;
  var_parametrico_pct: number;
  n_observations: number;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function VarPanel({ ticker, confiancaInicial }: { ticker: string; confiancaInicial?: string }) {
  const [confidence, setConfidence] = useState(confiancaInicial ?? "0.95");
  const [result, setResult] = useState<VarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const fetchVar = useCallback(
    async (conf: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ ticker, confidence: conf });
        setResult(await apiFetch<VarResult>(`/api/var?${params}`));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [ticker]
  );

  useEffect(() => {
    fetchVar(confidence);
  }, [fetchVar, confidence]);

  function handleConfidenceChange(val: string) {
    setConfidence(val);
  }

  const confLabel = formatPercent(parseFloat(confidence), 0);
  // A API devolve o VaR como retorno negativo; na tela mostramos a perda como valor positivo.
  const perda = (v: number) => Math.abs(v);
  const resumoSalvo =
    result && !loading && !error
      ? {
          ultimo_preco: result.last_price,
          perda_historica_valor: perda(result.var_historico_abs),
          perda_historica_pct: perda(result.var_historico_pct),
          perda_parametrica_valor: perda(result.var_parametrico_abs),
          perda_parametrica_pct: perda(result.var_parametrico_pct),
          leitura: leituraVaR({
            ticker,
            confianca: result.confidence,
            horizonte: 1,
            perda: perda(result.var_historico_abs),
            perdaPct: perda(result.var_historico_pct),
          }),
        }
      : null;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Nível de confiança:</span>
        <Select value={confidence} onValueChange={handleConfidenceChange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0.90">90%</SelectItem>
            <SelectItem value="0.95">95%</SelectItem>
            <SelectItem value="0.99">99%</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <BotaoSalvarAnalise
            ferramenta="var"
            parametros={{ ticker, confianca: Number(confidence) }}
            resultado={resumoSalvo}
          />
          <BotaoExportar
            arquivo={nomeArquivo("Perda maxima VaR", ticker)}
            montar={
              result && !loading
                ? () => {
                    const u = unidadeAtivo(ticker) ? ` (${unidadeAtivo(ticker)})` : "";
                    return gerarCsv({
                      parametros: [
                        ["Ativo", nomeAtivo(ticker)],
                        ["Nível de confiança (%)", result.confidence * 100],
                        ["Horizonte (dias)", 1],
                        ["Dias de histórico usados", result.n_observations],
                      ],
                      tabelas: [
                        {
                          colunas: ["Métrica", `Valor${u}`, "Percentual (%)"],
                          linhas: [
                            ["Último preço", result.last_price, null],
                            ["Perda máxima histórica", perda(result.var_historico_abs), perda(result.var_historico_pct) * 100],
                            ["Perda máxima paramétrica", perda(result.var_parametrico_abs), perda(result.var_parametrico_pct) * 100],
                          ],
                        },
                      ],
                    });
                  }
                : null
            }
          />
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}
      {error && <ErrorState mensagem={error} onRetry={() => fetchVar(confidence)} />}
      {!loading && !error && result && (
        <Leitura>
          {leituraVaR({
            ticker,
            confianca: result.confidence,
            horizonte: 1,
            perda: perda(result.var_historico_abs),
            perdaPct: perda(result.var_historico_pct),
          })}
        </Leitura>
      )}
      {!loading && !error && result && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Último preço" value={formatPreco(ticker, result.last_price)} />
          <MetricCard label={`Perda máxima histórica (${confLabel})`} value={formatPreco(ticker, perda(result.var_historico_abs))} />
          <MetricCard label="Perda máxima histórica (%)" value={formatPercent(perda(result.var_historico_pct))} />
          <MetricCard label={`Perda máxima paramétrica (${confLabel})`} value={formatPreco(ticker, perda(result.var_parametrico_abs))} />
          <MetricCard label="Perda máxima paramétrica (%)" value={formatPercent(perda(result.var_parametrico_pct))} />
          <MetricCard label="Dias de histórico usados" value={formatNumber(result.n_observations, 0)} />
        </div>
      )}
    </div>
  );
}

const ATIVOS_VAR = ["SB=F", "USDBRL=X"];
const NIVEIS_VAR = ["0.90", "0.95", "0.99"];

export default function VarPage() {
  const [tab, setTab] = useState("acucar");
  const [reabertura, setReabertura] = useState<{ ticker: string; confianca: string; versao: number } | null>(null);

  // ANA-05: a página escolhe a aba pelo ativo salvo e remonta o painel com a confiança salva.
  useReabrirAnalise("var", (p) => {
    const ticker = String(p.ticker);
    if (!ATIVOS_VAR.includes(ticker)) {
      toast.error("Esta análise usa um ativo que não está mais no VaR.");
      return;
    }
    // Níveis aceitos são os valores do Select; casa pelo número, sem formatar texto.
    const nivel = NIVEIS_VAR.find((v) => Math.abs(Number(v) - Number(p.confianca)) < 1e-9) ?? "0.95";
    setTab(ticker === "SB=F" ? "acucar" : "dolar");
    setReabertura({ ticker, confianca: nivel, versao: Date.now() });
  });

  const reabertoEm = (ticker: string) => (reabertura?.ticker === ticker ? reabertura : undefined);

  return (
    <div>
      <PageHeader
        titulo="Perda máxima (VaR)"
        descricao="A maior queda de preço esperada em 1 dia, para o nível de confiança escolhido."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="acucar">{nomeAtivo("SB=F")}</TabsTrigger>
          <TabsTrigger value="dolar">{nomeAtivo("USDBRL=X")}</TabsTrigger>
        </TabsList>

        <TabsContent value="acucar">
          <VarPanel
            key={reabertoEm("SB=F")?.versao ?? "padrao"}
            ticker="SB=F"
            confiancaInicial={reabertoEm("SB=F")?.confianca}
          />
        </TabsContent>

        <TabsContent value="dolar">
          <VarPanel
            key={reabertoEm("USDBRL=X")?.versao ?? "padrao"}
            ticker="USDBRL=X"
            confiancaInicial={reabertoEm("USDBRL=X")?.confianca}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
