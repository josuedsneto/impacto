// Textos e regras da tela de alertas (.specs/features/alertas). Números passam por lib/format.ts.
import { formatNumber, formatPreco } from "@/lib/format";

export type TipoAlerta = "preco_cruza" | "variacao_diaria" | "vol_acima" | "prob_cruzar" | "posicao_limite";

export interface Regra {
  id: string;
  tipo: TipoAlerta;
  ticker: string;
  params: Record<string, unknown>;
  cooldown_horas: number;
  ativo: boolean;
  ultimo_estado: boolean | null;
  ultimo_disparo: string | null;
}

export interface Evento {
  id: string;
  rule_id: string;
  dia: string;
  valor: number | null;
  mensagem: string;
  enviado: boolean;
  erro: string | null;
  created_at: string;
}

export const LIMITE_REGRAS = 20;

export const TIPOS: { valor: TipoAlerta; rotulo: string }[] = [
  { valor: "preco_cruza", rotulo: "Preço cruza um nível" },
  { valor: "variacao_diaria", rotulo: "Variação do dia" },
  { valor: "vol_acima", rotulo: "Volatilidade de 30 dias acima de" },
  { valor: "prob_cruzar", rotulo: "Chance de tocar um nível em alguns dias" },
  { valor: "posicao_limite", rotulo: "% fixado da safra fora da política" },
];

/** Frase curta da condição, para a tabela de regras. */
export function descreverRegra(r: Regra): string {
  const p = r.params;
  if (r.tipo === "preco_cruza") {
    const lado = p.direcao === "acima" ? "acima" : "abaixo";
    return `Preço ${lado} de ${formatPreco(r.ticker, Number(p.nivel))}`;
  }
  if (r.tipo === "variacao_diaria") return `Variação do dia de ${formatNumber(Number(p.pct))}% ou mais`;
  if (r.tipo === "prob_cruzar") {
    const lado = p.direcao === "acima" ? "acima" : "abaixo";
    return `Chance de tocar ${formatNumber(Number(p.nivel))} (${lado}) em até ${p.horizonte} dias úteis: ${formatNumber(Number(p.prob) * 100)}% ou mais`;
  }
  if (r.tipo === "posicao_limite") return `Safra ${p.safra} fora da faixa da política de hedge`;
  return `Volatilidade de 30 dias de ${formatNumber(Number(p.pct))}% ou mais`;
}

export interface ExtrasAlerta {
  /** prob_cruzar: dias úteis (1 a 252). */
  horizonte?: number;
  /** prob_cruzar: probabilidade em % (0 a 100); vai para a API como fração. */
  probPct?: number;
  /** posicao_limite. */
  usinaId?: string;
  safra?: string;
}

/** Monta params da API a partir do que o usuário preencheu (valores numéricos já convertidos). */
export function montarParams(
  tipo: TipoAlerta,
  nivel: number,
  direcao: "acima" | "abaixo",
  extras: ExtrasAlerta = {},
): Record<string, unknown> {
  if (tipo === "preco_cruza") return { nivel, direcao };
  if (tipo === "prob_cruzar") return { nivel, direcao, horizonte: extras.horizonte, prob: (extras.probPct ?? 0) / 100 };
  if (tipo === "posicao_limite") return { usina_id: extras.usinaId, safra: extras.safra };
  return { pct: nivel };
}
