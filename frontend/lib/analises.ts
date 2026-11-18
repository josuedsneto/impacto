// Análises salvas: regras de título, comparação (até 3) e relatório. Spec: .specs/features/minhas-analises.
import { formatNumber, formatPercent } from "@/lib/format";

export const FERRAMENTAS = {
  var: "VaR",
  breakeven: "Breakeven do açúcar",
  risco: "Risco do EBITDA",
  opcoes: "Opções",
} as const;

export type Ferramenta = keyof typeof FERRAMENTAS;
export type Valor = string | number | boolean | null;

export interface Analise {
  id: string;
  ferramenta: Ferramenta;
  titulo: string;
  parametros: Record<string, Valor>;
  resultado_resumo: Record<string, Valor>;
  data_referencia: string;
  created_at: string;
}

export const TITULO_MAX = 120;
export const MAX_COMPARACAO = 3;

// Rótulo, formato e casas decimais de cada campo salvo. Campo fora da lista aparece com a chave crua.
const CAMPOS: Record<string, { rotulo: string; pct?: boolean; casas?: number }> = {
  ticker: { rotulo: "Ativo" },
  confianca: { rotulo: "Nível de confiança", pct: true, casas: 0 },
  ultimo_preco: { rotulo: "Último preço" },
  perda_historica_valor: { rotulo: "Perda máxima histórica" },
  perda_historica_pct: { rotulo: "Perda máxima histórica (%)", pct: true },
  perda_parametrica_valor: { rotulo: "Perda máxima paramétrica" },
  perda_parametrica_pct: { rotulo: "Perda máxima paramétrica (%)", pct: true },
  nome: { rotulo: "Nome" },
  acucar_cents_lb: { rotulo: "Açúcar NY (¢/lb)" },
  dolar_brl: { rotulo: "Câmbio (R$/US$)" },
  fator: { rotulo: "Fator ¢/lb → R$/saca", casas: 5 },
  breakeven_brl_saca: { rotulo: "Breakeven (R$/saca)" },
  pernas: { rotulo: "Pernas", casas: 0 },
  lucro_maximo: { rotulo: "Lucro máximo" },
  perda_maxima: { rotulo: "Perda máxima" },
};

export function validaTitulo(titulo: string): string | null {
  const t = titulo.trim();
  if (!t) return "Dê um título para a análise.";
  if (t.length > TITULO_MAX) return `O título pode ter até ${TITULO_MAX} caracteres.`;
  return null;
}

/** Motivo para não marcar `nova` na lista de comparação, ou null se pode. */
export function motivoNaoMarcar(selecionadas: Analise[], nova: Analise): string | null {
  if (selecionadas.length >= MAX_COMPARACAO) return `Compare no máximo ${MAX_COMPARACAO} análises.`;
  if (selecionadas.length && selecionadas[0].ferramenta !== nova.ferramenta)
    return "Só dá para comparar análises da mesma ferramenta.";
  return null;
}

export function podeComparar(selecionadas: Analise[]): boolean {
  return selecionadas.length >= 2 && selecionadas.length <= MAX_COMPARACAO;
}

export function formatarCampo(chave: string, v: Valor | undefined): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "string") return v;
  const c = CAMPOS[chave];
  if (c?.pct) return formatPercent(v, c.casas ?? 2);
  return formatNumber(v, c?.casas ?? 2);
}

export function rotuloCampo(chave: string): string {
  return CAMPOS[chave]?.rotulo ?? chave;
}

/** Tabela de comparação: uma coluna por análise, uma linha por campo (sem a frase de leitura). */
export function montarComparacao(analises: Analise[]) {
  const chaves = (lado: "parametros" | "resultado_resumo") => {
    const set = new Set<string>();
    analises.forEach((a) => Object.keys(a[lado]).forEach((k) => set.add(k)));
    return [...set].filter((k) => k !== "leitura");
  };
  const linhas = [
    ...chaves("parametros").map((k) => ({
      rotulo: rotuloCampo(k),
      valores: analises.map((a) => formatarCampo(k, a.parametros[k])),
    })),
    ...chaves("resultado_resumo").map((k) => ({
      rotulo: rotuloCampo(k),
      valores: analises.map((a) => formatarCampo(k, a.resultado_resumo[k])),
    })),
  ];
  return { colunas: analises.map((a) => a.titulo), linhas };
}

/** Pares rótulo/valor das premissas, para o relatório. */
export function premissas(a: Analise): { rotulo: string; valor: string }[] {
  return Object.keys(a.parametros).map((k) => ({ rotulo: rotuloCampo(k), valor: formatarCampo(k, a.parametros[k]) }));
}

/** Pares rótulo/valor do resultado (sem a frase de leitura), para o relatório. */
export function resultadoDe(a: Analise): { rotulo: string; valor: string }[] {
  return Object.keys(a.resultado_resumo)
    .filter((k) => k !== "leitura")
    .map((k) => ({ rotulo: rotuloCampo(k), valor: formatarCampo(k, a.resultado_resumo[k]) }));
}

/** Frase de leitura gravada no salvamento (vazia se a análise não tem). */
export function leituraDe(a: Analise): string {
  const l = a.resultado_resumo.leitura;
  return typeof l === "string" ? l : "";
}

/** Data local (AAAA-MM-DD) de um instante ISO. Cortar a string daria o dia em UTC (errado após 21h no Brasil). */
export function dataLocalDe(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Id da análise a reabrir, vindo de `?reabrir=<id>`. */
export function idReabertura(search: string): string | null {
  return new URLSearchParams(search).get("reabrir");
}
