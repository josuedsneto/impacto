"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ConfigEntry {
  key: string;
  value: string;
  description: string;
}

function ConfigRow({ entry }: { entry: ConfigEntry }) {
  const [value, setValue] = useState(entry.value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch(`/api/admin/config/${encodeURIComponent(entry.key)}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success(`${entry.key} salvo.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{entry.key}</TableCell>
      <TableCell>
        <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label={entry.key} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{entry.description}</TableCell>
      <TableCell>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : saved ? "Salvo!" : "Salvar"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function AdminConfig() {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ config: ConfigEntry[] }>("/api/admin/config");
        setEntries(data.config);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, [tentativa]);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Configurações do sistema</h2>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      )}

      {error && <ErrorState mensagem={error} onRetry={() => setTentativa((t) => t + 1)} />}

      {!loading && !error && entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chave</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <ConfigRow key={entry.key} entry={entry} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma configuração disponível.</p>
      )}
    </section>
  );
}
