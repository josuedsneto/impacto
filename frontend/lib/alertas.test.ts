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

describe("alertas v2", () => {
  it("prob_cruzar manda prazo e probabilidade como fração", () => {
    expect(montarParams("prob_cruzar", 5.5, "acima", { horizonte: 30, probPct: 60 }))
      .toEqual({ nivel: 5.5, direcao: "acima", horizonte: 30, prob: 0.6 });
  });
  it("posicao_limite manda usina e safra, sem nível", () => {
    expect(montarParams("posicao_limite", 0, "acima", { usinaId: "u-1", safra: "2026/27" }))
      .toEqual({ usina_id: "u-1", safra: "2026/27" });
  });
  it("descreve prob_cruzar e posicao_limite", () => {
    const prob = descreverRegra({ ...base, tipo: "prob_cruzar", params: { nivel: 5.5, direcao: "acima", horizonte: 30, prob: 0.6 } });
    expect(prob).toContain("em até 30 dias úteis");
    const pos = descreverRegra({ ...base, tipo: "posicao_limite", params: { usina_id: "u", safra: "2026/27" } });
    expect(pos).toBe("Safra 2026/27 fora da faixa da política de hedge");
  });
});
