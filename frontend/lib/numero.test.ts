import { describe, expect, it } from "vitest";
import { erroFaixa, fracaoParaPercentual, lerNumero } from "./numero";

describe("lerNumero (LING-02 AC4)", () => {
  it("aceita vírgula decimal", () => {
    expect(lerNumero("10,5")).toBe(10.5);
  });

  it("aceita ponto de milhar com vírgula decimal", () => {
    expect(lerNumero("1.234,5")).toBe(1234.5);
    expect(lerNumero("1.300.000")).toBe(1300000);
  });

  it("aceita ponto decimal", () => {
    expect(lerNumero("1234.5")).toBe(1234.5);
    expect(lerNumero("0.25")).toBe(0.25);
  });

  it("aceita negativo e espaços", () => {
    expect(lerNumero(" -2,5 ")).toBe(-2.5);
  });

  it("texto vazio ou inválido vira null", () => {
    expect(lerNumero("")).toBeNull();
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("1,2,3")).toBeNull();
  });
});

describe("erroFaixa (LING-02 AC6)", () => {
  it("valor dentro da faixa não tem erro", () => {
    expect(erroFaixa(50, 1, 100, "%")).toBeNull();
  });

  it("valor fora da faixa dá a mensagem da spec", () => {
    expect(erroFaixa(150, 1, 100, "%")).toBe("Use um valor entre 1 e 100 %.");
    expect(erroFaixa(0.001, 0.01, 30, "anos")).toBe("Use um valor entre 0,01 e 30 anos.");
  });

  it("sem unidade, a frase termina no número", () => {
    expect(erroFaixa(1_300_000, 100, 50_000, "")).toBe("Use um valor entre 100 e 50.000.");
  });

  it("valor ausente pede um número", () => {
    expect(erroFaixa(null, 1, 100, "%")).toBe("Informe um número.");
  });
});

describe("fracaoParaPercentual (T11)", () => {
  it("mostra a fração salva como percentual sem ruído de ponto flutuante", () => {
    expect(fracaoParaPercentual(0.25)).toBe("25");
    expect(fracaoParaPercentual(0.105)).toBe("10,5");
    // 0.07 * 100 dá 7.000000000000001 em ponto flutuante
    expect(fracaoParaPercentual(0.07)).toBe("7");
    expect(fracaoParaPercentual(0.29)).toBe("29");
    expect(fracaoParaPercentual(null)).toBe("");
  });

  it("ida e volta: o texto digitado em % volta à mesma fração", () => {
    expect(lerNumero(fracaoParaPercentual(0.3))! / 100).toBe(0.3);
  });
});
