// CSV no padrão do Excel em português (AD-004): BOM UTF-8, ";" como separador,
// vírgula decimal sem separador de milhar e CRLF. Gerado no navegador.

export type Celula = string | number | null | undefined;

export interface Tabela {
  colunas: string[];
  linhas: Celula[][];
}

const BOM = "﻿";
const FIM = "\r\n";

function celula(v: Celula): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    // Até 6 casas; o Excel pt-BR lê "1234,5" como número.
    return String(Math.round(v * 1e6) / 1e6 || 0).replace(".", ",");
  }
  // Texto que começa com = + - @ seria executado como fórmula ao abrir no Excel.
  const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[;"\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const linha = (cs: Celula[]) => cs.map(celula).join(";") + FIM;

/** Parâmetros usados (se houver), linha vazia e as tabelas, separadas por linha vazia. */
export function gerarCsv({ parametros = [], tabelas }: { parametros?: [string, Celula][]; tabelas: Tabela[] }): string {
  const partes: string[] = [];
  if (parametros.length) {
    partes.push(linha(["Parâmetro", "Valor"]) + parametros.map((p) => linha(p)).join(""));
  }
  for (const t of tabelas) {
    partes.push(linha(t.colunas) + t.linhas.map(linha).join(""));
  }
  return BOM + partes.join(FIM);
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** "<ferramenta>_<ativo>_<AAAA-MM-DD>.csv", sem acentos nem espaços. */
export function nomeArquivo(ferramenta: string, ativo: string | null | undefined, data = new Date()): string {
  const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
  return [slug(ferramenta).toLowerCase(), ativo ? slug(ativo) : null, dia].filter(Boolean).join("_") + ".csv";
}

/** Dispara o download do arquivo no navegador. */
export function baixarCsv(nome: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
