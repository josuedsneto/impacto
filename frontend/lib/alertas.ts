// Textos e regras da tela de alertas (.specs/features/alertas). Números passam por lib/format.ts.
import { formatNumber, formatPreco } from "@/lib/format";

export type TipoAlerta = "preco_cruza" | "variacao_diaria" | "vol_acima" | "prob_cruzar" | "posicao_limite" | "sinal_tecnico";

export type IndicadorSinal = "rsi" | "bollinger" | "macd" | "stoch" | "cci" | "sma" | "ema";
export type SentidoSinal = "compra" | "venda";

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
  { valor: "sinal_tecnico", rotulo: "Sinal técnico (RSI, Bollinger, médias…)" },
  { valor: "posicao_limite", rotulo: "% fixado da safra fora da política" },
];

export const INDICADORES: { valor: IndicadorSinal; rotulo: string }[] = [
  { valor: "rsi", rotulo: "RSI (sobrecompra e sobrevenda)" },
  { valor: "bollinger", rotulo: "Bandas de Bollinger" },
  { valor: "macd", rotulo: "MACD" },
  { valor: "stoch", rotulo: "Estocástico" },
  { valor: "cci", rotulo: "CCI" },
  { valor: "sma", rotulo: "Cruzamento de médias simples (20 e 50)" },
  { valor: "ema", rotulo: "Cruzamento de médias exponenciais (9 e 21)" },
];

const ROTULO_INDICADOR: Record<string, string> = Object.fromEntries(INDICADORES.map((i) => [i.valor, i.rotulo.split(" (")[0]]));

/** Frase curta da condição, para a tabela de regras. */
export function descreverRegra(r: Regra): string {
  const p = r.params;
  if (r.tipo === "preco_cruza") {
    const lado = p.direcao === "acima" ? "acima" : "abaixo";
    const margem = Number(p.margem_pct ?? 0);
    const rearme = margem > 0 ? `, volta a valer ao recuar ${formatNumber(margem)}% além do nível` : "";
    return `Preço ${lado} de ${formatPreco(r.ticker, Number(p.nivel))}${rearme}`;
  }
  if (r.tipo === "variacao_diaria") return `Variação do dia de ${formatNumber(Number(p.pct))}% ou mais`;
  if (r.tipo === "prob_cruzar") {
    const lado = p.direcao === "acima" ? "acima" : "abaixo";
    const prob = Number(p.prob);
    const rearme = Number(p.margem ?? Math.min(0.05, prob / 2));
    return `Chance de tocar ${formatNumber(Number(p.nivel))} (${lado}) em até ${p.horizonte} dias úteis: ${formatNumber(prob * 100)}% ou mais, volta a valer abaixo de ${formatNumber((prob - rearme) * 100)}%`;
  }
  if (r.tipo === "sinal_tecnico") {
    const sentido = p.sentido === "compra" ? "de compra" : "de venda";
    return `Sinal técnico de ${ROTULO_INDICADOR[String(p.indicador)] ?? String(p.indicador)} ${sentido} no último fechamento`;
  }
  if (r.tipo === "posicao_limite") return `Safra ${p.safra} fora da faixa da política de hedge`;
  return `Volatilidade de 30 dias de ${formatNumber(Number(p.pct))}% ou mais`;
}

export interface ExtrasAlerta {
  /** prob_cruzar: dias úteis (1 a 252). */
  horizonte?: number;
  /** prob_cruzar: probabilidade em % (0 a 100); vai para a API como fração. */
  probPct?: number;
  /** prob_cruzar: margem para rearmar, em pontos percentuais (0 a 20); vai como fração. Padrão 5. */
  margemPp?: number;
  /** preco_cruza: margem para rearmar, em % além do nível (0 a 20). Padrão 0. */
  margemPct?: number;
  /** sinal_tecnico. */
  indicador?: IndicadorSinal;
  sentido?: SentidoSinal;
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
  if (tipo === "preco_cruza") return { nivel, direcao, margem_pct: extras.margemPct ?? 0 };
  if (tipo === "prob_cruzar") {
    return {
      nivel, direcao, horizonte: extras.horizonte, prob: (extras.probPct ?? 0) / 100,
      margem: (extras.margemPp ?? 5) / 100,
    };
  }
  if (tipo === "sinal_tecnico") return { indicador: extras.indicador, sentido: extras.sentido };
  if (tipo === "posicao_limite") return { usina_id: extras.usinaId, safra: extras.safra };
  return { pct: nivel };
}
