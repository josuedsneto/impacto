import { describe, expect, it } from "vitest";
import { gerarCsv, nomeArquivo } from "./csv";

const BOM = "﻿";

describe("gerarCsv (EXP-02, EXP-03)", () => {
  const csv = gerarCsv({
    parametros: [["Ativo", "Açúcar NY nº 11"], ["Dias", 252]],
    tabelas: [{ colunas: ["Dia", "P50 (¢/lb)"], linhas: [[1, 19.4], [2, -1234.5]] }],
  });

  it("começa com BOM UTF-8 (AC4)", () => {
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it("usa ; como separador e CRLF como quebra de linha (AC4)", () => {
    expect(csv.slice(1).split("\r\n")).toEqual([
      "Parâmetro;Valor",
      "Ativo;Açúcar NY nº 11",
      "Dias;252",
      "",
      "Dia;P50 (¢/lb)",
      "1;19,4",
      "2;-1234,5",
      "",
    ]);
  });

  it("números com vírgula decimal e sem separador de milhar (AC5)", () => {
    expect(gerarCsv({ tabelas: [{ colunas: ["v"], linhas: [[1234567.891234567]] }] })).toContain("\r\n1234567,891235\r\n");
  });

  it("parâmetros vêm antes da tabela (AC7)", () => {
    expect(csv.indexOf("Parâmetro;Valor")).toBeLessThan(csv.indexOf("Dia;P50"));
  });

  it("texto com ;, aspas ou quebra de linha vai entre aspas com aspas duplicadas (AC8)", () => {
    const t = gerarCsv({ tabelas: [{ colunas: ["nome"], linhas: [['Cenário "A"; alto'], ["linha\nnova"]] }] });
    expect(t).toContain('\r\n"Cenário ""A""; alto"\r\n');
    expect(t).toContain('\r\n"linha\nnova"\r\n');
  });

  it("null, undefined e NaN viram célula vazia (edge case)", () => {
    const t = gerarCsv({ tabelas: [{ colunas: ["a", "b", "c"], linhas: [[null, undefined, NaN]] }] });
    expect(t).toContain("\r\n;;\r\n");
  });

  it("texto que começa com = + - @ não vira fórmula no Excel", () => {
    const t = gerarCsv({ tabelas: [{ colunas: ["x"], linhas: [["=1+1"], ["@SOMA(A1)"]] }] });
    expect(t).toContain("\r\n'=1+1\r\n");
    expect(t).toContain("\r\n'@SOMA(A1)\r\n");
  });

  it("várias tabelas separadas por linha vazia, sem parâmetros", () => {
    const t = gerarCsv({ tabelas: [{ colunas: ["a"], linhas: [[1]] }, { colunas: ["b"], linhas: [[2]] }] });
    expect(t.slice(1)).toBe("a\r\n1\r\n\r\nb\r\n2\r\n");
  });
});

describe("nomeArquivo (EXP-01 AC3)", () => {
  it("<ferramenta>_<ativo>_<AAAA-MM-DD>.csv sem acentos nem espaços", () => {
    expect(nomeArquivo("Monte Carlo", "SB=F", new Date(2026, 9, 5))).toBe("monte-carlo_SB-F_2026-10-05.csv");
    expect(nomeArquivo("Risco do EBITDA", null, new Date(2026, 0, 9))).toBe("risco-do-ebitda_2026-01-09.csv");
    expect(nomeArquivo("Previsão de preço", "USDBRL=X", new Date(2026, 9, 5))).toBe("previsao-de-preco_USDBRL-X_2026-10-05.csv");
  });
});
