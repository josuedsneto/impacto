// Frases que dizem, em português, o que o resultado de cada ferramenta significa (LING-03, LING-04).
// Os textos seguem a tabela de .specs/features/linguagem-clara/design.md.
import { formatBRL, formatCompactBRL, formatDate, formatNumber, formatPercent, formatPreco } from "@/lib/format";

type N = number | null | undefined;

export const AUSENTE = "Sem dados suficientes para este cálculo.";

const falta = (...vs: N[]) => vs.some((v) => v === null || v === undefined || Number.isNaN(v));

const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

// ── Mercado ─────────────────────────────────────────────────────────────────

export function leituraVaR(r: { ticker: string; confianca: number; horizonte: number; perda: N; perdaPct: N }) {
  if (falta(r.perda, r.perdaPct)) return AUSENTE;
  return `Com ${formatPercent(r.confianca, 0)} de confiança, a queda em ${dias(r.horizonte)} não deve passar de ${formatPreco(r.ticker, r.perda)} (${formatPercent(r.perdaPct)}).`;
}

export function leituraMonteCarlo(r: { ticker: string; dias: number; p5: N; p50: N; p95: N }) {
  if (falta(r.p5, r.p50, r.p95)) return AUSENTE;
  const p = (v: N) => formatPreco(r.ticker, v);
  return `Em ${r.dias} dias úteis, o preço deve ficar entre ${p(r.p5)} e ${p(r.p95)} em 90% dos cenários; o valor central é ${p(r.p50)}.`;
}

/** "Em linha" quando a diferença relativa para a média de 1 ano é menor que 10%. */
export function leituraVolatilidade(r: { vol30: N; vol1a: N }) {
  if (falta(r.vol30, r.vol1a) || !r.vol1a) return AUSENTE;
  const rel = (r.vol30! - r.vol1a) / r.vol1a;
  const comparacao = Math.abs(rel) < 0.1 ? "em linha com a média" : rel > 0 ? "acima da média" : "abaixo da média";
  return `Nos últimos 30 dias o preço oscilou ${formatPercent(r.vol30)} ao ano, ${comparacao} de 1 ano (${formatPercent(r.vol1a)}).`;
}

export function leituraStress(r: { drawdown: N; inicio: string; fim: string }) {
  if (falta(r.drawdown) || !r.inicio || r.inicio === "N/A") return AUSENTE;
  return `A pior queda da história foi de ${formatPercent(Math.abs(r.drawdown!))}, de ${formatDate(r.inicio)} a ${formatDate(r.fim)}.`;
}

export function leituraArima(r: { ticker: string; dias: number; valor: N; min: N; max: N }) {
  if (falta(r.valor, r.min, r.max)) return AUSENTE;
  const p = (v: N) => formatPreco(r.ticker, v);
  return `Em ${r.dias} dias úteis o modelo projeta ${p(r.valor)}, com 95% de chance de ficar entre ${p(r.min)} e ${p(r.max)}.`;
}

export function leituraJump(r: { ticker: string; s0: N; final: N }) {
  if (falta(r.s0, r.final) || !r.s0) return AUSENTE;
  const variacao = (r.final! - r.s0) / r.s0;
  const sinal = variacao > 0 ? "+" : "";
  return `Neste caminho simulado o preço sai de ${formatPreco(r.ticker, r.s0)} e termina em ${formatPreco(r.ticker, r.final)} (${sinal}${formatPercent(variacao)}). Simule de novo para ver outro caminho possível.`;
}

/** Pontos onde o payoff cruza o zero, por interpolação linear entre preços vizinhos. */
function empates(precos: number[], payoff: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < precos.length; i++) {
    const [a, b] = [payoff[i - 1], payoff[i]];
    if (a === 0 && (i === 1 || payoff[i - 2] !== 0)) out.push(precos[i - 1]);
    else if (a * b < 0) out.push(precos[i - 1] + ((precos[i] - precos[i - 1]) * -a) / (b - a));
  }
  return out;
}

export function leituraPayoff(r: { precos: number[]; payoff: number[] }) {
  if (!r.payoff.length) return AUSENTE;
  const max = Math.max(...r.payoff);
  const min = Math.min(...r.payoff);
  const zeros = empates(r.precos, r.payoff).map((p) => formatNumber(p, 2));
  const empate = zeros.length
    ? `a estratégia empata em ${zeros.join(" e ")}`
    : "a estratégia não empata na faixa simulada";
  return `No vencimento, o maior ganho é ${formatNumber(max, 2)} e a maior perda é ${formatNumber(Math.abs(min), 2)}; ${empate}.`;
}

export function leituraCall(preco: N) {
  if (falta(preco)) return AUSENTE;
  return `O preço justo desta call é ${formatNumber(preco, 4)} por unidade do ativo.`;
}

// ── Negócio ─────────────────────────────────────────────────────────────────

const VARIAVEL: Record<string, { nome: string; fmt: (v: number) => string }> = {
  NY: { nome: "o açúcar NY", fmt: (v) => formatPreco("SB=F", v) },
  "Câmbio": { nome: "o câmbio", fmt: (v) => formatPreco("USDBRL=X", v) },
  Moagem: { nome: "a moagem", fmt: (v) => `${formatNumber(v, 0)} t de cana` },
  "Preço Etanol": { nome: "o etanol", fmt: (v) => `${formatBRL(v)}/m³` },
};

/** Probabilidade legível: abaixo de 1% vira "menos de 1%". */
export function probabilidade(p: number): string {
  return p < 0.01 ? "menos de 1%" : formatPercent(p, 1);
}

export function leituraCenarios(r: { opcao: string; breakeven: N; prob: N }) {
  const v = VARIAVEL[r.opcao];
  if (!v || falta(r.breakeven, r.prob)) return AUSENTE;
  return `O EBITDA zera com ${v.nome} em ${v.fmt(r.breakeven!)}. A chance de ficar abaixo disso é ${probabilidade(r.prob!)}.`;
}

export function leituraRisco(r: { media: N; p10: N }) {
  if (falta(r.media, r.p10)) return AUSENTE;
  const frase = `O EBITDA médio esperado é ${formatCompactBRL(r.media)}; em 1 de cada 10 cenários fica abaixo de ${formatCompactBRL(r.p10)}.`;
  return r.p10! < 0 ? `${frase} Há risco de prejuízo.` : frase;
}

export function leituraMetas(r: { mtm: N; meta: number }) {
  if (falta(r.mtm)) return AUSENTE;
  const dif = r.mtm! - r.meta;
  const posicao = dif === 0 ? "igual à meta" : `${formatBRL(Math.abs(dif))} ${dif > 0 ? "acima" : "abaixo"} da meta de ${formatBRL(r.meta)}/t`;
  return `No último fechamento o açúcar valia ${formatBRL(r.mtm)}/t, ${posicao}.`;
}

export function leituraBreakeven(r: { acucar: N; dolar: N; breakeven: N }) {
  if (falta(r.acucar, r.dolar, r.breakeven)) return AUSENTE;
  return `Com açúcar a ${formatPreco("SB=F", r.acucar)} e dólar a ${formatPreco("USDBRL=X", r.dolar)}, o açúcar vale ${formatBRL(r.breakeven)}/saca.`;
}

export function leituraRegDolar(r: { taxa: N; rmse: N }) {
  if (falta(r.taxa, r.rmse)) return AUSENTE;
  return `Com estes indicadores o modelo estima o dólar em ${formatPreco("USDBRL=X", r.taxa)}, com erro médio de ${formatPreco("USDBRL=X", r.rmse)} para mais ou para menos.`;
}

export function leituraRegAcucar(r: { previsto: N; min: N; max: N }) {
  if (falta(r.previsto, r.min, r.max)) return AUSENTE;
  const p = (v: N) => formatPreco("SB=F", v);
  return `O modelo estima o açúcar em ${p(r.previsto)}, provavelmente entre ${p(r.min)} e ${p(r.max)}.`;
}

export function leituraAtr(r: { chuva: N; impureza: N; atr: N; min: N; max: N; producao?: N }) {
  if (falta(r.chuva, r.impureza, r.atr, r.min, r.max)) return AUSENTE;
  const frase =
    `Com ${formatNumber(r.chuva, 1)} mm de chuva e ${formatNumber(r.impureza, 1)}% de impureza, o ATR esperado é ` +
    `${formatNumber(r.atr, 1)} kg/t (entre ${formatNumber(r.min, 1)} e ${formatNumber(r.max, 1)} em 90% dos casos).`;
  return falta(r.producao) ? frase : `${frase} Produção estimada: ${formatNumber(r.producao! / 1000, 0)} mil toneladas.`;
}
