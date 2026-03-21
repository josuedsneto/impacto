"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

interface Suggestion {
  id: string;
  ticker: string;
  nome: string;
  tipo: string;
  status: string;
  backfill_status: string;
  review_note: string | null;
  adicionado_por: string | null;
  created_at: string;
}

async function getAccessToken(): Promise<string | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function SuggestionQueue() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const token = await getAccessToken();
        const res = await fetch(`${BACKEND_URL}/api/admin/suggestions?status=pending`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.detail ?? "Erro ao carregar sugestões.");
        } else {
          setSuggestions(data.suggestions ?? []);
        }
      } catch {
        toast.error("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, []);

  async function handleApprove(id: string, ticker: string) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BACKEND_URL}/api/admin/suggestions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Erro ao aprovar.");
      } else {
        toast.success(`Ticker '${ticker}' aprovado. Backfill iniciado.`);
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleReject(id: string, ticker: string) {
    const note = rejectNote[id] ?? "";
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const token = await getAccessToken();
      const res = await fetch(`${BACKEND_URL}/api/admin/suggestions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action: "reject", review_note: note }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Erro ao rejeitar.");
      } else {
        toast.success(`Ticker '${ticker}' rejeitado.`);
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sugestões Pendentes</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando sugestões...</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sugestão pendente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Ticker</th>
                  <th className="pb-2 pr-4 font-medium">Nome</th>
                  <th className="pb-2 pr-4 font-medium">Tipo</th>
                  <th className="pb-2 pr-4 font-medium">Sugerido em</th>
                  <th className="pb-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-mono">{s.ticker}</td>
                    <td className="py-3 pr-4">{s.nome || "—"}</td>
                    <td className="py-3 pr-4">{s.tipo}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3">
                      <div className="flex items-start gap-2">
                        <textarea
                          className="border rounded p-1 text-sm w-40 resize-none"
                          rows={2}
                          placeholder="Nota (opcional)"
                          value={rejectNote[s.id] ?? ""}
                          onChange={(e) =>
                            setRejectNote((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          disabled={actionLoading[s.id]}
                        />
                        <Button
                          variant="default"
                          size="sm"
                          disabled={actionLoading[s.id]}
                          onClick={() => handleApprove(s.id, s.ticker)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actionLoading[s.id]}
                          onClick={() => handleReject(s.id, s.ticker)}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
