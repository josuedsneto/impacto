import { describe, expect, it } from "vitest";
import { descreverRegra, montarParams, type Regra } from "./alertas";
import { formatNumber } from "./format";

const base: Omit<Regra, "tipo" | "params"> = {
  id: "r1", ticker: "SB=F", cooldown_horas: 24, ativo: true, ultimo_estado: false, ultimo_disparo: null,
};

describe("descreverRegra", () => {
  it("descreve nível e direção de preço", () => {
    const txt = descreverRegra({ ...base, tipo: "preco_cruza", params: { nivel: 15, direcao: "abaixo" } });
    expect(txt.startsWith("Preço abaixo de ")).toBe(true);
  });
  it("descreve variação e volatilidade com a casa decimal do app", () => {
    expect(descreverRegra({ ...base, tipo: "variacao_diaria", params: { pct: 2.5 } }))
      .toBe(`Variação do dia de ${formatNumber(2.5)}% ou mais`);
    expect(descreverRegra({ ...base, tipo: "vol_acima", params: { pct: 30 } }))
      .toBe(`Volatilidade de 30 dias de ${formatNumber(30)}% ou mais`);
  });
});

describe("montarParams", () => {
  it("usa nivel e direcao em preço, e pct nos demais", () => {
    expect(montarParams("preco_cruza", 14.5, "acima")).toEqual({ nivel: 14.5, direcao: "acima" });
    expect(montarParams("vol_acima", 30, "acima")).toEqual({ pct: 30 });
  });
});
