// ANA-04/05/06: regras de título, comparação (até 3 da mesma ferramenta) e reabertura.
import { describe, expect, it } from "vitest";
import {
  Analise,
  idReabertura,
  leituraDe,
  montarComparacao,
  motivoNaoMarcar,
  podeComparar,
  resultadoDe,
  validaTitulo,
} from "@/lib/analises";

const base = (over: Partial<Analise> = {}): Analise => ({
  id: "a1",
  ferramenta: "var",
  titulo: "VaR jan",
  parametros: { ticker: "SB=F", confianca: 0.95 },
  resultado_resumo: { ultimo_preco: 20, perda_historica_valor: 1.5, leitura: "Frase." },
  data_referencia: "2026-11-17",
  created_at: "2026-11-18T10:00:00Z",
  ...over,
});

describe("validaTitulo", () => {
  it("recusa vazio, só espaços e mais de 120 caracteres", () => {
    expect(validaTitulo("")).not.toBeNull();
    expect(validaTitulo("   ")).not.toBeNull();
    expect(validaTitulo("x".repeat(121))).not.toBeNull();
  });

  it("aceita título comum e o de 120 caracteres exatos", () => {
    expect(validaTitulo("VaR jan")).toBeNull();
    expect(validaTitulo("x".repeat(120))).toBeNull();
  });
});

describe("motivoNaoMarcar (até 3, mesma ferramenta)", () => {
  it("recusa a quarta marcação", () => {
    const tres = [base({ id: "1" }), base({ id: "2" }), base({ id: "3" })];
    expect(motivoNaoMarcar(tres, base({ id: "4" }))).toMatch(/no máximo 3/);
  });

  it("recusa ferramenta diferente da já marcada", () => {
    expect(motivoNaoMarcar([base()], base({ id: "b", ferramenta: "risco" }))).toMatch(/mesma ferramenta/);
  });

  it("aceita a mesma ferramenta até o limite", () => {
    expect(motivoNaoMarcar([], base())).toBeNull();
    expect(motivoNaoMarcar([base()], base({ id: "2" }))).toBeNull();
  });

  it("só compara com 2 ou 3 selecionadas", () => {
    expect(podeComparar([base()])).toBe(false);
    expect(podeComparar([base(), base({ id: "2" })])).toBe(true);
  });
});

describe("montarComparacao", () => {
  it("usa título como coluna e preenche campo ausente com travessão", () => {
    const a = base({ titulo: "A" });
    const b = base({ id: "2", titulo: "B", parametros: { ticker: "SB=F" }, resultado_resumo: { leitura: "x" } });
    const { colunas, linhas } = montarComparacao([a, b]);
    expect(colunas).toEqual(["A", "B"]);
    const confianca = linhas.find((l) => l.rotulo === "Nível de confiança");
    expect(confianca?.valores[1]).toBe("—");
  });

  it("não inclui a frase de leitura na tabela", () => {
    const { linhas } = montarComparacao([base()]);
    expect(linhas.some((l) => l.rotulo.toLowerCase().includes("leitura"))).toBe(false);
    expect(linhas.some((l) => l.rotulo === "leitura")).toBe(false);
  });
});

describe("resultadoDe e leituraDe", () => {
  it("resultado sai sem a frase; leitura é a frase salva", () => {
    expect(resultadoDe(base()).map((r) => r.rotulo)).not.toContain("leitura");
    expect(leituraDe(base())).toBe("Frase.");
    expect(leituraDe(base({ resultado_resumo: {} }))).toBe("");
  });
});

describe("idReabertura (ANA-05)", () => {
  it("lê o id de ?reabrir=", () => {
    expect(idReabertura("?reabrir=abc-123")).toBe("abc-123");
  });

  it("sem parâmetro devolve null", () => {
    expect(idReabertura("")).toBeNull();
    expect(idReabertura("?outro=1")).toBeNull();
  });
});
