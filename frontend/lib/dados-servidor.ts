// Cargas de dados feitas por Server Components (layout e dashboard).
// Toda carga devolve Carga<T>: falha vira { ok: false } com log, nunca silêncio (FD-01, FD-02).
// React.cache deduplica dentro de uma requisição: layout e dashboard pedem /api/focus uma vez (FD-04).
import { cache } from "react";
import type { FocusData, MarketStatus, PriceRow, SimulationRow } from "@/lib/types/api";

export type Carga<T> = { ok: true; dados: T } | { ok: false; erro: string };

const ERRO_CONFIG = "Serviço de dados indisponível no momento.";

/** URL absoluta http(s) sem barra final, ou null. Relativa ou vazia é erro de configuração. */
function urlBase(): string | null {
  const bruta = process.env.NEXT_PUBLIC_API_URL ?? "";
  try {
    const u = new URL(bruta);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return bruta.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

async function pedir<T>(caminho: string, token: string, revalidate: number, timeoutMs = 8000): Promise<Carga<T>> {
  const base = urlBase();
  if (!base) {
    console.error(`[dados-servidor] NEXT_PUBLIC_API_URL ausente ou não é URL absoluta; ${caminho} não foi chamado.`);
    return { ok: false, erro: ERRO_CONFIG };
  }
  try {
    const res = await fetch(`${base}${caminho}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.error(`[dados-servidor] ${caminho} respondeu HTTP ${res.status}.`);
      return { ok: false, erro: `HTTP ${res.status}` };
    }
    return { ok: true, dados: (await res.json()) as T };
  } catch (e) {
    console.error(`[dados-servidor] falha ao chamar ${caminho}:`, e);
    return { ok: false, erro: e instanceof Error ? e.message : "erro desconhecido" };
  }
}

/** Cotações diárias do último ano. Layout e dashboard usam o mesmo intervalo para compartilhar a carga. */
export const getPrecos = cache(async (ticker: string, token: string): Promise<Carga<PriceRow[]>> => {
  const end = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await pedir<{ rows?: PriceRow[] }>(
    `/api/market/prices?ticker=${encodeURIComponent(ticker)}&start=${start}&end=${end}`,
    token,
    3600,
  );
  return r.ok ? { ok: true, dados: r.dados.rows ?? [] } : r;
});

export const getFocus = cache((token: string): Promise<Carga<FocusData>> =>
  pedir<FocusData>("/api/focus", token, 3600),
);

export const getStatusMercado = cache((token: string): Promise<Carga<MarketStatus>> =>
  pedir<MarketStatus>("/api/market/status?ticker=SB%3DF", token, 60, 5000),
);

export const getSimulacoes = cache((token: string) =>
  pedir<{ simulations?: SimulationRow[] }>("/api/simulations", token, 0),
);
