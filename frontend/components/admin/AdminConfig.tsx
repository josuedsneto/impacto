"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface ConfigEntry {
  key: string;
  value: string;
  description: string;
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function ConfigRow({ entry }: { entry: ConfigEntry }) {
  const [value, setValue] = useState(entry.value);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/admin/config/${encodeURIComponent(entry.key)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError((data as { detail?: string }).detail ?? "Erro ao salvar.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{entry.key}</TableCell>
      <TableCell>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{entry.description}</TableCell>
      <TableCell>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Salvando…" : saved ? "Salvo!" : "Salvar"}
        </button>
      </TableCell>
    </TableRow>
  );
}

export function AdminConfig() {
  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API}/api/admin/config`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as { detail?: string }).detail ?? "Erro ao carregar configurações.");
          return;
        }
        setEntries(data as ConfigEntry[]);
      } catch {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Configurações do Sistema</h2>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && entries.length > 0 && (
        <div className="rounded-md border">
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
