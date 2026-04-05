"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, formatBrDate, formatBrNumber, isoToday, printPage } from "@/lib/export";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface StressScenario {
  cenario: string;
  periodo_inicio: string;
  periodo_fim: string;
  drawdown_pct: number;
  preco_final: number;
}

function buildStressRows(scenarios: StressScenario[]): string[][] {
  const header = ["Cenario", "Periodo_Inicio", "Periodo_Fim", "Drawdown_Pct", "Preco_Final"];
  const rows = scenarios.map(s => [
    s.cenario,
    formatBrDate(s.periodo_inicio),
    formatBrDate(s.periodo_fim),
    formatBrNumber(s.drawdown_pct * 100, 2),
    formatBrNumber(s.preco_final),
  ]);
  return [header, ...rows];
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function DrawdownBadge({ value }: { value: number }) {
  const pct = Math.abs(value * 100);
  if (pct > 20) {
    return (
      <Badge variant="destructive">{(value * 100).toFixed(2)}%</Badge>
    );
  }
  if (pct > 10) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
        {(value * 100).toFixed(2)}%
      </Badge>
    );
  }
  return <span className="text-sm">{(value * 100).toFixed(2)}%</span>;
}

export default function StressPage() {
  const [ticker, setTicker] = useState("SB=F");
  const [scenarios, setScenarios] = useState<StressScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({ ticker });
      const res = await fetch(`${API}/api/stress?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { detail?: string; error?: string }).detail ?? data.error ?? "Erro ao carregar cenários.");
        return;
      }
      setScenarios(data as StressScenario[]);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Erro de conexão com o servidor.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Teste de Estresse</h1>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Ativo:</span>
        <Select value={ticker} onValueChange={setTicker}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SB=F">Açúcar NY</SelectItem>
            <SelectItem value="USDBRL=X">USD/BRL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3">
                <Skeleton className="h-4 w-1/2 mb-1" />
                <Skeleton className="h-6 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={fetchData} />}

      {!loading && !error && scenarios.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cenário</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Drawdown (%)</TableHead>
                <TableHead>Preço Final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scenarios.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{s.cenario}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.periodo_inicio} – {s.periodo_fim}
                  </TableCell>
                  <TableCell>
                    <DrawdownBadge value={s.drawdown_pct} />
                  </TableCell>
                  <TableCell>{s.preco_final.toFixed(4)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && scenarios.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum cenário disponível.</p>
      )}

      <div className="flex gap-2 mt-4 no-print">
        <Button
          variant="outline"
          size="sm"
          disabled={!scenarios || scenarios.length === 0}
          className="no-print"
          onClick={() => {
            if (!scenarios || scenarios.length === 0) return;
            const slug = ticker === "SB=F" ? "acucar" : "dolar";
            downloadCsv(buildStressRows(scenarios), `${slug}_stress_${isoToday()}.csv`);
          }}
        >
          <Download className="w-4 h-4 mr-1.5" />
          Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={printPage} className="no-print">
          <Printer className="w-4 h-4 mr-1.5" />
          Imprimir PDF
        </Button>
      </div>
    </div>
  );
}
