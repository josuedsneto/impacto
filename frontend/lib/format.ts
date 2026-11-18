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
  return espaco(fmt({ style: "currency", currency: "BRL", notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(v));
}

/** "2026-10-05" → "05/10/2026". Datas ISO sem hora são lidas em UTC para não voltar um dia. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return VAZIO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return VAZIO;
  return new Intl.DateTimeFormat("pt-BR", iso.length === 10 ? { timeZone: "UTC" } : {}).format(d);
}

/** "2026-11-18T14:05:00Z" → "18 nov, 14:05". Para notícias e simulações salvas. */
export function formatDataHora(iso: string | null | undefined): string {
  if (!iso) return VAZIO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return VAZIO;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Hora HH:mm de um instante (ex.: hora da última atualização). */
export function formatHora(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Quantidade inteira com separador de milhar: 1234567 → "1.234.567". */
export function formatInteiro(v: Valor): string {
  if (ausente(v)) return VAZIO;
  return fmt({ maximumFractionDigits: 0 }).format(v);
}

/** Rótulo do status de mercado no header. null = falha ao consultar; UNKNOWN = backend não sabe. */
export function rotuloMercado(state: string | null | undefined): string {
  if (!state || state === "UNKNOWN") return "Status indisponível";
  return state === "REGULAR" ? "Mercado aberto" : "Mercado fechado";
}

/** Preço no formato do ativo: SB=F em ¢/lb, USDBRL=X em R$ com 4 casas, demais com 2 casas. */
export function formatPreco(ticker: string, v: Valor): string {
  if (ticker === "SB=F") return formatCents(v);
  if (ticker === "USDBRL=X") return formatFX(v);
  return formatNumber(v, 2);
}
