import { describe, expect, it } from "vitest";
import {
  AUSENTE,
  leituraAtr,
  leituraBreakeven,
  leituraCenarios,
  leituraMetas,
  leituraRegAcucar,
  leituraRegDolar,
  leituraRisco,
} from "./leitura";

describe("frases de leitura de negócio (LING-03, LING-04)", () => {
  it("Cenários (LING-03 AC4)", () => {
    expect(leituraCenarios({ opcao: "NY", breakeven: 14.867, prob: 0.0423 })).toBe(
      "O EBITDA zera com o açúcar NY em 14,87 ¢/lb. A chance de ficar abaixo disso é 4,2%."
    );
    expect(leituraCenarios({ opcao: "Moagem", breakeven: 1011507.88, prob: 0.2 })).toBe(
      "O EBITDA zera com a moagem em 1.011.508 t de cana. A chance de ficar abaixo disso é 20,0%."
    );
  });

  it("probabilidade abaixo de 1% vira 'menos de 1%' (edge case)", () => {
    expect(leituraCenarios({ opcao: "Câmbio", breakeven: 3.8966, prob: 0.003 })).toBe(
      "O EBITDA zera com o câmbio em R$ 3,8966. A chance de ficar abaixo disso é menos de 1%."
    );
  });

  it("Risco sem e com risco de prejuízo", () => {
    expect(leituraRisco({ media: 27_800_000, p10: 4_100_000 })).toBe(
      "O EBITDA médio esperado é R$ 27,8 mi; em 1 de cada 10 cenários fica abaixo de R$ 4,1 mi."
    );
    expect(leituraRisco({ media: 5_000_000, p10: -2_000_000 })).toBe(
      "O EBITDA médio esperado é R$ 5 mi; em 1 de cada 10 cenários fica abaixo de -R$ 2 mi. Há risco de prejuízo."
    );
  });

  it("Metas acima e abaixo da meta", () => {
    expect(leituraMetas({ mtm: 2650, meta: 2600 })).toBe(
      "No último fechamento o açúcar valia R$ 2.650,00/t, R$ 50,00 acima da meta de R$ 2.600,00/t."
    );
    expect(leituraMetas({ mtm: 2500, meta: 2600 })).toBe(
      "No último fechamento o açúcar valia R$ 2.500,00/t, R$ 100,00 abaixo da meta de R$ 2.600,00/t."
    );
  });

  it("Breakeven do açúcar", () => {
    expect(leituraBreakeven({ acucar: 21.46, dolar: 5.4322, breakeven: 130.25 })).toBe(
      "Com açúcar a 21,46 ¢/lb e dólar a R$ 5,4322, o açúcar vale R$ 130,25/saca."
    );
  });

  it("Modelos do dólar e do açúcar", () => {
    expect(leituraRegDolar({ taxa: 5.4, rmse: 0.15 })).toBe(
      "Com estes indicadores o modelo estima o dólar em R$ 5,4000, com erro médio de R$ 0,1500 para mais ou para menos."
    );
    expect(leituraRegAcucar({ previsto: 19.4, min: 15, max: 23.8 })).toBe(
      "O modelo estima o açúcar em 19,40 ¢/lb, provavelmente entre 15,00 ¢/lb e 23,80 ¢/lb."
    );
  });

  it("ATR com e sem produção", () => {
    const base = { chuva: 120, impureza: 12.5, atr: 130.54, min: 122.3, max: 138.7 };
    expect(leituraAtr(base)).toBe(
      "Com 120,0 mm de chuva e 12,5% de impureza, o ATR esperado é 130,5 kg/t (entre 122,3 e 138,7 em 90% dos casos)."
    );
    expect(leituraAtr({ ...base, producao: 170_000 })).toBe(
      "Com 120,0 mm de chuva e 12,5% de impureza, o ATR esperado é 130,5 kg/t (entre 122,3 e 138,7 em 90% dos casos). Produção estimada: 170 mil toneladas."
    );
  });

  it("valor ausente vira a frase padrão", () => {
    expect(leituraCenarios({ opcao: "NY", breakeven: null, prob: 0.1 })).toBe(AUSENTE);
    expect(leituraRisco({ media: null, p10: 1 })).toBe(AUSENTE);
    expect(leituraMetas({ mtm: undefined, meta: 2600 })).toBe(AUSENTE);
  });
});
