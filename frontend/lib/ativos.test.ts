import { describe, expect, it } from "vitest";
import { nomeAtivo, unidadeAtivo } from "./ativos";

describe("ativos (LING-05)", () => {
  it("mostra o nome dos ativos conhecidos", () => {
    expect(nomeAtivo("SB=F")).toBe("Açúcar NY nº 11");
    expect(nomeAtivo("USDBRL=X")).toBe("Dólar (USD/BRL)");
    expect(nomeAtivo("CL=F")).toBe("Petróleo WTI");
  });

  it("mostra o próprio código quando o ativo não está no mapa (AC2)", () => {
    expect(nomeAtivo("PETR4.SA")).toBe("PETR4.SA");
  });

  it("devolve a unidade do preço", () => {
    expect(unidadeAtivo("SB=F")).toBe("¢/lb");
    expect(unidadeAtivo("PETR4.SA")).toBe("");
  });
});
