"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
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
  const [success, setSuccess] = useState<string | null>(null);

  // Create form
  const [newUsinaName, setNewUsinaName] = useState("");
  const [creating, setCreating] = useState(false);

  // User management panel
  const [managingUsina, setManagingUsina] = useState<Usina | null>(null);
  const [usinaUserIds, setUsinaUserIds] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operator");
  const [inviting, setInviting] = useState(false);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function fetchUsinas() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ usinas: Usina[] }>(`/api/admin/usinas`);
      setUsinas(data.usinas);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsuarios() {
    try {
      const data = await apiFetch<{ usuarios: Usuario[] }>(`/api/admin/usuarios`);
      setUsuarios(data.usuarios);
    } catch {
      // non-critical — silently ignore
    }
  }

  useEffect(() => {
    fetchUsinas();
    fetchUsuarios();
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!managingUsina || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/usinas/${encodeURIComponent(managingUsina.id)}/invite`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail("");
      showSuccess(`Convite enviado para ${inviteEmail.trim()}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro de conexão ao enviar convite.");
    } finally {
      setInviting(false);
    }
  }

  async function openManage(usina: Usina) {
    setManagingUsina(usina);
    setInviteEmail("");
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
    setError(null);
    try {
      const isAssociated = usinaUserIds.has(userId);
      const url = `/api/admin/usinas/${encodeURIComponent(managingUsina.id)}/usuarios/${encodeURIComponent(userId)}`;

      if (isAssociated) {
        await apiFetch(url, { method: "DELETE" });
        setUsinaUserIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        await apiFetch(url, { method: "POST" });
        setUsinaUserIds((prev) => new Set([...prev, userId]));
      }
    } catch {
      setError("Erro ao atualizar associação.");
    } finally {
      setToggling(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsinaName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/usinas`, {
        method: "POST",
        body: JSON.stringify({ nome: newUsinaName.trim() }),
      });
      setNewUsinaName("");
      showSuccess("Usina criada com sucesso.");
      await fetchUsinas();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja deletar esta usina?")) return;
    setError(null);
    if (managingUsina?.id === id) setManagingUsina(null);
    try {
      await apiFetch(`/api/admin/usinas/${encodeURIComponent(id)}`, { method: "DELETE" });
      showSuccess("Usina deletada.");
      await fetchUsinas();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro de conexão com o servidor.");
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
                  <TableRow
                    key={u.id}
                    className={managingUsina?.id === u.id ? "bg-blue-50" : ""}
                  >
                    <TableCell className="font-medium text-sm">{u.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          managingUsina?.id === u.id
                            ? setManagingUsina(null)
                            : openManage(u)
                        }
                        className="px-3 py-1 rounded text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {managingUsina?.id === u.id ? "Fechar" : "Usuários"}
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="px-3 py-1 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700"
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

      {/* User management panel */}
      {managingUsina && (
        <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
          <h3 className="text-sm font-semibold">
            Usuários com acesso a <span className="text-blue-600">{managingUsina.nome}</span>
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
                    className={[
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      active
                        ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600",
                      busy ? "opacity-50 cursor-wait" : "cursor-pointer",
                    ].join(" ")}
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

          {/* Invite by email */}
          <div className="border-t pt-3 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Convidar por e-mail</h4>
            <form onSubmit={handleInvite} className="flex gap-2 items-end flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">E-mail</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="usuario@email.com"
                  required
                  disabled={inviting}
                  className="block rounded-md border border-input bg-background px-3 py-2 text-sm w-56"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Função</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  disabled={inviting}
                  className="block rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="viewer">Visualizador</option>
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {inviting ? "Enviando..." : "Enviar convite"}
              </button>
            </form>
          </div>
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
    </section>
  );
}
