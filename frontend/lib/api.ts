import { createClient } from "@/lib/supabase/client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

if (!process.env.NEXT_PUBLIC_API_URL && typeof window !== "undefined") {
  console.error("NEXT_PUBLIC_API_URL is not configured");
}

export const MSG_GENERICA = "Não foi possível concluir a operação. Tente novamente.";
export const MSG_REDE = "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
export const MSG_VALIDACAO = "Algum campo está fora do intervalo permitido.";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Mensagem para o usuário a partir do corpo de erro da API. */
export function mensagemDeErro(body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (Array.isArray(detail)) return MSG_VALIDACAO;
  if (typeof detail === "string" && detail) return detail;
  return MSG_GENERICA;
}

/** Só aceita voltar para dentro do app; qualquer outra coisa vai para o dashboard. */
export function destinoSeguro(voltar: string | null | undefined): string {
  return voltar && voltar.startsWith("/app/") ? voltar : "/app/dashboard";
}

let supabase: ReturnType<typeof createClient> | null = null;
function sb() {
  return (supabase ??= createClient());
}

let renovacao: Promise<boolean> | null = null;
let redirecionando = false;

// Várias chamadas recebendo 401 juntas compartilham uma única renovação.
function renovarSessao(): Promise<boolean> {
  renovacao ??= sb()
    .auth.refreshSession()
    .then(({ data, error }) => !error && !!data.session)
    .catch(() => false)
    .finally(() => setTimeout(() => (renovacao = null), 0));
  return renovacao;
}

function irParaLogin() {
  if (redirecionando || window.location.pathname === "/login") return;
  redirecionando = true;
  const voltar = window.location.pathname + window.location.search;
  window.location.assign(`/login?expirada=1&voltar=${encodeURIComponent(voltar)}`);
}

async function requisitar(path: string, init: RequestInit, timeoutMs: number) {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new ApiError(MSG_REDE, 0);
  }
}

/**
 * Chama a API com o token da sessão. Devolve o JSON em caso de sucesso e lança
 * ApiError com mensagem em português caso contrário. Em 401 renova a sessão uma
 * vez; se continuar 401, leva o usuário ao login.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 30_000, ...rest } = init;
  let res = await requisitar(path, rest, timeoutMs);

  if (res.status === 401) {
    if (await renovarSessao()) res = await requisitar(path, rest, timeoutMs);
    if (res.status === 401) {
      irParaLogin();
      throw new ApiError("Sua sessão expirou. Entre novamente para continuar.", 401);
    }
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(mensagemDeErro(body), res.status);
  return body as T;
}
