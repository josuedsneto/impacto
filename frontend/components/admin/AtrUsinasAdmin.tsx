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

interface Usina {
  id: string;
  nome: string;
  created_at: string;
}

async function getAccessToken(): Promise<string> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function AtrUsinasAdmin() {
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create usina form
  const [newUsinaName, setNewUsinaName] = useState("");
  const [creating, setCreating] = useState(false);

  // Associate user form
  const [selectedUsinaId, setSelectedUsinaId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [associating, setAssociating] = useState(false);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function fetchUsinas() {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/admin/usinas`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { detail?: string }).detail ?? "Erro ao carregar usinas.");
        return;
      }
      setUsinas(data as Usina[]);
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsinas();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsinaName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/admin/usinas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ nome: newUsinaName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { detail?: string }).detail ?? "Erro ao criar usina.");
        return;
      }
      setNewUsinaName("");
      showSuccess("Usina criada com sucesso.");
      await fetchUsinas();
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja deletar esta usina?")) return;
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/admin/usinas/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json();
        setError((data as { detail?: string }).detail ?? "Erro ao deletar usina.");
        return;
      }
      showSuccess("Usina deletada.");
      await fetchUsinas();
    } catch {
      setError("Erro de conexão com o servidor.");
    }
  }

  async function handleAssociate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUsinaId || !targetUserId.trim()) return;
    setAssociating(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API}/api/admin/usinas/${encodeURIComponent(selectedUsinaId)}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: targetUserId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { detail?: string }).detail ?? "Erro ao associar usuário.");
        return;
      }
      setTargetUserId("");
      showSuccess("Usuário associado com sucesso.");
    } catch {
      setError("Erro de conexão com o servidor.");
    } finally {
      setAssociating(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Usinas ATR</h2>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      {/* Usinas table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usinas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma usina cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                usinas.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-sm">{u.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="px-3 py-1 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Deletar
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create usina form */}
      <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
        <h3 className="text-sm font-semibold">Nova Usina</h3>
        <form onSubmit={handleCreate} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="new_usina_nome" className="text-xs text-muted-foreground">
              Nome
            </label>
            <input
              id="new_usina_nome"
              type="text"
              value={newUsinaName}
              onChange={(e) => setNewUsinaName(e.target.value)}
              placeholder="Nome da usina"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={creating}
              required
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newUsinaName.trim()}
            className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar"}
          </button>
        </form>
      </div>

      {/* Associate user form */}
      <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
        <h3 className="text-sm font-semibold">Associar Usuário a Usina</h3>
        <form onSubmit={handleAssociate} className="flex gap-2 items-end flex-wrap">
          <div className="space-y-1">
            <label htmlFor="assoc_usina" className="text-xs text-muted-foreground">
              Usina
            </label>
            <select
              id="assoc_usina"
              value={selectedUsinaId}
              onChange={(e) => setSelectedUsinaId(e.target.value)}
              className="block rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={associating || usinas.length === 0}
              required
            >
              <option value="">Selecionar usina</option>
              {usinas.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-1">
            <label htmlFor="assoc_user_id" className="text-xs text-muted-foreground">
              User ID (UUID)
            </label>
            <input
              id="assoc_user_id"
              type="text"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="UUID do usuário"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              disabled={associating}
              required
            />
          </div>
          <button
            type="submit"
            disabled={associating || !selectedUsinaId || !targetUserId.trim()}
            className="px-4 py-2 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {associating ? "Associando..." : "Associar"}
          </button>
        </form>
      </div>
    </section>
  );
}
