import { describe, expect, it } from "vitest";
import { gerarCsvPosicoes, linhaCsv, parseCsvPosicoes, parseNumero, validarPosicao, type Resumo } from "./posicoes";

const SAFRA = "2026/27";
const CAB = "Safra;Instrumento;Volume (t ou US$);Preço fixado (¢/lb ou R$/US$);Câmbio fixado (R$/US$);Prêmio;Vencimento;Contraparte;Observação";

describe("parseNumero", () => {
  it("aceita vírgula decimal pt-BR e milhar com ponto", () => {
    expect(parseNumero("1.234,56")).toBe(1234.56);
    expect(parseNumero("20,5")).toBe(20.5);
    expect(parseNumero("20.5")).toBe(20.5);
    expect(parseNumero("1.000")).toBe(1000);
  });
  it("vazio é null e lixo é NaN", () => {
    expect(parseNumero("  ")).toBeNull();
    expect(parseNumero("abc")).toBeNaN();
  });
});

describe("linhaCsv", () => {
  it("respeita aspas com ; e aspa interna duplicada", () => {
    expect(linhaCsv('a;"b;c";"d ""e"""')).toEqual(["a", "b;c", 'd "e"']);
  });
});

describe("validarPosicao", () => {
  const ok = { safra: SAFRA, instrumento: "fixacao_acucar" as const, volume: 1000, preco_fixado: 20,
    cambio_fixado: 5, premio: 0, vencimento: null, contraparte: null, observacao: null };
  it("aceita posição válida", () => expect(validarPosicao(ok)).toEqual([]));
  it("rejeita volume zero, NaN e instrumento inválido", () => {
    expect(validarPosicao({ ...ok, volume: 0 })).toContain("volume deve ser maior que zero");
    expect(validarPosicao({ ...ok, volume: NaN })).toContain("volume deve ser maior que zero");
    expect(validarPosicao({ ...ok, instrumento: "x" as never })).toContain("instrumento desconhecido");
  });
});

describe("parseCsvPosicoes", () => {
  it("lê linhas válidas em pt-BR, com rótulo ou código de instrumento e data dd/mm/aaaa", () => {
    const csv = `﻿${CAB}\r\n${SAFRA};Fixação de açúcar;1.000;20,5;5,1;;15/03/2027;Trading X;\r\n${SAFRA};ndf_dolar;500000;5,2;;;;;`;
    const r = parseCsvPosicoes(csv, SAFRA);
    expect(r.cabecalho).toBeUndefined();
    expect(r.erros).toEqual([]);
    expect(r.posicoes).toHaveLength(2);
    expect(r.posicoes[0]).toMatchObject({ volume: 1000, preco_fixado: 20.5, cambio_fixado: 5.1, vencimento: "2027-03-15", contraparte: "Trading X" });
    expect(r.posicoes[1].instrumento).toBe("ndf_dolar");
  });

  it("aponta o número da linha do arquivo com erro e não devolve nenhuma posição válida parcial", () => {
    const csv = `${CAB}\n${SAFRA};fixacao_acucar;1000;20;;;;;\n${SAFRA};opcao_acucar;0;15;;;;;`;
    const r = parseCsvPosicoes(csv, SAFRA);
    expect(r.erros).toEqual([{ linha: 3, motivo: "volume deve ser maior que zero" }]);
    expect(r.posicoes).toHaveLength(1);
  });

  it("recusa safra diferente da tela e coluna obrigatória ausente", () => {
    expect(parseCsvPosicoes(`${CAB}\n2025/26;fixacao_acucar;1;1;;;;;`, SAFRA).erros[0].motivo)
      .toContain("safra deve ser 2026/27");
    const sem = parseCsvPosicoes("Safra;Instrumento;Volume\n2026/27;fixacao_acucar;1", SAFRA);
    expect(sem.cabecalho).toContain("Preço fixado");
  });

  it("recusa mais de 500 linhas", () => {
    const linhas = Array.from({ length: 501 }, () => `${SAFRA};fixacao_acucar;1;1;;;;;`).join("\n");
    expect(parseCsvPosicoes(`${CAB}\n${linhas}`, SAFRA).cabecalho).toContain("500");
  });
});

describe("gerarCsvPosicoes", () => {
  const resumo: Resumo = {
    pct_fixado: 25, minimo_pct: 40, maximo_pct: 60, producao_estimada_t: 4000,
    preco_medio_cents_lb: 20, preco_medio_rs_t: 2290.48, mtm_total_rs: 229280.48, status: "abaixo", avisos: [],
    sb_fechamento: 18, usdbrl_fechamento: 5, data_sb: "2026-11-17", data_usdbrl: "2026-11-17",
    posicoes: [{
      id: "p1", safra: SAFRA, instrumento: "fixacao_acucar", volume: 1000, preco_fixado: 20, cambio_fixado: 5,
      premio: 0, vencimento: null, contraparte: "a;b", observacao: null, unidade: "t", mtm_rs: 229280.48,

    }],
  };
  it("traz BOM, separador ; e números com vírgula decimal", () => {
    const csv = gerarCsvPosicoes({ usina: "Usina A", safra: SAFRA, resumo });
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Instrumento;Safra;");
    expect(csv).toContain("Fixação de açúcar;2026/27;1000;20;5;0;;\"a;b\";;229280,48");
    expect(csv).toContain("% fixado (%);25");
  });
});
