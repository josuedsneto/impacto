"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDate, formatPercent, formatPreco } from "@/lib/format";
import { Leitura } from "@/components/ui/leitura";
import { leituraStress } from "@/lib/leitura";
import { nomeAtivo } from "@/lib/ativos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StressScenario {
  cenario: string;
  periodo_inicio: string;
  periodo_fim: string;
  drawdown_pct: number;
  preco_final: number;
}

// Queda acima de 20%: severa; de 10% a 20%: forte; abaixo: moderada.
function DrawdownBadge({ value }: { value: number }) {
  const pct = Math.abs(value);
  const texto = formatPercent(value);
  if (pct > 0.2) return <Badge variant="destructive">{texto} · severa</Badge>;
  if (pct > 0.1) return <span className="text-sm font-semibold text-negative">{texto} · forte</span>;
  return <span className="text-sm">{texto}</span>;
}

export default function StressPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [scenarios, setScenarios] = useState<StressScenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    async function fetchStress() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ ticker });
        setScenarios(await apiFetch<StressScenario[]>(`/api/stress?${params}`));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchStress();
  }, [ticker, tentativa]);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Teste de Estresse"
        descricao="As piores quedas do preço na história e em crises conhecidas (2008 e covid-19)."
      />

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Ativo:</span>
        <Select value={ticker} onValueChange={setTicker}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SB=F">{nomeAtivo("SB=F")}</SelectItem>
            <SelectItem value="USDBRL=X">{nomeAtivo("USDBRL=X")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}

      {error && <ErrorState mensagem={error} onRetry={() => setTentativa((t) => t + 1)} />}

      {!loading && !error && scenarios.length > 0 && (
        // O primeiro cenário da API é o pior drawdown de toda a história.
        <Leitura>
          {leituraStress({
            drawdown: scenarios[0].drawdown_pct,
            inicio: scenarios[0].periodo_inicio,
            fim: scenarios[0].periodo_fim,
          })}
        </Leitura>
      )}
      {!loading && !error && scenarios.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cenário</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Queda do pico ao fundo</TableHead>
                <TableHead className="text-right">Preço no fundo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.cenario}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.periodo_inicio === "N/A" ? "Sem dados no período" : `${formatDate(s.periodo_inicio)} a ${formatDate(s.periodo_fim)}`}
                  </TableCell>
                  <TableCell>
                    <DrawdownBadge value={s.drawdown_pct} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPreco(ticker, s.preco_final)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && scenarios.length === 0 && (
        <EmptyState mensagem="Nenhum cenário disponível para este ativo." />
      )}
    </div>
  );
}
