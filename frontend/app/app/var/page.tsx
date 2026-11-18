"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDate, formatNumber, formatPercent, formatPreco } from "@/lib/format";
import { Leitura } from "@/components/ui/leitura";
import { leituraVaR } from "@/lib/leitura";
import { nomeAtivo, unidadeAtivo } from "@/lib/ativos";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { gerarCsv, nomeArquivo } from "@/lib/csv";
import { TickerSelect } from "@/components/market/TickerSelect";
import { BotaoSalvarAnalise } from "@/components/analises/botao-salvar-analise";
import { useReabrirAnalise } from "@/lib/reabrir-analise";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VarResult {
  ticker: string;
  ultimo_dado?: string;
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
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function VarPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [confidence, setConfidence] = useState("0.95");
  const [tentativa, setTentativa] = useState(0);
  // Resposta marcada com a chave do pedido: se a chave não for a atual, a tela está carregando.
  const [resposta, setResposta] = useState<{ chave: string; data?: VarResult; erro?: string } | null>(null);
  const chave = `${ticker}|${confidence}|${tentativa}`;
  const loading = resposta?.chave !== chave;
  const result = !loading && resposta?.data ? resposta.data : null;
  const error = !loading ? resposta?.erro ?? null : null;

  // ANA-05: reabrir uma análise salva restaura ativo e confiança.
  useReabrirAnalise("var", (p) => {
    setTicker(String(p.ticker));
    const nivel = ["0.90", "0.95", "0.99"].find((v) => Math.abs(Number(v) - Number(p.confianca)) < 1e-9);
    setConfidence(nivel ?? "0.95");
  });

  // Cada troca de ativo ou de confiança cancela a requisição anterior: só a última resposta aparece.
  useEffect(() => {
    const controle = new AbortController();
    const params = new URLSearchParams({ ticker, confidence });
    apiFetch<VarResult>(`/api/var?${params}`, { signal: controle.signal })
      .then((data) => {
        if (!controle.signal.aborted) setResposta({ chave, data });
      })
      .catch((e: Error) => {
        if (e.name === "AbortError" || controle.signal.aborted) return;
        setResposta({ chave, erro: e.message });
      });
    return () => controle.abort();
    // chave já inclui ticker, confidence e tentativa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, confidence, tentativa]);

  const confLabel = formatPercent(parseFloat(confidence), 0);
  // A API devolve o VaR como retorno negativo; na tela mostramos a perda como valor positivo.
  const perda = (v: number) => Math.abs(v);
  const pronto = !loading && !error && result && result.ticker === ticker;
  const resumoSalvo = pronto
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
    <div>
      <PageHeader
        titulo="Perda máxima (VaR)"
        descricao="A maior queda de preço esperada em 1 dia, para o nível de confiança escolhido."
      />

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <TickerSelect value={ticker} onChange={setTicker} disabled={loading} />
          <div className="space-y-2">
            <span className="block text-sm font-medium">Nível de confiança</span>
            <Select value={confidence} onValueChange={setConfidence}>
              <SelectTrigger className="w-28" aria-label="Nível de confiança">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.90">90%</SelectItem>
                <SelectItem value="0.95">95%</SelectItem>
                <SelectItem value="0.99">99%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <BotaoSalvarAnalise
              ferramenta="var"
              parametros={{ ticker, confianca: Number(confidence) }}
              resultado={resumoSalvo}
            />
            <BotaoExportar
              arquivo={nomeArquivo("Perda maxima VaR", ticker)}
              montar={
                pronto
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
          <div className="space-y-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-16" />
          </div>
        )}
        {error && <ErrorState mensagem={error} onRetry={() => setTentativa((n) => n + 1)} />}

        {pronto && (
          <>
            <Leitura>
              {leituraVaR({
                ticker,
                confianca: result.confidence,
                horizonte: 1,
                perda: perda(result.var_historico_abs),
                perdaPct: perda(result.var_historico_pct),
              })}
            </Leitura>
            {result.ultimo_dado && (
              <p className="text-xs text-muted-foreground">Fechamento de {formatDate(result.ultimo_dado)}</p>
            )}

            <Card className="border-negative/40">
              <CardContent className="space-y-1 pt-6">
                <p className="text-sm text-muted-foreground">
                  Perda máxima em 1 dia com {confLabel}
                </p>
                <p className="text-4xl font-bold tabular-nums text-negative">
                  {formatPreco(ticker, perda(result.var_historico_abs))}
                </p>
                <p className="text-sm text-muted-foreground">
                  Horizonte: 1 dia · {formatPercent(perda(result.var_historico_pct))} do preço atual de{" "}
                  {formatPreco(ticker, result.last_price)}
                </p>
              </CardContent>
            </Card>

            <details className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">Detalhes técnicos</summary>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label="Último preço" value={formatPreco(ticker, result.last_price)} />
                <MetricCard label="Perda máxima paramétrica" value={formatPreco(ticker, perda(result.var_parametrico_abs))} />
                <MetricCard label="Perda máxima paramétrica (%)" value={formatPercent(perda(result.var_parametrico_pct))} />
                <MetricCard label="Perda máxima histórica (%)" value={formatPercent(perda(result.var_historico_pct))} />
                <MetricCard label="Dias de histórico usados" value={formatNumber(result.n_observations, 0)} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Histórica: usa as quedas que de fato ocorreram. Paramétrica: assume uma curva normal de retornos.
              </p>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
