"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Usina {
  id: string;
  nome: string;
  created_at: string;
}

interface Usuario {
  id: string;
  email: string;
}

export function AtrUsinasAdmin() {
  const [usinas, setUsinas] = useState<Usina[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newUsinaName, setNewUsinaName] = useState("");
  const [creating, setCreating] = useState(false);

  // User management panel
  const [managingUsina, setManagingUsina] = useState<Usina | null>(null);
  const [usinaUserIds, setUsinaUserIds] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function fetchUsinas() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ usinas: Usina[] }>("/api/admin/usinas");
      setUsinas(data.usinas);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsuarios() {
    try {
      const data = await apiFetch<{ usuarios: Usuario[] }>("/api/admin/usuarios");
      setUsuarios(data.usuarios);
    } catch {
      // non-critical — silently ignore
    }
  }

  useEffect(() => {
    fetchUsinas();
    fetchUsuarios();
  }, []);

  async function openManage(usina: Usina) {
    setManagingUsina(usina);
    setLoadingUsers(true);
    setUsinaUserIds(new Set());
    try {
      const data = await apiFetch<{ user_ids: string[] }>(
        `/api/admin/usinas/${encodeURIComponent(usina.id)}/usuarios`
      );
      setUsinaUserIds(new Set(data.user_ids));
    } catch {
      // silently ignore
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleToggleUser(userId: string) {
    if (!managingUsina || toggling) return;
    setToggling(userId);
    try {
      const isAssociated = usinaUserIds.has(userId);
      const url = `/api/admin/usinas/${encodeURIComponent(managingUsina.id)}/usuarios/${encodeURIComponent(userId)}`;
      await apiFetch(url, { method: isAssociated ? "DELETE" : "POST" });
      setUsinaUserIds((prev) => {
        const next = new Set(prev);
        if (isAssociated) next.delete(userId);
        else next.add(userId);
        return next;
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setToggling(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsinaName.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/admin/usinas", {
        method: "POST",
        body: JSON.stringify({ nome: newUsinaName.trim() }),
      });
      setNewUsinaName("");
      toast.success("Usina criada.");
      await fetchUsinas();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja deletar esta usina?")) return;
    if (managingUsina?.id === id) setManagingUsina(null);
    try {
      await apiFetch(`/api/admin/usinas/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast.success("Usina excluída.");
      await fetchUsinas();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Usinas (ATR)</h2>

      {error && <ErrorState mensagem={error} onRetry={fetchUsinas} />}

      {/* Usinas table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
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
                  <TableCell colSpan={3}>
                    <EmptyState mensagem="Nenhuma usina cadastrada. Crie a primeira abaixo." />
                  </TableCell>
                </TableRow>
              ) : (
                usinas.map((u) => (
                  <TableRow
                    key={u.id}
                    className={managingUsina?.id === u.id ? "bg-brand/10" : ""}
                  >
                    <TableCell className="font-medium text-sm">{u.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.created_at)}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => (managingUsina?.id === u.id ? setManagingUsina(null) : openManage(u))}
                      >
                        {managingUsina?.id === u.id ? "Fechar" : "Usuários"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(u.id)}>
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* User management panel */}
      {managingUsina && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">
            Usuários com acesso a <span className="text-brand">{managingUsina.nome}</span>
          </h3>
          {loadingUsers ? (
            <p className="text-sm text-muted-foreground">Carregando usuários...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {usuarios.map((u) => {
                const active = usinaUserIds.has(u.id);
                const busy = toggling === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleToggleUser(u.id)}
                    disabled={busy}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border-input bg-background text-foreground hover:border-brand hover:text-brand",
                      busy ? "cursor-wait opacity-50" : "cursor-pointer"
                    )}
                  >
                    {u.email.split("@")[0]}
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Clique para conceder ou revogar acesso. Alterações são aplicadas imediatamente.
          </p>
        </div>
      )}

      {/* Create usina form */}
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Nova usina</h3>
        <form onSubmit={handleCreate} className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="new_usina_nome" className="text-xs text-muted-foreground">
              Nome
            </label>
            <Input
              id="new_usina_nome"
              value={newUsinaName}
              onChange={(e) => setNewUsinaName(e.target.value)}
              placeholder="Nome da usina"
              disabled={creating}
              required
            />
          </div>
          <Button type="submit" disabled={creating || !newUsinaName.trim()}>
            {creating ? "Criando..." : "Criar"}
          </Button>
        </form>
      </div>
    </section>
  );
}
