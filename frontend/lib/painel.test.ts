import { describe, expect, it } from "vitest";
import { ordenar, URGENCIA, variacoes } from "./painel";
import { leituraPosicaoPolitica } from "./leitura";

describe("ordem de urgência dos cartões (PNL-13, AC-3)", () => {
  it("fixa a ordem do pedido", () => {
    expect(URGENCIA).toEqual(["alertas", "posicoes", "mercado", "faixa_dolar", "focus", "analises", "noticias"]);
  });

  it("ordena cartões embaralhados pela urgência", () => {
    const embaralhados = [{ id: "noticias" }, { id: "alertas" }, { id: "focus" }, { id: "mercado" }, { id: "posicoes" }, { id: "faixa_dolar" }, { id: "analises" }] as const;
    expect(ordenar([...embaralhados]).map((c) => c.id)).toEqual(URGENCIA);
  });
});

describe("variações do painel (PNL-15, AC-7)", () => {
  const rows = [
    { date: "2026-11-10", close: 80 },
    { date: "2026-11-11", close: 100 },
    { date: "2026-11-12", close: 95 },
    { date: "2026-11-17", close: 98 },
    { date: "2026-11-18", close: 110 },
  ];

  it("semana usa o fechamento de 7 dias antes, não o de ontem", () => {
    const v = variacoes(rows);
    expect(v.dia).toBeCloseTo(110 / 98 - 1, 10);
    expect(v.semana).toBeCloseTo(110 / 100 - 1, 10); // 11/11 é a referência, não 17/11
  });

  it("sem dados devolve null", () => {
    expect(variacoes([])).toEqual({ dia: null, semana: null });
    expect(variacoes([{ date: "2026-11-18", close: null }])).toEqual({ dia: null, semana: null });
  });
});

describe("texto de posição (PNL-17, AC-4)", () => {
  it("abaixo, com decimal quebrado em pt-BR", () => {
    expect(leituraPosicaoPolitica({ status: "abaixo", pct: 38.5, minimo: 50, maximo: 80, safra: "2026/27" })).toBe(
      "Você está 11,5 pontos abaixo da política de hedge da safra 2026/27."
    );
  });

  it("acima e dentro", () => {
    expect(leituraPosicaoPolitica({ status: "acima", pct: 85, minimo: 50, maximo: 80, safra: "2026/27" })).toBe(
      "Você está 5,0 pontos acima da política de hedge da safra 2026/27."
    );
    expect(leituraPosicaoPolitica({ status: "dentro", pct: 60, minimo: 50, maximo: 80, safra: "2026/27" })).toBe(
      "Você está dentro da política de hedge da safra 2026/27: 60,0% fixado."
    );
  });

  it("sem política e sem produção", () => {
    expect(leituraPosicaoPolitica({ status: "sem_politica", pct: null, minimo: null, maximo: null, safra: "2026/27" })).toBe(
      "Defina a política de hedge da safra 2026/27 para acompanhar o % fixado."
    );
    expect(leituraPosicaoPolitica({ status: "sem_producao", pct: null, minimo: null, maximo: null, safra: "2026/27" })).toBe(
      "Informe a produção estimada da safra 2026/27 na política de hedge."
    );
  });
});
