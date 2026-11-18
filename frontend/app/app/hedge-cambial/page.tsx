"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Leitura } from "@/components/ui/leitura";
import { BotaoExportar } from "@/components/ui/botao-exportar";
import { BotaoSalvarAnalise } from "@/components/analises/botao-salvar-analise";
import { gerarCsv, nomeArquivo } from "@/lib/csv";
import { lerNumero } from "@/lib/numero";
import { leituraHedge } from "@/lib/leitura";
import { formatBRL, formatCompactBRL, formatDate, formatFX, formatNumber, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AVISO = "Comparação de cenários, não recomendação.";
const PRAZOS = [
  { valor: "21", rotulo: "1 mês (21 dias úteis)" },
  { valor: "63", rotulo: "3 meses (63 dias úteis)" },
  { valor: "126", rotulo: "6 meses (126 dias úteis)" },
];

interface Estrategia {
  id: string;
  nome: string;
  receita_rs: { p5: number; p50: number; p95: number; media: number };
  p_abaixo_orcamento: number;
  p_arrepender: number;
  premio_rs: number;
}

interface HedgeResposta {
  spot: number;
  forward: number;
  forward_vs_spot: number;
  vencimento: string;
  horizonte_du: number;
  volume_usd: number;
  orcamento: number;
  pct_forward: number;
  strikes: { put: number; collar_k1: number; collar_k2: number };
  vol_anual: number;
  selic_meta_aa: number;
  fed_funds_aa: number;
  carrego_rs: number;
  estrategias: Estrategia[];
  aviso: string;
  premissas: string;
}

interface Padrao {
  spot: number;
  forward: { valor: number | null };
}

interface Campos {
  volume: string;
  prazo: string;
  orcamento: string;
  pct: string;
  strikePut: string;
  k1: string;
  k2: string;
}

const txt = (v: number) => formatNumber(v, 4);

export default function HedgeCambialPage() {
  const [padrao, setPadrao] = useState<Padrao | null>(null);
  const [erroPadrao, setErroPadrao] = useState<string | null>(null);
  const [campos, setCampos] = useState<Campos>({
    volume: "1.000.000",
    prazo: "63",
    orcamento: "",
    pct: "50",
    strikePut: "",
    k1: "",
    k2: "",
  });
  const [resultado, setResultado] = useState<HedgeResposta | null>(null);
  const [calculando, setCalculando] = useState(false);

  // Padrões de spot e forward atuais; os campos de strike e orçamento começam nesses valores.
  useEffect(() => {
    let ativo = true;
    apiFetch<Padrao>("/api/cambio/previsao?horizonte=63", { timeoutMs: 60_000 })
      .then((p) => {
        if (!ativo) return;
        setPadrao(p);
        if (p.forward.valor != null) {
          setCampos((c) => ({
            ...c,
            orcamento: txt(p.forward.valor!),
            strikePut: txt(p.spot * 0.95),
            k1: txt(p.spot * 0.95),
            k2: txt(p.spot * 1.05),
          }));
        }
      })
      .catch((e) => {
        if (ativo) setErroPadrao((e as Error).message);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function atualizar(campo: keyof Campos, valor: string) {
    setCampos((c) => ({ ...c, [campo]: valor }));
  }

  async function calcular() {
    const volume = lerNumero(campos.volume);
    const orcamento = lerNumero(campos.orcamento);
    const pct = lerNumero(campos.pct);
    const strikePut = lerNumero(campos.strikePut);
    const k1 = lerNumero(campos.k1);
    const k2 = lerNumero(campos.k2);
    if (volume == null || orcamento == null || pct == null || strikePut == null || k1 == null || k2 == null) {
      toast.error("Preencha todos os campos com números.");
      return;
    }
    if (k1 > k2) {
      toast.error("No collar, o strike da put (K1) não pode ser maior que o da call (K2).");
      return;
    }
    setCalculando(true);
    try {
      const r = await apiFetch<HedgeResposta>("/api/hedge-cambial", {
        method: "POST",
        timeoutMs: 60_000,
        body: JSON.stringify({
          volume_usd: volume,
          horizonte_du: Number(campos.prazo),
          orcamento,
          pct_forward: pct,
          strike_put: strikePut,
          collar_k1: k1,
          collar_k2: k2,
        }),
      });
      setResultado(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCalculando(false);
    }
  }

  const por = (id: string) => resultado?.estrategias.find((e) => e.id === id);
  const aberto = por("aberto");
  const travar = por("forward_total");
  const leitura =
    resultado && aberto && travar
      ? leituraHedge({
          medianaAberto: aberto.receita_rs.p50,
          pAbaixoAberto: aberto.p_abaixo_orcamento,
          orcamento: resultado.orcamento,
          medianaForward: travar.receita_rs.p50,
        })
      : null;

  const grafico = resultado?.estrategias.map((e) => ({
    nome: e.nome,
    base: e.receita_rs.p5 / 1e6,
    faixa: (e.receita_rs.p95 - e.receita_rs.p5) / 1e6,
  }));

  return (
    <div>
      <PageHeader
        titulo="Hedge cambial"
        descricao="Compara ficar aberto, travar no forward, comprar put e collar sobre os mesmos cenários do dólar."
      />

      <p className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <strong>{AVISO}</strong> Mostra o que cada escolha entrega em cenários possíveis, não o que vai acontecer.
      </p>

      {erroPadrao && <ErrorState mensagem={erroPadrao} />}
      {!padrao && !erroPadrao && <Skeleton className="mb-4 h-24" />}

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="volume" className="text-sm font-medium">Volume a receber (US$)</label>
          <Input id="volume" value={campos.volume} onChange={(e) => atualizar("volume", e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium">Prazo</span>
          <Select value={campos.prazo} onValueChange={(v) => atualizar("prazo", v)}>
            <SelectTrigger className="w-full" aria-label="Prazo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRAZOS.map((p) => (
                <SelectItem key={p.valor} value={p.valor}>
                  {p.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="orcamento" className="text-sm font-medium">Câmbio mínimo do orçamento (R$)</label>
          <Input id="orcamento" value={campos.orcamento} onChange={(e) => atualizar("orcamento", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="pct" className="text-sm font-medium">% travado no forward</label>
          <Input id="pct" value={campos.pct} onChange={(e) => atualizar("pct", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="put" className="text-sm font-medium">Strike da put (R$)</label>
          <Input id="put" value={campos.strikePut} onChange={(e) => atualizar("strikePut", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="k1" className="text-sm font-medium">Collar: put K1 (R$)</label>
          <Input id="k1" value={campos.k1} onChange={(e) => atualizar("k1", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label htmlFor="k2" className="text-sm font-medium">Collar: call K2 (R$)</label>
          <Input id="k2" value={campos.k2} onChange={(e) => atualizar("k2", e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={calcular} disabled={calculando || !padrao} className="w-full">
            {calculando ? "Calculando..." : "Comparar estratégias"}
          </Button>
        </div>
      </div>

      {resultado && aberto && travar && leitura && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Preço de travar hoje: {formatFX(resultado.forward)} (câmbio de hoje {formatFX(resultado.spot)}). Vencimento:{" "}
              {formatDate(resultado.vencimento)}.
            </p>
            <div className="flex gap-2">
              <BotaoSalvarAnalise
                ferramenta="hedge_cambial"
                parametros={{
                  volume_usd: resultado.volume_usd,
                  horizonte_du: resultado.horizonte_du,
                  orcamento: resultado.orcamento,
                  pct_forward: resultado.pct_forward,
                  strike_put: resultado.strikes.put,
                  collar_k1: resultado.strikes.collar_k1,
                  collar_k2: resultado.strikes.collar_k2,
                }}
                resultado={{
                  leitura,
                  forward: resultado.forward,
                  orcamento: resultado.orcamento,
                  mediana_aberto_rs: aberto.receita_rs.p50,
                  mediana_forward_rs: travar.receita_rs.p50,
                  p_abaixo_aberto: aberto.p_abaixo_orcamento,
                  premio_put_rs: por("put")?.premio_rs ?? 0,
                }}
              />
              <BotaoExportar
                arquivo={nomeArquivo("hedge_cambial", null)}
                montar={() =>
                  gerarCsv({
                    parametros: [
                      ["Volume (US$)", resultado.volume_usd],
                      ["Prazo (dias úteis)", resultado.horizonte_du],
                      ["Orçamento (R$)", resultado.orcamento],
                      ["% travado no forward", resultado.pct_forward],
                      ["Spot (R$)", resultado.spot],
                      ["Forward (R$)", resultado.forward],
                      ["Volatilidade anual", resultado.vol_anual],
                      ["Carrego do forward (R$)", resultado.carrego_rs],
                      ["Premissas", resultado.premissas],
                    ],
                    tabelas: [
                      {
                        colunas: [
                          "Estratégia",
                          "Receita p5 (R$)",
                          "Receita mediana (R$)",
                          "Receita p95 (R$)",
                          "Receita média (R$)",
                          "P(abaixo do orçamento)",
                          "P(arrepender)",
                          "Prêmio (R$)",
                        ],
                        linhas: resultado.estrategias.map((e) => [
                          e.nome,
                          e.receita_rs.p5,
                          e.receita_rs.p50,
                          e.receita_rs.p95,
                          e.receita_rs.media,
                          e.p_abaixo_orcamento,
                          e.p_arrepender,
                          e.premio_rs,
                        ]),
                      },
                    ],
                  })
                }
              />
            </div>
          </div>

          <Leitura>{leitura}</Leitura>

          <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <strong>{AVISO}</strong> O forward está {formatPercent(resultado.forward_vs_spot, 2)} acima do câmbio de hoje, por causa
            do diferencial de juros (carrego de {formatBRL(resultado.carrego_rs)} no volume). A simulação não tem carrego, então
            travar tende a custar em média.
          </p>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium">Receita em R$ no vencimento (faixa de 90% por estratégia)</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={grafico} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `${formatNumber(v, 1)} mi`}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={200}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, nome: string) => (nome === "base" ? null : [`${formatNumber(v, 2)} mi (faixa)`, "Faixa p5–p95"])}
                />
                <Bar dataKey="base" stackId="faixa" fill="var(--chart-1)" fillOpacity={0} isAnimationActive={false} />
                <Bar dataKey="faixa" stackId="faixa" fill="var(--chart-1)" fillOpacity={0.6} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-medium">Estratégias comparadas</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estratégia</TableHead>
                  <TableHead>Receita p5</TableHead>
                  <TableHead>Mediana</TableHead>
                  <TableHead>Receita p95</TableHead>
                  <TableHead>Média</TableHead>
                  <TableHead>Abaixo do orçamento</TableHead>
                  <TableHead>Arrepender-se</TableHead>
                  <TableHead>Prêmio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.estrategias.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.nome}</TableCell>
                    <TableCell>{formatCompactBRL(e.receita_rs.p5)}</TableCell>
                    <TableCell>{formatCompactBRL(e.receita_rs.p50)}</TableCell>
                    <TableCell>{formatCompactBRL(e.receita_rs.p95)}</TableCell>
                    <TableCell>{formatCompactBRL(e.receita_rs.media)}</TableCell>
                    <TableCell>{formatPercent(e.p_abaixo_orcamento, 1)}</TableCell>
                    <TableCell>{formatPercent(e.p_arrepender, 1)}</TableCell>
                    <TableCell>{e.premio_rs > 0 ? formatBRL(e.premio_rs) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              Arrepender-se: a estratégia rende menos que ficar aberto no mesmo cenário. Abaixo do orçamento: taxa líquida (já com o prêmio) menor que o câmbio mínimo.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Premissas: {resultado.premissas} Volatilidade anual usada: {formatPercent(resultado.vol_anual, 1)}. Juros: Selic
            meta {formatPercent(resultado.selic_meta_aa / 100, 2)} a.a.; Fed funds {formatPercent(resultado.fed_funds_aa / 100, 2)} a.a.
          </p>
        </div>
      )}
    </div>
  );
}
