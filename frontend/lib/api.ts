import { createClient } from "@/lib/supabase/client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

if (!process.env.NEXT_PUBLIC_API_URL && typeof window !== "undefined") {
  console.error("NEXT_PUBLIC_API_URL is not configured");
}

export const MSG_GENERICA = "Não foi possível concluir a operação. Tente novamente.";
export const MSG_REDE = "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
export const MSG_TIMEOUT = "O servidor demorou demais para responder. Tente novamente.";
export const MSG_VALIDACAO = "Algum campo está fora do intervalo permitido.";

export class ApiError extends Error {
  /** Erro por campo (422 do Pydantic): nome do campo na API → "Valor inválido.". */
  campos?: Record<string, string>;
  constructor(message: string, public status: number, campos?: Record<string, string>) {
    super(message);
    this.campos = campos;
  }
}

/** Campos apontados pelo 422 do FastAPI: detail = [{ loc: ["body", "campo"], msg }]. */
export function camposDeErro(body: unknown): Record<string, string> | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (!Array.isArray(detail)) return undefined;
  const campos: Record<string, string> = {};
  for (const item of detail) {
    const loc = (item as { loc?: unknown }).loc;
    if (!Array.isArray(loc)) continue;
    const nome = loc.filter((p) => typeof p === "string").at(-1);
    if (typeof nome === "string") campos[nome] = "Valor inválido.";
  }
  return Object.keys(campos).length ? campos : undefined;
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
  // Cancelamento do chamador (init.signal) e tempo limite valem juntos.
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  try {
    return await fetch(`${API_URL}${path}`, { ...init, headers, signal });
  } catch (e) {
    // Cancelado pelo chamador: não é erro de rede, o chamador decide o que mostrar.
    if (init.signal?.aborted) throw new DOMException("Cancelado pelo usuário", "AbortError");
    // Estourou o tempo limite: não é falta de conexão (FD-08).
    if (timeout.aborted || (e instanceof DOMException && e.name === "TimeoutError")) throw new ApiError(MSG_TIMEOUT, 0);
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
  // Cancelado depois que os cabeçalhos chegaram: não devolve corpo vazio como sucesso.
  if (rest.signal?.aborted) throw new DOMException("Cancelado pelo usuário", "AbortError");
  if (!res.ok) throw new ApiError(mensagemDeErro(body), res.status, camposDeErro(body));
  return body as T;
}
