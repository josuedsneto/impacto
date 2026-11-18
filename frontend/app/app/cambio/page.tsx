"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDate, formatFX, formatPercent } from "@/lib/format";
import { Leitura } from "@/components/ui/leitura";
import { AUSENTE, leituraCambio } from "@/lib/leitura";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { gerarCsv, nomeArquivo } from "@/lib/csv";
import {
  COBERTURA_90_6_MESES,
  HORIZONTES,
  diasUteisAteFimSafra,
  horizonteParaApi,
  lerNiveis,
  niveisParaApi,
} from "@/lib/cambio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const AVISO = "Faixa de possibilidades, não previsão.";
const TICKER = "USDBRL=X";

interface Banda {
  data: string;
  p5: number;
  p50: number;
  p95: number;
}

interface Nivel {
  nivel: number;
  p_acima_vencimento: number;
  p_abaixo_vencimento: number;
  p_tocar_antes: number;
}

interface CambioResponse {
  spot: number;
  ultimo_dado: string;
  horizonte: number;
  vencimento: string;
  volatilidade_anual: number;
  modelo: string;
  historico: { date: string; close: number }[];
  bandas: Banda[];
  forward: {
    valor: number | null;
    selic_meta_aa: number | null;
    fed_funds_aa: number | null;
    tau_anos: number;
    aproximacao: string;
  };
  focus: {
    ano_corrente: string;
    cambio_ano_corrente: number | null;
    ano_seguinte?: string;
    cambio_ano_seguinte?: number | null;
  };
  niveis: Nivel[];
}

export default function CambioPage() {
  const [opcao, setOpcao] = useState("63");
  const [niveisDigitados, setNiveisDigitados] = useState("");
  const [niveisAplicados, setNiveisAplicados] = useState("");
  const [erroNiveis, setErroNiveis] = useState<string | null>(null);
  const [dados, setDados] = useState<CambioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    const params = new URLSearchParams({ horizonte: String(horizonteParaApi(opcao)) });
    if (niveisAplicados) params.set("niveis", niveisAplicados);
    setLoading(true);
    setError(null);
    apiFetch<CambioResponse>(`/api/cambio/previsao?${params}`, { timeoutMs: 60_000 })
      .then((json) => {
        if (ativo) setDados(json);
      })
      .catch((e) => {
        if (ativo) setError((e as Error).message);
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [opcao, niveisAplicados, tentativa]);

  function aplicarNiveis() {
    if (niveisDigitados.trim() === "") {
      setErroNiveis(null);
      setNiveisAplicados("");
      return;
    }
    const valores = lerNiveis(niveisDigitados);
    if (!valores) {
      setErroNiveis("Informe de 1 a 10 níveis, cada um entre 0,5 e 20, separados por ponto e vírgula (ex.: 5,20; 5,80).");
      return;
    }
    setErroNiveis(null);
    setNiveisAplicados(niveisParaApi(valores));
  }

  const ultima = dados?.bandas.at(-1);
  const horizonteTestado = dados && dados.horizonte >= 126;
  const grafico = dados
    ? [
        ...dados.historico.map((h) => ({ date: h.date, close: h.close })),
        ...dados.bandas.map((b) => ({ date: b.data, faixa: [b.p5, b.p95] as [number, number], p50: b.p50 })),
      ]
    : [];

  return (
    <div>
      <PageHeader
        titulo="Câmbio (USD/BRL)"
        descricao="Faixa provável do dólar nos próximos meses, chance de passar de um nível de hedge e preço de travar hoje."
      />

      <p className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <strong>{AVISO}</strong> Mostra a incerteza do mercado, não o que vai acontecer.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <span className="text-sm font-medium">Prazo:</span>
          <Select value={opcao} onValueChange={setOpcao}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZONTES.map((h) => (
                <SelectItem key={h.valor} value={h.valor}>
                  {h.valor === "safra" ? `Fim da safra (${diasUteisAteFimSafra()} dias úteis)` : h.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium">Níveis de hedge (R$):</span>
          <div className="flex gap-2">
            <Input
              value={niveisDigitados}
              onChange={(e) => setNiveisDigitados(e.target.value)}
              placeholder="ex.: 5,20; 5,80"
              className="w-56"
              aria-label="Níveis de hedge em reais"
            />
            <Button variant="outline" onClick={aplicarNiveis}>
              Aplicar
            </Button>
          </div>
          {erroNiveis && <p className="text-sm text-negative">{erroNiveis}</p>}
        </div>
      </div>

      {loading && <Skeleton className="h-80" />}

      {error && <ErrorState mensagem={error} onRetry={() => setTentativa((t) => t + 1)} />}

      {!loading && !error && dados && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <BotaoExportar
              arquivo={nomeArquivo("Cambio previsao", TICKER)}
              montar={() =>
                gerarCsv({
                  parametros: [
                    ["Ativo", "USD/BRL"],
                    ["Horizonte (dias úteis)", dados.horizonte],
                    ["Último dado", formatDate(dados.ultimo_dado)],
                    ["Spot (R$)", dados.spot],
                    ["Volatilidade anual", dados.volatilidade_anual],
                    ["Modelo", dados.modelo],
                  ],
                  tabelas: [
                    {
                      colunas: ["Data", "p5 (R$)", "Mediana (R$)", "p95 (R$)"],
                      linhas: dados.bandas.map((b) => [b.data, b.p5, b.p50, b.p95]),
                    },
                    {
                      colunas: ["Nível (R$)", "P(acima no vencimento)", "P(abaixo no vencimento)", "P(tocar antes)"],
                      linhas: dados.niveis.map((n) => [n.nivel, n.p_acima_vencimento, n.p_abaixo_vencimento, n.p_tocar_antes]),
                    },
                  ],
                })
              }
            />
          </div>

          <p className="text-sm text-muted-foreground">Vencimento considerado: {formatDate(dados.vencimento)}.</p>

          <Leitura>
            {leituraCambio({
              horizonte: dados.horizonte,
              spot: dados.spot,
              p5: ultima?.p5,
              p95: ultima?.p95,
              forward: dados.forward.valor,
            })}
          </Leitura>

          {horizonteTestado && (
            <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
              Faixa de prazo longo, indicativa. No teste histórico em 6 meses, a faixa de 90% cobriu{" "}
              {COBERTURA_90_6_MESES}% dos casos (o esperado era 90%). A faixa tende a ficar estreita para prazos longos.
            </p>
          )}

          <div className="rounded-xl border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={grafico} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  minTickGap={24}
                  tickFormatter={(v: string) => formatDate(v).slice(0, 5)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => formatFX(v).replace("R$ ", "")}
                />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v: string) => formatDate(v)}
                  formatter={(v: number | number[], nome: string) => [
                    Array.isArray(v) ? `${formatFX(v[0])} a ${formatFX(v[1])}` : formatFX(v),
                    nome,
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area dataKey="faixa" name="Faixa de 90%" fill="var(--chart-1)" fillOpacity={0.2} stroke="none" isAnimationActive={false} />
                <Line dataKey="close" name="Histórico" stroke="var(--foreground)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                <Line dataKey="p50" name="Mediana" stroke="var(--chart-1)" dot={false} strokeWidth={2} strokeDasharray="5 3" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-medium">Preço de travar hoje</h2>
              <p className="text-2xl font-semibold">{dados.forward.valor != null ? formatFX(dados.forward.valor) : AUSENTE}</p>
              <p className="mt-2 text-xs text-muted-foreground">{dados.forward.aproximacao}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-2 text-sm font-medium">Expectativa do Focus (câmbio ao fim do ano)</h2>
              <p className="text-sm">
                {dados.focus.cambio_ano_corrente != null
                  ? `${dados.focus.ano_corrente}: ${formatFX(dados.focus.cambio_ano_corrente)}`
                  : "Sem dados do Focus agora."}
              </p>
              {dados.focus.ano_seguinte && (
                <p className="text-sm">
                  {dados.focus.cambio_ano_seguinte != null
                    ? `${dados.focus.ano_seguinte}: ${formatFX(dados.focus.cambio_ano_seguinte)}`
                    : `${dados.focus.ano_seguinte}: sem dados do Focus agora.`}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium">Chance de passar de cada nível até o vencimento</h2>
            {dados.niveis.length === 0 ? (
              <p className="text-sm">{AUSENTE}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nível</TableHead>
                    <TableHead>Chance no vencimento</TableHead>
                    <TableHead>P(tocar antes)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.niveis.map((n) => (
                    <TableRow key={n.nivel}>
                      <TableCell>{formatFX(n.nivel)}</TableCell>
                      <TableCell>
                        {n.nivel >= dados.spot
                          ? `acima: ${formatPercent(n.p_acima_vencimento, 1)}`
                          : `abaixo: ${formatPercent(n.p_abaixo_vencimento, 1)}`}
                      </TableCell>
                      <TableCell>{formatPercent(n.p_tocar_antes, 1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Toque medido no fechamento diário. A coluna mostra a chance de ficar acima do nível, ou abaixo quando o nível está abaixo do câmbio de hoje.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
