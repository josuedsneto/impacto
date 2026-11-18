// Câmbio (USD/BRL): horizontes da tela e regras de data. Ver .specs/features/cambio-previsao/spec.md.

export const HORIZONTE_MAX_API = 262;

export interface OpcaoHorizonte {
  valor: string;
  rotulo: string;
  dias?: number;
}

export const HORIZONTES: OpcaoHorizonte[] = [
  { valor: "5", rotulo: "1 semana", dias: 5 },
  { valor: "21", rotulo: "1 mês", dias: 21 },
  { valor: "63", rotulo: "3 meses", dias: 63 },
  { valor: "126", rotulo: "6 meses", dias: 126 },
  { valor: "safra", rotulo: "Fim da safra (31/03)" },
];

/**
 * Cobertura medida no backtest para a faixa de 90% em 126 dias úteis (backtest.md).
 * Deveria conter o dólar real 90% das vezes; no teste, conteve 83%.
 */
export const COBERTURA_90_6_MESES = 83;

export const NIVEL_MIN = 0.5;
export const NIVEL_MAX = 20;
export const MAX_NIVEIS = 10;

/** Dias úteis (seg–sex, sem feriados) entre hoje e o próximo 31/03. Se hoje é 31/03 ou depois, vai para o ano seguinte. */
export function diasUteisAteFimSafra(hoje: Date = new Date()): number {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let alvo = new Date(inicio.getFullYear(), 2, 31);
  if (inicio >= alvo) alvo = new Date(inicio.getFullYear() + 1, 2, 31);

  let dias = 0;
  const cursor = new Date(inicio);
  while (cursor < alvo) {
    cursor.setDate(cursor.getDate() + 1);
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias += 1;
  }
  return Math.min(dias, HORIZONTE_MAX_API);
}

/** Converte a opção escolhida na tela no número de dias úteis enviado à API. */
export function horizonteParaApi(opcao: string, hoje: Date = new Date()): number {
  if (opcao === "safra") return diasUteisAteFimSafra(hoje);
  return Number(opcao);
}

/**
 * Lê os níveis digitados (separados por ";", decimal com vírgula, ex.: "5,20; 5,80").
 * Devolve a lista sem repetidos, ou null se algum item não for número, estiver fora de 0,5–20,
 * ou se houver mais de 10 níveis. Mesmas regras do backend.
 */
export function lerNiveis(texto: string): number[] | null {
  const itens = texto
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (itens.length === 0 || itens.length > MAX_NIVEIS) return null;
  const valores = itens.map((s) => Number(s.replace(",", ".")));
  const invalido = valores.some((v) => !Number.isFinite(v) || v < NIVEL_MIN || v > NIVEL_MAX);
  return invalido ? null : [...new Set(valores)];
}

/** Texto de niveis para a query string da API (decimal com ponto, separador vírgula). */
export function niveisParaApi(valores: number[]): string {
  return valores.map((v) => String(v)).join(",");
}
