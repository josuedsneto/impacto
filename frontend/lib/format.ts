// Formatação de números para exibição em pt-BR. Toda tela usa estas funções (AD-008).

type Valor = number | null | undefined;

const VAZIO = "—";

function ausente(v: Valor): v is null | undefined {
  return v === null || v === undefined || Number.isNaN(v);
}

// Intl separa "R$" do número com espaço não separável; o app usa espaço comum.
const espaco = (s: string) => s.replace(/ /g, " ");

const fmt = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat("pt-BR", opts);

export function formatNumber(v: Valor, casas = 2): string {
  if (ausente(v)) return VAZIO;
  return fmt({ minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
}

export function formatBRL(v: Valor): string {
  if (ausente(v)) return VAZIO;
  return espaco(fmt({ style: "currency", currency: "BRL" }).format(v));
}

export function formatCents(v: Valor): string {
  if (ausente(v)) return VAZIO;
  return `${formatNumber(v, 2)} ¢/lb`;
}

export function formatFX(v: Valor): string {
  if (ausente(v)) return VAZIO;
  return `R$ ${formatNumber(v, 4)}`;
}

/** Recebe fração (0.0523) e devolve "5,23%". */
export function formatPercent(v: Valor, casas = 2): string {
  if (ausente(v)) return VAZIO;
  return fmt({ style: "percent", minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
}

/** R$ abreviado a partir de 1 milhão ("R$ 27,8 mi"); abaixo disso, valor completo. */
export function formatCompactBRL(v: Valor): string {
  if (ausente(v)) return VAZIO;
  if (Math.abs(v) < 1_000_000) return formatBRL(v);
  return espaco(fmt({ style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v));
}

/** "2026-10-05" → "05/10/2026". Datas ISO sem hora são lidas em UTC para não voltar um dia. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return VAZIO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return VAZIO;
  return new Intl.DateTimeFormat("pt-BR", iso.length === 10 ? { timeZone: "UTC" } : {}).format(d);
}

/** Preço no formato do ativo: SB=F em ¢/lb, USDBRL=X em R$ com 4 casas, demais com 2 casas. */
export function formatPreco(ticker: string, v: Valor): string {
  if (ticker === "SB=F") return formatCents(v);
  if (ticker === "USDBRL=X") return formatFX(v);
  return formatNumber(v, 2);
}
