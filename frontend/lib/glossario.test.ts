import { describe, expect, it } from "vitest";
import { GLOSSARIO } from "./glossario";

describe("glossário (LING-07 AC1)", () => {
  it("termos em ordem alfabética", () => {
    const nomes = GLOSSARIO.map((t) => t.termo);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("cada definição tem no máximo 3 frases", () => {
    const longas = GLOSSARIO.filter((t) => t.definicao.split(/(?<=[.!?])\s+/).length > 3).map((t) => t.termo);
    expect(longas).toEqual([]);
  });

  it("ids únicos para os links do glossário", () => {
    const ids = GLOSSARIO.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cobre os termos listados no design", () => {
    const esperados = ["ATR", "Breakeven", "Call", "CBIO", "Câmbio", "Drawdown", "EBITDA", "Fixação", "Hedge",
      "Monte Carlo", "Percentil", "Prêmio", "Put", "Regressão", "Strike", "VaR", "VHP", "Volatilidade"];
    expect(GLOSSARIO.map((t) => t.termo).sort()).toEqual(esperados.sort());
  });
});
