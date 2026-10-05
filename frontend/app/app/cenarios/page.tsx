"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CampoNumero, campoValido } from "@/components/ui/campo-numero";
import { Leitura } from "@/components/ui/leitura";
import { leituraCenarios } from "@/lib/leitura";
import { lerNumero } from "@/lib/numero";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { gerarCsv, nomeArquivo } from "@/lib/csv";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

type Opcao = "Moagem" | "Câmbio" | "NY" | "Preço Etanol";

interface CenariosResult {
  opcao: Opcao;
  breakeven: number;
  probabilidade_abaixo: number;
  media: number;
  std: number;
  percentis: { p: number; v: number }[];
  distribuicao: { x: number; y: number }[];
}

const OPCOES: Opcao[] = ["Moagem", "Câmbio", "NY", "Preço Etanol"];

/** Nome de cada variável nos botões (o valor da API continua o mesmo). */
const NOME_OPCAO: Record<Opcao, string> = {
  Moagem: "Moagem",
  "Câmbio": "Câmbio",
  NY: "Açúcar NY",
  "Preço Etanol": "Etanol",
};

const DEFAULTS: Record<Opcao, Record<string, string>> = {
  "Moagem":       { ny: "20", cambio: "5,25", preco_etanol: "2.768,90" },
  "Câmbio":       { ny: "20", moagem: "1.300.000", preco_etanol: "2.768,90" },
  "NY":           { moagem: "1.300.000", cambio: "5,25", preco_etanol: "2.768,90" },
  "Preço Etanol": { ny: "20", moagem: "1.300.000", cambio: "5,25" },
};

const CAMPOS: Record<string, { rotulo: string; unidade: string; ajuda: string }> = {
  ny: { rotulo: "Açúcar NY", unidade: "¢/lb", ajuda: "Preço do açúcar em Nova York usado no cenário." },
  moagem: { rotulo: "Moagem", unidade: "t de cana", ajuda: "Toneladas de cana moídas na safra." },
  cambio: { rotulo: "Câmbio", unidade: "R$/US$", ajuda: "Dólar usado para converter a receita em reais." },
  preco_etanol: { rotulo: "Etanol", unidade: "R$/m³", ajuda: "Preço de venda do etanol." },
};

const FAIXA = { min: 0.0001, max: 100_000_000 };

export default function CenariosPage() {
  const [opcao, setOpcao] = useState<Opcao>("NY");
  const [values, setValues] = useState<Record<string, string>>({ ...DEFAULTS["NY"] });
  const [result, setResult] = useState<CenariosResult | null>(null);
  const [loading, setLoading] = useState(false);

  function handleOpcaoChange(o: Opcao) {
    setOpcao(o);
    setValues({ ...DEFAULTS[o] });
    setResult(null);
  }

  async function handleSimulate() {
    if (!Object.values(values).every((v) => campoValido(v, FAIXA))) {
      toast.error("Corrija os campos destacados antes de calcular.");
      return;
    }
    setLoading(true);
    try {
      const numeros = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, lerNumero(v)]));
      const body = { opcao, ny: 0, moagem: 0, cambio: 0, preco_etanol: 0, ...numeros };
      const data = await apiFetch<CenariosResult>("/api/cenarios", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(data);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  const otherInputs = Object.keys(DEFAULTS[opcao]);

  // Casas decimais por variável: moagem em toneladas inteiras, preços com 2 casas.
  const fmt = (v: number) => formatNumber(v, result?.opcao === "Moagem" ? 0 : 2);

  // Posição do breakeven no eixo x (0 a 1), para dividir a área em vermelho e verde.
  const xs = result?.distribuicao.map((d) => d.x) ?? [0, 1];
  const corte = result
    ? Math.min(1, Math.max(0, (result.breakeven - xs[0]) / (xs[xs.length - 1] - xs[0])))
    : 0;

  return (
    <div>
      <PageHeader
        titulo="Breakeven da safra"
        descricao="Encontra o valor de uma variável em que o EBITDA zera e a chance de o mercado ficar abaixo dele."
        acoes={
          <BotaoExportar
            arquivo={nomeArquivo("Breakeven da safra", NOME_OPCAO[opcao])}
            montar={
              result
                ? () =>
                    gerarCsv({
                      parametros: [
                        ["Variável analisada", NOME_OPCAO[result.opcao]],
                        ...Object.entries(values).map(
                          ([k, v]) => [`${CAMPOS[k].rotulo} (${CAMPOS[k].unidade})`, lerNumero(v)] as [string, number | null]
                        ),
                        ["Breakeven", result.breakeven],
                        ["Chance de ficar abaixo (%)", result.probabilidade_abaixo * 100],
                        ["Média esperada", result.media],
                        ["Desvio-padrão", result.std],
                      ],
                      tabelas: [
                        { colunas: ["Percentil", NOME_OPCAO[result.opcao]], linhas: result.percentis.map((p) => [`P${p.p}`, p.v]) },
                        { colunas: [NOME_OPCAO[result.opcao], "Densidade"], linhas: result.distribuicao.map((d) => [d.x, d.y]) },
                      ],
                    })
                : null
            }
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1">
              <Label>
                Variável de análise <FieldTooltip text="A variável para a qual o breakeven será calculado" />
              </Label>
              <div className="flex flex-wrap gap-2">
                {OPCOES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => handleOpcaoChange(o)}
                    aria-pressed={opcao === o}
                    className={cn(
                      "rounded border px-3 py-1.5 text-sm transition-colors",
                      opcao === o ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"
                    )}
                  >
                    {NOME_OPCAO[o]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {otherInputs.map((key) => (
                <CampoNumero
                  key={key}
                  id={`cen-${key}`}
                  rotulo={CAMPOS[key].rotulo}
                  unidade={CAMPOS[key].unidade}
                  ajuda={CAMPOS[key].ajuda}
                  valor={values[key] ?? ""}
                  onChange={(t) => setValues((prev) => ({ ...prev, [key]: t }))}
                  {...FAIXA}
                />
              ))}
            </div>

            <Button onClick={handleSimulate} disabled={loading} className="w-full">
              {loading ? "Calculando..." : "Calcular cenário"}
            </Button>
          </CardContent>
        </Card>

        {!result && <EmptyState mensagem="Escolha a variável, ajuste as demais e clique em Calcular cenário." />}

        {result && (
          <div className="min-w-0 space-y-6">
            <Leitura>
              {leituraCenarios({ opcao: result.opcao, breakeven: result.breakeven, prob: result.probabilidade_abaixo })}
            </Leitura>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Breakeven · {NOME_OPCAO[result.opcao]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{fmt(result.breakeven)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Chance de ficar abaixo</CardTitle>
                </CardHeader>
                <CardContent>
                  <p
                    className={cn(
                      "text-2xl font-bold tabular-nums",
                      result.probabilidade_abaixo > 0.3 ? "text-negative" : "text-positive"
                    )}
                  >
                    {result.probabilidade_abaixo < 0.01 ? "menos de 1%" : formatPercent(result.probabilidade_abaixo, 1)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Média esperada</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums">{fmt(result.media)}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Distribuição de probabilidade · {NOME_OPCAO[result.opcao]}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={result.distribuicao} margin={{ top: 16, right: 16, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="colorRisk" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--negative)" stopOpacity={0.5} />
                        <stop offset={`${corte * 100}%`} stopColor="var(--negative)" stopOpacity={0.5} />
                        <stop offset={`${corte * 100}%`} stopColor="var(--positive)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--positive)" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                    <XAxis
                      dataKey="x"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      tickFormatter={(v: number) => fmt(v)}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [formatNumber(v, 6), "Densidade"]}
                      labelFormatter={(v: number) => fmt(v)}
                    />
                    <ReferenceLine
                      x={result.breakeven}
                      stroke="var(--foreground)"
                      strokeDasharray="4 2"
                      label={{ value: "Breakeven", position: "top", fontSize: 11, fill: "var(--foreground)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="y"
                      stroke="var(--chart-1)"
                      fill="url(#colorRisk)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Percentis · {NOME_OPCAO[result.opcao]}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-1 text-sm sm:grid-cols-4 lg:grid-cols-5">
                  {result.percentis.map(({ p, v }) => (
                    <div
                      key={p}
                      className={cn(
                        "rounded px-2 py-1 text-center",
                        v < result.breakeven ? "bg-negative/10 text-negative" : "bg-positive/10 text-positive"
                      )}
                    >
                      <span className="block text-xs text-muted-foreground">P{p}</span>
                      <span className="font-medium tabular-nums">{fmt(v)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
