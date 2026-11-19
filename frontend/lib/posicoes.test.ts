import { describe, expect, it } from "vitest";
import {
  AVISO_SEM_CAMBIO, AVISO_SEM_DOLAR, AVISO_SEM_PRODUCAO, gerarCsvPosicoes, linhaCsv, parseCsvPosicoes,
  parseNumero, validarPosicao, valorParaHedge, valoresParaRisco, type Exposicao, type Resumo,
} from "./posicoes";

const SAFRA = "2026/27";
const CAB = "Safra;Instrumento;Volume (t ou US$);Preço fixado (¢/lb ou R$/US$);Câmbio fixado (R$/US$);Prêmio;Vencimento;Contraparte;Observação";

describe("parseNumero", () => {
  it("aceita vírgula decimal pt-BR e milhar com ponto", () => {
    expect(parseNumero("1.234,56")).toBe(1234.56);
    expect(parseNumero("20,5")).toBe(20.5);
    expect(parseNumero("20.5")).toBe(20.5);
    // Preço com ponto é decimal; só volume/produção leem ponto como milhar.
    expect(parseNumero("5.250")).toBe(5.25);
    expect(parseNumero("1.000", true)).toBe(1000);
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
    expect(validarPosicao({ ...ok, volume: 0 })).toContain("volume deve ser maior que zero e menor que 10 trilhões");
    expect(validarPosicao({ ...ok, volume: NaN })).toContain("volume deve ser maior que zero e menor que 10 trilhões");
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
    expect(r.erros).toEqual([{ linha: 3, motivo: "volume deve ser maior que zero e menor que 10 trilhões" }]);
    expect(r.posicoes).toHaveLength(1);
  });

  it("recusa safra diferente da tela e coluna obrigatória ausente", () => {
    expect(parseCsvPosicoes(`${CAB}\n2025/26;fixacao_acucar;1;1;;;;;`, SAFRA).erros[0].motivo)
      .toContain("safra deve ser 2026/27");
    const sem = parseCsvPosicoes("Safra;Instrumento;Volume\n2026/27;fixacao_acucar;1", SAFRA);
    expect(sem.cabecalho).toContain("Preço fixado");
  });

  it("reimporta o CSV exportado (bloco de parâmetros antes da tabela)", () => {
    const resumo = {
      pct_fixado: 25, minimo_pct: 40, maximo_pct: 60, producao_estimada_t: 4000,
      preco_medio_cents_lb: 20, preco_medio_rs_t: null, mtm_total_rs: 0, status: "abaixo", avisos: [],
      sb_fechamento: 18, usdbrl_fechamento: 5, data_sb: "2026-11-17", data_usdbrl: "2026-11-17",
      posicoes: [{ id: "p1", safra: SAFRA, instrumento: "fixacao_acucar" as const, volume: 1000, preco_fixado: 20,
        cambio_fixado: 5, premio: 0, vencimento: "2027-03-15", contraparte: null, observacao: null, unidade: "t" as const, mtm_rs: 1 }],
    };
    const r = parseCsvPosicoes(gerarCsvPosicoes({ usina: "A", safra: SAFRA, resumo }), SAFRA);
    expect(r.cabecalho).toBeUndefined();
    expect(r.erros).toEqual([]);
    expect(r.posicoes[0]).toMatchObject({ instrumento: "fixacao_acucar", volume: 1000, vencimento: "2027-03-15" });
  });

  it("rejeita data que não existe (31/02)", () => {
    const r = parseCsvPosicoes(`${CAB}\n${SAFRA};fixacao_acucar;1;1;;;31/02/2027;;`, SAFRA);
    expect(r.erros[0].motivo).toContain("vencimento");
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
    expect(csv).toContain("Fixação de açúcar;2026/27;1000;20;5;0;;;\"a;b\";;;;229280,48");
    expect(csv).toContain("% fixado (%);25");
  });
});

// ── v2: tipo de opção, preenchimento das telas de risco (POS-V2-08 e 09) ──

const EX_BASE: Exposicao = {
  pct_fixado: 55, pct_travado: 45, pct_travado_rs: 20, producao_estimada_t: 4000, acucar_aberto_t: 1800,
  preco_medio_cents_lb: 20.72, preco_medio_rs_t: 500, receita_usd_estimada: 1000000,
  usd_ndf: 200000, usd_opcao_dolar: 100000, usd_protegido: 300000, usd_aberto: 700000,
  sb_fechamento: 18, usdbrl_fechamento: 5, avisos: [],
};

describe("valoresParaRisco", () => {
  it("usa o % com câmbio fixado e o preço médio em R$/t", () => {
    expect(valoresParaRisco(EX_BASE)).toEqual({ pctFixado: "20", precoFixado: "500", aviso: null });
  });
  it("limita o % a 100", () => {
    expect(valoresParaRisco({ ...EX_BASE, pct_travado_rs: 130 }).pctFixado).toBe("100");
  });
  it("sem câmbio fixado, preenche só o %, com aviso", () => {
    const r = valoresParaRisco({ ...EX_BASE, preco_medio_rs_t: null });
    expect(r.precoFixado).toBeNull();
    expect(r.aviso).toBe(AVISO_SEM_CAMBIO);
  });
  it("nada fixado: preenche 0 e não avisa de câmbio", () => {
    const r = valoresParaRisco({ ...EX_BASE, pct_travado: 0, pct_travado_rs: 0, preco_medio_rs_t: null });
    expect(r).toEqual({ pctFixado: "0", precoFixado: null, aviso: null });
  });
  it("só fixação sem câmbio: preenche 0 mas avisa (revisão da rodada 3)", () => {
    const r = valoresParaRisco({ ...EX_BASE, pct_travado: 45, pct_travado_rs: 0, preco_medio_rs_t: null });
    expect(r.pctFixado).toBe("0");
    expect(r.aviso).toBe(AVISO_SEM_CAMBIO);
  });
  it("sem produção, não preenche o %", () => {
    const r = valoresParaRisco({ ...EX_BASE, pct_travado_rs: null });
    expect(r.pctFixado).toBeNull();
    expect(r.aviso).toBe(AVISO_SEM_PRODUCAO);
  });
});

describe("valorParaHedge", () => {
  it("preenche o dólar em aberto arredondado", () => {
    expect(valorParaHedge(EX_BASE)).toEqual({ volume: "700000", aviso: null });
  });
  it("sem nada em aberto, não preenche e avisa", () => {
    expect(valorParaHedge({ ...EX_BASE, usd_aberto: 0 })).toEqual({ volume: null, aviso: AVISO_SEM_DOLAR });
  });
  it("sem produção, avisa que não calculou", () => {
    expect(valorParaHedge({ ...EX_BASE, usd_aberto: null }).volume).toBeNull();
  });
});

describe("tipo da opção", () => {
  const base = { safra: SAFRA, volume: 1000, preco_fixado: 15, cambio_fixado: null, premio: 0.5,
    vencimento: null, contraparte: null, observacao: null, tipo_opcao: null };

  it("aceita call e put só em opção", () => {
    expect(validarPosicao({ ...base, instrumento: "opcao_acucar", tipo_opcao: "call" })).toEqual([]);
    expect(validarPosicao({ ...base, instrumento: "fixacao_acucar", tipo_opcao: "put" })).toContain("tipo da opção só vale para opção");
    expect(validarPosicao({ ...base, instrumento: "opcao_dolar", tipo_opcao: "straddle" as "put" })).toContain("tipo da opção deve ser call ou put");
  });

  it("lê a coluna Tipo da opção do CSV e vazia vira nulo (put)", () => {
    const csv = `Safra;Instrumento;Volume;Preço fixado;Prêmio;Tipo da opção\n${SAFRA};opcao_dolar;100000;5,2;0;call\n${SAFRA};opcao_dolar;100000;5,2;0;`;
    const r = parseCsvPosicoes(csv, SAFRA);
    expect(r.erros).toEqual([]);
    expect(r.posicoes.map((p) => p.tipo_opcao)).toEqual(["call", null]);
  });
});
