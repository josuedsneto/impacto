// Painel "Hoje": ordem de urgência dos cartões e variações do mercado (painel-hoje PNL-13, PNL-15).
import type { PriceRow } from "@/lib/types/api";

/** Do mais urgente ao menos urgente. Mudar esta ordem muda a tela; o teste em painel.test.ts a fixa. */
export const URGENCIA = ["alertas", "posicoes", "mercado", "faixa_dolar", "focus", "analises", "noticias"] as const;
export type CartaoId = (typeof URGENCIA)[number];

export function ordenar<T extends { id: CartaoId }>(cartoes: T[]): T[] {
  return [...cartoes].sort((a, b) => URGENCIA.indexOf(a.id) - URGENCIA.indexOf(b.id));
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Variação (fração, 0,012 = 1,2%) no dia e na semana. Semana = último fechamento com data
 * até 7 dias corridos antes do último dado, não o de ontem.
 */
export function variacoes(rows: PriceRow[]): { dia: number | null; semana: number | null } {
  const validas = rows.filter((r): r is PriceRow & { close: number } => r.close !== null);
  const ultimo = validas.at(-1);
  if (!ultimo) return { dia: null, semana: null };
  const prev = validas.at(-2);
  const alvo = new Date(new Date(`${ultimo.date}T00:00:00Z`).getTime() - 7 * DIA_MS).toISOString().slice(0, 10);
  const ref = [...validas].reverse().find((r) => r.date <= alvo);
  return {
    dia: prev ? ultimo.close / prev.close - 1 : null,
    semana: ref ? ultimo.close / ref.close - 1 : null,
  };
}
