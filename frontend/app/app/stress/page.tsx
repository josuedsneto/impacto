"use client";

import { useEffect, useState } from "react";
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

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface StressScenario {
  cenario: string;
  periodo_inicio: string;
  periodo_fim: string;
  drawdown_pct: number;
  preco_final: number;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStress() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const params = new URLSearchParams({ ticker });
        const res = await fetch(`${API}/api/stress?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as { detail?: string }).detail ?? "Erro ao carregar cenários.");
          return;
        }
        setScenarios(data as StressScenario[]);
      } catch {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    fetchStress();
  }, [ticker]);

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
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

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
    </div>
  );
}
