"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/feedback";
import { formatCompactBRL } from "@/lib/format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import {
  BarChart,
  Cell, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface VariavelInput { media: number; p15: number; p85: number; }
interface DistResult { media: number; percentis: { p: number; v: number }[]; }
interface RiscoResult { faturamento: DistResult; custo: DistResult; ebitda: DistResult; }

const DEFAULTS: Record<string, VariavelInput> = {
  moagem:       { media: 1300000, p15: 1100000, p85: 1500000 },
  atr:          { media: 125,     p15: 120,     p85: 130 },
  vhp_total:    { media: 97000,   p15: 94000,   p85: 100000 },
  ny:           { media: 21,      p15: 18,      p85: 24 },
  cambio:       { media: 5.1,     p15: 4.9,     p85: 5.3 },
  preco_cbios:  { media: 90,      p15: 75,      p85: 105 },
  preco_etanol: { media: 3000,    p15: 2500,    p85: 3500 },
};

const LABELS: Record<string, string> = {
  moagem: "Moagem Total", atr: "ATR", vhp_total: "VHP Total",
  ny: "NY (¢/lb)", cambio: "Câmbio", preco_cbios: "Preço CBIOS", preco_etanol: "Preço Etanol",
};

function VariavelRow({ name, value, onChange }: {
  name: string;
  value: VariavelInput;
  onChange: (v: VariavelInput) => void;
}) {
  return (
    <tr className="border-b">
      <td className="py-2 pr-4 text-sm font-medium whitespace-nowrap">{LABELS[name]}</td>
      {(["media", "p15", "p85"] as const).map((field) => (
        <td key={field} className="py-1 px-1">
          <Input
            type="number"
            className="h-8 text-sm w-28"
            value={value[field]}
            onChange={(e) => onChange({ ...value, [field]: parseFloat(e.target.value) })}
          />
        </td>
      ))}
    </tr>
  );
}

function PercentilChart({ data, cor, label }: { data: DistResult; cor: string; label: string }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xl font-bold tabular-nums">
          {formatCompactBRL(data.media)} <span className="text-sm font-normal text-muted-foreground">média</span>
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.percentis} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="p" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} tickFormatter={(v) => `P${v}`} />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v: number) => formatCompactBRL(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [formatCompactBRL(v), label]}
              labelFormatter={(l) => `Percentil ${l}`}
            />
            <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.percentis.map((p) => (
                // Valores negativos (prejuízo) em vermelho
                <Cell key={p.p} fill={p.v < 0 ? "var(--negative)" : cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function RiscoPage() {
  const [inputs, setInputs] = useState<Record<string, VariavelInput>>({ ...DEFAULTS });
  const [result, setResult] = useState<RiscoResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    setLoading(true);
    try {
      const data = await apiFetch<RiscoResult>("/api/risco", {
        method: "POST",
        body: JSON.stringify({ ...inputs, num_simulacoes: 10000 }),
      });
      setResult(data);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Risco do EBITDA"
        descricao="10.000 cenários de faturamento, custo e EBITDA da safra a partir das faixas de cada variável."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Inputs <FieldTooltip text="Informe a média e os percentis P15/P85 de cada variável para definir a distribuição normal." />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Variável</th>
                <th className="py-2 px-1 text-center font-medium text-muted-foreground">Média</th>
                <th className="py-2 px-1 text-center font-medium text-muted-foreground">P15</th>
                <th className="py-2 px-1 text-center font-medium text-muted-foreground">P85</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(DEFAULTS).map((key) => (
                <VariavelRow
                  key={key}
                  name={key}
                  value={inputs[key]}
                  onChange={(v) => setInputs((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
            </tbody>
          </table>
          <Button onClick={handleSimulate} disabled={loading} className="mt-4">
            {loading ? "Simulando..." : "Simular (10.000 cenários)"}
          </Button>
        </CardContent>
      </Card>

      {result ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <PercentilChart data={result.faturamento} cor="var(--chart-1)" label="Faturamento" />
          <PercentilChart data={result.custo} cor="var(--chart-2)" label="Custo" />
          <PercentilChart data={result.ebitda} cor="var(--chart-3)" label="EBITDA ajustado" />
        </div>
      ) : (
        <EmptyState mensagem="Ajuste as faixas das variáveis e clique em Simular para ver a distribuição do resultado." />
      )}
    </div>
  );
}
