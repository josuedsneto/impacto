"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

export function SuggestionQueue() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const data = await apiFetch<{ suggestions?: Suggestion[] }>(
          `/api/admin/suggestions?status=pending`
        );
        setSuggestions(data.suggestions ?? []);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    }
    fetchSuggestions();
  }, []);

  async function handleApprove(id: string, ticker: string) {
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await apiFetch(`/api/admin/suggestions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve" }),
      });
      toast.success(`Ticker '${ticker}' aprovado. Backfill iniciado.`);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleReject(id: string, ticker: string) {
    const note = rejectNote[id] ?? "";
    setActionLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await apiFetch(`/api/admin/suggestions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", review_note: note }),
      });
      toast.success(`Ticker '${ticker}' rejeitado.`);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
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
