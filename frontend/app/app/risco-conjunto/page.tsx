"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatBRL, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import { Leitura } from "@/components/ui/leitura";
import { leituraRiscoConjunto, probabilidade } from "@/lib/leitura";
import { lerNumero } from "@/lib/numero";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { gerarCsv, nomeArquivo } from "@/lib/csv";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { BarChart, Cell, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface Contribuicao { prob_sem_correlacao: number; prob_so_acucar: number; prob_so_dolar: number; }
interface RiscoConjuntoResult {
  meta: number;
  prob_abaixo_meta: number;
  p5: number;
  p50: number;
  p95: number;
  histograma: { limites: number[]; contagens: number[] };
  correlacao: number;
  vol_acucar: number;
  vol_dolar: number;
  contribuicao: Contribuicao;
  ultimo_dado: string;
}

// Texto digitado (aceita vírgula); convertido com lerNumero só no envio.
interface Entradas { meta: string; horizonte: string; pctFixado: string; precoFixado: string; }

// "2100" e não "2.100": um único ponto sem vírgula é lido como decimal (lerNumero).
const DEFAULTS: Entradas = { meta: "2100", horizonte: "63", pctFixado: "0", precoFixado: "" };

const valido = (e: Entradas) => {
  const meta = lerNumero(e.meta);
  const h = lerNumero(e.horizonte);
  const pct = lerNumero(e.pctFixado);
  const pf = lerNumero(e.precoFixado);
  if (meta === null || meta <= 0 || meta > 100000) return false;
  if (h === null || !Number.isInteger(h) || h < 1 || h > 252) return false;
  if (pct === null || pct < 0 || pct > 100) return false;
  if (pct > 0 && (pf === null || pf <= 0 || pf > 100000)) return false;
  return true;
};

const LINHAS_CONTRIB: { chave: keyof Contribuicao; rotulo: string }[] = [
  { chave: "prob_so_acucar", rotulo: "Só o açúcar varia (dólar fixo)" },
  { chave: "prob_so_dolar", rotulo: "Só o dólar varia (açúcar fixo)" },
  { chave: "prob_sem_correlacao", rotulo: "Sem correlação entre açúcar e dólar" },
];

function HistogramaReceita({ result }: { result: RiscoConjuntoResult }) {
  const { limites, contagens } = result.histograma;
  const dados = contagens.map((n, i) => {
    const meio = (limites[i] + limites[i + 1]) / 2;
    return { rotulo: formatNumber(meio, 0), n, abaixo: meio < result.meta };
  });
  // A meta só tem linha se cair dentro da faixa mostrada; fora dela, o texto avisa.
  const indiceMeta = limites.findIndex((l, i) => i < contagens.length && l <= result.meta && result.meta < limites[i + 1]);
  const rotuloMeta = indiceMeta >= 0 ? dados[indiceMeta].rotulo : undefined;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Distribuição da receita (R$/t)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${formatNumber(Number(v), 0)} cenários`, "Frequência"]} />
              {rotuloMeta && (
                <ReferenceLine x={rotuloMeta} stroke="var(--chart-3)" strokeDasharray="4 4" label={{ value: "Meta", fontSize: 11 }} />
              )}
              <Bar dataKey="n" isAnimationActive={false}>
                {dados.map((d, i) => (
                  <Cell key={i} fill={d.abaixo ? "var(--chart-2)" : "var(--chart-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          As barras de outra cor são os cenários abaixo da meta; a linha tracejada marca a meta.
          {!rotuloMeta && " A meta está fora da faixa mostrada."}
        </p>
      </CardContent>
    </Card>
  );
}

export default function RiscoConjuntoPage() {
  const [entradas, setEntradas] = useState<Entradas>({ ...DEFAULTS });
  const [result, setResult] = useState<RiscoConjuntoResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    if (!valido(entradas)) {
      toast.error("Use meta positiva, horizonte de 1 a 252 pregões e % fixado entre 0 e 100. Com % fixado, informe o preço fixado.");
      return;
    }
    setLoading(true);
    try {
      const pct = lerNumero(entradas.pctFixado) ?? 0;
      const data = await apiFetch<RiscoConjuntoResult>("/api/risco-conjunto", {
        method: "POST",
        body: JSON.stringify({
          meta: lerNumero(entradas.meta),
          horizonte: lerNumero(entradas.horizonte),
          percentual_fixado: pct,
          preco_fixado: pct > 0 ? lerNumero(entradas.precoFixado) : null,
          n_simulacoes: 20000,
        }),
      });
      setResult(data);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  const campo = (rotulo: string, chave: keyof Entradas, dica?: string) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {rotulo} {dica && <FieldTooltip text={dica} />}
      </span>
      <Input
        type="text"
        inputMode="decimal"
        aria-label={rotulo}
        aria-invalid={chave === "meta" && lerNumero(entradas.meta) === null ? true : undefined}
        className="h-9 w-40 tabular-nums"
        value={entradas[chave]}
        onChange={(e) => setEntradas((prev) => ({ ...prev, [chave]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Receita em R$ (açúcar × dólar)"
        descricao="Chance de a receita por tonelada ficar abaixo da meta, considerando que açúcar e dólar variam juntos."
        atualizadoEm={result?.ultimo_dado}
        acoes={
          <BotaoExportar
            arquivo={nomeArquivo("Receita em R$", null)}
            montar={
              result
                ? () =>
                    gerarCsv({
                      parametros: [
                        ["Meta (R$/t)", result.meta],
                        ["Horizonte (pregões)", lerNumero(entradas.horizonte)],
                        ["Fixado (%)", lerNumero(entradas.pctFixado)],
                        ["Preço fixado (R$/t)", lerNumero(entradas.precoFixado)],
                        ["Vol anual açúcar", result.vol_acucar],
                        ["Vol anual dólar", result.vol_dolar],
                        ["Correlação", result.correlacao],
                      ],
                      tabelas: [
                        {
                          colunas: ["Resultado", "Valor"],
                          linhas: [
                            ["Probabilidade abaixo da meta", result.prob_abaixo_meta],
                            ["P5 (R$/t)", result.p5],
                            ["P50 (R$/t)", result.p50],
                            ["P95 (R$/t)", result.p95],
                            ...LINHAS_CONTRIB.map((l) => [l.rotulo, result.contribuicao[l.chave]]),
                          ],
                        },
                      ],
                    })
                : null
            }
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Dados da simulação <FieldTooltip text="A receita é FATOR × preço do açúcar (¢/lb) × dólar (R$/US$). A parte fixada entra pelo preço que você informar." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            {campo("Meta (R$/t)", "meta")}
            {campo("Horizonte (pregões)", "horizonte", "Dias úteis até o fim do período: 63 é cerca de 3 meses.")}
            {campo("% já fixado", "pctFixado", "Parte da safra que já tem preço travado. Use 0 se nada foi fixado.")}
            {campo("Preço fixado (R$/t)", "precoFixado", "Preço médio já travado, em R$ por tonelada.")}
          </div>
          <Button onClick={handleSimulate} disabled={loading}>
            {loading ? "Simulando..." : "Simular (20.000 cenários)"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Leitura>{leituraRiscoConjunto({ prob: result.prob_abaixo_meta, meta: result.meta, p50: result.p50 })}</Leitura>
      )}

      {result ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Risco</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold tabular-nums">
                {probabilidade(result.prob_abaixo_meta)} de chance de a receita ficar abaixo de {formatBRL(result.meta)}/t
              </p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <dt className="text-muted-foreground">P5</dt>
                <dt className="text-muted-foreground">P50</dt>
                <dt className="text-muted-foreground">P95</dt>
                <dd className="tabular-nums">{formatBRL(result.p5)}</dd>
                <dd className="tabular-nums">{formatBRL(result.p50)}</dd>
                <dd className="tabular-nums">{formatBRL(result.p95)}</dd>
              </dl>
              <p className="text-xs text-muted-foreground">
                Correlação estimada entre açúcar e dólar: {formatNumber(result.correlacao, 2)}.
              </p>
              <div>
                <p className="mb-1 text-sm font-medium">Quanto cada fator contribui</p>
                <ul className="space-y-1 text-sm">
                  {LINHAS_CONTRIB.map((l) => (
                    <li key={l.chave} className="flex justify-between gap-2">
                      <span>{l.rotulo}</span>
                      <span className="tabular-nums">{probabilidade(result.contribuicao[l.chave])}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          <div className="xl:col-span-2">
            <HistogramaReceita result={result} />
          </div>
        </div>
      ) : (
        <EmptyState mensagem="Informe a meta e clique em Simular para ver a chance de a receita ficar abaixo dela." />
      )}
    </div>
  );
}
