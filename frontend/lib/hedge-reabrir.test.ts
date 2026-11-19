import { describe, expect, it } from "vitest";
import { camposDeAnalise } from "./hedge-reabrir";

const SALVA = {
  volume_usd: 1500000,
  horizonte_du: 126,
  orcamento: 5.4321,
  pct_forward: 37.5,
  strike_put: 5.1234,
  collar_k1: 5.0,
  collar_k2: 5.9,
};

describe("camposDeAnalise (PEN-01)", () => {
  it("converte cada parâmetro salvo no texto pt-BR que a tela já lê", () => {
    const c = camposDeAnalise(SALVA);
    expect(c.volume).toBe("1.500.000");
    expect(c.prazo).toBe("126");
    expect(c.orcamento).toBe("5,4321");
    expect(c.pct).toBe("37,50");
    expect(c.strikePut).toBe("5,1234");
    expect(c.k1).toBe("5,0000");
    expect(c.k2).toBe("5,9000");
  });
});

describe("camposDeAnalise (PEN-03)", () => {
  it("prazo fora de 21, 63 e 126 não é aplicado", () => {
    expect(camposDeAnalise({ horizonte_du: 90 })).not.toHaveProperty("prazo");
  });

  it("campo ausente ou nulo não entra na saída, para o chamador manter o valor atual", () => {
    const c = camposDeAnalise({ volume_usd: null, orcamento: null, collar_k1: 5 });
    expect(c).not.toHaveProperty("volume");
    expect(c).not.toHaveProperty("orcamento");
    expect(c.k1).toBe("5,0000");
  });
});
