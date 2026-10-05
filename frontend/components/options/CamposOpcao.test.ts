import { describe, expect, it } from "vitest";
import { CAMPOS_OPCAO_PADRAO, paraApi } from "./CamposOpcao";

describe("paraApi (LING-02 AC3)", () => {
  it("converte juros e volatilidade de % para fração e aceita vírgula", () => {
    expect(paraApi({ S: "21,5", K: "20", T: "0,25", r: "10,5", sigma: "25" })).toEqual({
      S: 21.5,
      K: 20,
      T: 0.25,
      r: 0.105,
      sigma: 0.25,
    });
  });

  it("recusa campo fora da faixa ou vazio", () => {
    expect(paraApi({ ...CAMPOS_OPCAO_PADRAO, T: "0" })).toBeNull();
    expect(paraApi({ ...CAMPOS_OPCAO_PADRAO, sigma: "" })).toBeNull();
  });
});
