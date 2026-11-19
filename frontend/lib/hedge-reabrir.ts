import type { Valor } from "@/lib/analises";
import { formatNumber } from "@/lib/format";

/** Prazos que a tela oferece (dias úteis). Prazo salvo fora desta lista não é aplicado. */
export const PRAZOS_HEDGE = ["21", "63", "126"] as const;

export interface CamposHedge {
  volume: string;
  prazo: string;
  orcamento: string;
  pct: string;
  strikePut: string;
  k1: string;
  k2: string;
}

/**
 * PEN-01/PEN-03: converte os parâmetros de uma análise salva de hedge_cambial nos campos da tela.
 * Campo ausente, nulo ou fora de formato não entra na saída: o chamador mantém o valor atual.
 */
export function camposDeAnalise(p: Record<string, Valor>): Partial<CamposHedge> {
  const saida: Partial<CamposHedge> = {};
  if (typeof p.volume_usd === "number") saida.volume = formatNumber(p.volume_usd, 0);
  if (p.horizonte_du != null && (PRAZOS_HEDGE as readonly string[]).includes(String(p.horizonte_du))) {
    saida.prazo = String(p.horizonte_du);
  }
  if (typeof p.orcamento === "number") saida.orcamento = formatNumber(p.orcamento, 4);
  if (typeof p.pct_forward === "number") saida.pct = formatNumber(p.pct_forward, 2);
  if (typeof p.strike_put === "number") saida.strikePut = formatNumber(p.strike_put, 4);
  if (typeof p.collar_k1 === "number") saida.k1 = formatNumber(p.collar_k1, 4);
  if (typeof p.collar_k2 === "number") saida.k2 = formatNumber(p.collar_k2, 4);
  return saida;
}
