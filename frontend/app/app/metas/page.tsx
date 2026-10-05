"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatBRL, formatDate, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import { Leitura } from "@/components/ui/leitura";
import { leituraMetas } from "@/lib/leitura";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { gerarCsv, nomeArquivo } from "@/lib/csv";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

interface MetasResult {
  meta: number;
  mtm_series: { date: string; mtm: number; meta: number }[];
  heatmap: number[][];
  acucares: number[];
  dolares: number[];
}

// Escala divergente: verde acima da meta, vermelho abaixo; mais forte além de ±200 R$/t.
function cellClass(v: number): string {
  if (v >= 200) return "bg-positive/25 text-positive font-bold";
  if (v >= 0) return "bg-positive/10 text-positive";
  if (v >= -200) return "bg-negative/10 text-negative";
  return "bg-negative/25 text-negative font-bold";
}

export default function MetasPage() {
  const [meta, setMeta] = useState(2600);
  const [result, setResult] = useState<MetasResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCalc() {
    setLoading(true);
    try {
      setResult(await apiFetch<MetasResult>(`/api/metas?meta=${meta}`));
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Metas"
        descricao="Compara o valor de mercado do açúcar em R$/t com a sua meta, no histórico e em cenários de preço e câmbio."
        acoes={
          <BotaoExportar
            arquivo={nomeArquivo("Metas", null)}
            montar={
              result
                ? () =>
                    gerarCsv({
                      parametros: [["Meta (R$/t)", result.meta]],
                      tabelas: [
                        {
                          colunas: ["Data", "Valor de mercado (R$/t)", "Meta (R$/t)", "Diferença (R$/t)"],
                          linhas: result.mtm_series.map((p) => [p.date, p.mtm, p.meta, p.mtm - p.meta]),
                        },
                        {
                          // Mapa de cenários: diferença para a meta por açúcar (linhas) e câmbio (colunas)
                          colunas: ["Açúcar (¢/lb) \\ Câmbio (R$/US$)", ...result.dolares.map((d) => String(d).replace(".", ","))],
                          linhas: result.acucares.map((a, i) => [a, ...result.heatmap[i]]),
                        },
                      ],
                    })
                : null
            }
          />
        }
      />

      <Card className="max-w-sm">
        <CardHeader><CardTitle className="text-sm font-medium">Meta (R$/t)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Meta: <span className="font-bold tabular-nums">{formatBRL(meta)}/t</span></Label>
          </div>
          <Slider
            min={2400} max={2800} step={10}
            value={[meta]}
            onValueChange={([v]) => setMeta(v)}
          />
          <Button onClick={handleCalc} disabled={loading} className="w-full">
            {loading ? "Calculando..." : "Calcular"}
          </Button>
        </CardContent>
      </Card>

      {!result && <EmptyState mensagem="Escolha a meta e clique em Calcular para ver o mapa de cenários e o histórico." />}

      {result && (
        <>
          <Leitura>{leituraMetas({ mtm: result.mtm_series.at(-1)?.mtm, meta: result.meta })}</Leitura>
          {/* Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Diferença para a meta (R$/t) por preço do açúcar (¢/lb) e câmbio (R$/US$)
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="px-2 py-1 font-normal text-muted-foreground">Açúcar \ Dólar</th>
                    {result.dolares.map((d) => (
                      <th key={d} className="px-2 py-1 text-center font-normal text-muted-foreground">
                        {formatNumber(d, 2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.acucares.map((a, i) => (
                    <tr key={a}>
                      <td className="px-2 py-1 font-medium text-muted-foreground">{formatNumber(a, 2)}</td>
                      {result.heatmap[i].map((v, j) => (
                        <td
                          key={j}
                          className={`min-w-[72px] px-2 py-1 text-center tabular-nums ${cellClass(v)}`}
                        >
                          {v > 0 ? "+" : ""}
                          {formatNumber(v, 0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* MTM Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Valor de mercado (R$/t) no histórico e meta</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={result.mtm_series.filter((_, i) => i % 5 === 0)}
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    minTickGap={32}
                    tickFormatter={(v: string) => formatDate(v).slice(3)}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(v: number) => formatNumber(v, 0)}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [`${formatBRL(v)}/t`, "Valor de mercado"]}
                    labelFormatter={(l: string) => formatDate(l)}
                  />
                  <ReferenceLine
                    y={result.meta}
                    stroke="var(--negative)"
                    strokeDasharray="4 2"
                    label={{ value: `Meta ${formatNumber(result.meta, 0)}`, position: "insideTopRight", fontSize: 10, fill: "var(--negative)" }}
                  />
                  <Line type="monotone" dataKey="mtm" stroke="var(--chart-2)" dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
