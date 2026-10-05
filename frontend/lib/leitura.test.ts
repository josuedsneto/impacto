import { describe, expect, it } from "vitest";
import {
  AUSENTE,
  leituraArima,
  leituraCall,
  leituraJump,
  leituraMonteCarlo,
  leituraPayoff,
  leituraStress,
  leituraVaR,
  leituraVolatilidade,
} from "./leitura";

describe("frases de leitura de mercado (LING-03, LING-04)", () => {
  it("VaR (LING-03 AC2)", () => {
    expect(leituraVaR({ ticker: "SB=F", confianca: 0.95, horizonte: 1, perda: 0.45, perdaPct: 0.0231 })).toBe(
      "Com 95% de confiança, a queda em 1 dia não deve passar de 0,45 ¢/lb (2,31%)."
    );
    expect(leituraVaR({ ticker: "SB=F", confianca: 0.99, horizonte: 10, perda: 1.2, perdaPct: 0.06 })).toBe(
      "Com 99% de confiança, a queda em 10 dias não deve passar de 1,20 ¢/lb (6,00%)."
    );
  });

  it("Monte Carlo (LING-03 AC3)", () => {
    expect(leituraMonteCarlo({ ticker: "SB=F", dias: 252, p5: 15.2, p50: 19.4, p95: 24.8 })).toBe(
      "Em 252 dias úteis, o preço deve ficar entre 15,20 ¢/lb e 24,80 ¢/lb em 90% dos cenários; o valor central é 19,40 ¢/lb."
    );
  });

  it("Volatilidade acima, abaixo e em linha com a média de 1 ano", () => {
    expect(leituraVolatilidade({ vol30: 0.3, vol1a: 0.2 })).toBe(
      "Nos últimos 30 dias o preço oscilou 30,00% ao ano, acima da média de 1 ano (20,00%)."
    );
    expect(leituraVolatilidade({ vol30: 0.15, vol1a: 0.2 })).toBe(
      "Nos últimos 30 dias o preço oscilou 15,00% ao ano, abaixo da média de 1 ano (20,00%)."
    );
    expect(leituraVolatilidade({ vol30: 0.21, vol1a: 0.2 })).toBe(
      "Nos últimos 30 dias o preço oscilou 21,00% ao ano, em linha com a média de 1 ano (20,00%)."
    );
  });

  it("Stress", () => {
    expect(leituraStress({ drawdown: -0.453, inicio: "2010-02-01", fim: "2012-05-15" })).toBe(
      "A pior queda da história foi de 45,30%, de 01/02/2010 a 15/05/2012."
    );
  });

  it("ARIMA", () => {
    expect(leituraArima({ ticker: "USDBRL=X", dias: 30, valor: 5.6, min: 5.2, max: 6.0 })).toBe(
      "Em 30 dias úteis o modelo projeta R$ 5,6000, com 95% de chance de ficar entre R$ 5,2000 e R$ 6,0000."
    );
  });

  it("Simulação com saltos", () => {
    expect(leituraJump({ ticker: "SB=F", s0: 20, final: 22 })).toBe(
      "Neste caminho simulado o preço sai de 20,00 ¢/lb e termina em 22,00 ¢/lb (+10,00%). Simule de novo para ver outro caminho possível."
    );
    expect(leituraJump({ ticker: "SB=F", s0: 20, final: 18 })).toContain("(-10,00%)");
  });

  it("Payoff com ponto de empate", () => {
    const precos = [10, 15, 20, 25, 30];
    const payoff = [-2, -2, -2, 3, 8];
    expect(leituraPayoff({ precos, payoff })).toBe(
      "No vencimento, o maior ganho é 8,00 e a maior perda é 2,00; a estratégia empata em 22,00."
    );
  });

  it("Payoff que não cruza o zero", () => {
    expect(leituraPayoff({ precos: [10, 20], payoff: [-1, -1] })).toBe(
      "No vencimento, o maior ganho é -1,00 e a maior perda é 1,00; a estratégia não empata na faixa simulada."
    );
  });

  it("Preço justo da call", () => {
    expect(leituraCall(1.23456)).toBe("O preço justo desta call é 1,2346 por unidade do ativo.");
  });

  it("valor ausente vira a frase padrão (edge case)", () => {
    expect(leituraVaR({ ticker: "SB=F", confianca: 0.95, horizonte: 1, perda: null, perdaPct: null })).toBe(AUSENTE);
    expect(leituraMonteCarlo({ ticker: "SB=F", dias: 252, p5: null, p50: 19, p95: 24 })).toBe(AUSENTE);
    expect(leituraVolatilidade({ vol30: null, vol1a: 0.2 })).toBe(AUSENTE);
    expect(leituraCall(null)).toBe(AUSENTE);
    expect(AUSENTE).toBe("Sem dados suficientes para este cálculo.");
  });
});
