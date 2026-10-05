// Leitura de números digitados em pt-BR e validação de faixa (LING-02).

/**
 * "10,5" → 10.5; "1.234,5" → 1234.5; "1.300.000" → 1300000; "1234.5" → 1234.5.
 * Um único ponto sem vírgula é lido como decimal. Vazio ou inválido → null.
 */
export function lerNumero(texto: string): number | null {
  let t = texto.trim();
  if (!t) return null;
  if (t.includes(",")) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if ((t.match(/\./g) ?? []).length > 1) {
    t = t.replace(/\./g, "");
  }
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}

const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Mensagem de erro se o valor estiver ausente ou fora de [min, max]; null se estiver ok. */
export function erroFaixa(valor: number | null, min: number, max: number, unidade: string): string | null {
  if (valor === null) return "Informe um número.";
  if (valor >= min && valor <= max) return null;
  return `Use um valor entre ${num.format(min)} e ${num.format(max)}${unidade ? ` ${unidade}` : ""}.`;
}

/** Fração da API como texto em % para a tela: 0.105 → "10,5"; null → "". */
export function fracaoParaPercentual(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(Math.round(v * 1e6) / 1e4).replace(".", ",");
}
