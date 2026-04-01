"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface FocusRow {
  data_referencia: string;
  mediana: number;
  data: string;
}

interface FocusResponse {
  indicador: string;
  rows: FocusRow[];
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function FocusPage() {
  const [rows, setRows] = useState<FocusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFocus() {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/focus`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data: FocusResponse = await res.json();
        if (!res.ok) {
          setError((data as { detail?: string }).detail ?? "Erro ao carregar dados do Focus.");
          return;
        }
        setRows(data.rows);
      } catch {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    fetchFocus();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-2xl font-semibold">
        Expectativa de Mercado — IPCA (Focus/BCB)
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Projeções de IPCA</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 rounded bg-muted animate-pulse"
                />
              ))}
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum dado disponível.
            </p>
          )}
          {!loading && !error && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ano de Referência</TableHead>
                  <TableHead className="text-right">Mediana (%)</TableHead>
                  <TableHead className="text-right">Última Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">
                      {row.data_referencia}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.mediana.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(row.data).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
