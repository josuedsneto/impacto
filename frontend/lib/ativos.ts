// Nome e unidade de cada ativo, para a tela nunca mostrar só o código do Yahoo (LING-05).

export interface Ativo {
  nome: string;
  unidade: string;
}

export const ATIVOS: Record<string, Ativo> = {
  "SB=F": { nome: "Açúcar NY nº 11", unidade: "¢/lb" },
  "SBK26.NYB": { nome: "Açúcar NY maio/2026", unidade: "¢/lb" },
  "USDBRL=X": { nome: "Dólar (USD/BRL)", unidade: "R$/US$" },
  "CL=F": { nome: "Petróleo WTI", unidade: "US$/barril" },
};

/** Nome do ativo; para códigos fora do mapa, o próprio código. */
export function nomeAtivo(ticker: string): string {
  return ATIVOS[ticker]?.nome ?? ticker;
}

/** Unidade do preço do ativo, ou "" se desconhecida. */
export function unidadeAtivo(ticker: string): string {
  return ATIVOS[ticker]?.unidade ?? "";
}
