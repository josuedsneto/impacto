import { createClient } from "@/lib/supabase/client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

if (!API_URL && typeof window !== "undefined") {
  console.error("NEXT_PUBLIC_API_URL is not configured");
}

/** Token de acesso da sessão Supabase atual ("" quando não autenticado). */
export async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

/** Erro de API com o status HTTP e o `detail` retornado pelo backend. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * fetch autenticado contra a API FastAPI.
 *
 * Injeta `Authorization: Bearer <token>`, define `Content-Type: application/json`
 * quando há body, faz o parse do JSON e lança `ApiError` (com o `detail` do
 * backend) em respostas não-OK.
 *
 * @example
 * const data = await apiFetch<VolatilityResult>(`/api/volatility?ticker=${t}`);
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      (data as { detail?: string } | null)?.detail ?? res.statusText;
    throw new ApiError(detail, res.status);
  }
  return data as T;
}
