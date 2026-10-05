import { describe, expect, it } from "vitest";
import {
  formatBRL,
  formatCents,
  formatCompactBRL,
  formatDate,
  formatFX,
  formatNumber,
  formatPercent,
  formatPreco,
} from "./format";

describe("format.ts (UI-01)", () => {
  it("número com milhar e vírgula decimal (AC2)", () => {
    expect(formatNumber(1234.5, 2)).toBe("1.234,50");
  });

  it("percentual a partir de fração (AC3)", () => {
    expect(formatPercent(0.0523)).toBe("5,23%");
  });

  it("moeda R$ (AC4)", () => {
    expect(formatBRL(1234.5)).toBe("R$ 1.234,50");
  });

  it("preço do açúcar em ¢/lb (AC5)", () => {
    expect(formatCents(21.456)).toBe("21,46 ¢/lb");
  });

  it("câmbio com 4 casas (AC6)", () => {
    expect(formatFX(5.43219)).toBe("R$ 5,4322");
  });

  it("valor ausente vira travessão em todas as funções (AC7)", () => {
    const fns = [formatNumber, formatBRL, formatCents, formatFX, formatPercent, formatCompactBRL, formatDate];
    for (const fn of fns) {
      expect(fn(null as never)).toBe("—");
      expect(fn(undefined as never)).toBe("—");
    }
    for (const fn of [formatNumber, formatBRL, formatCents, formatFX, formatPercent, formatCompactBRL]) {
      expect(fn(NaN)).toBe("—");
    }
  });

  it("moeda negativa (edge case)", () => {
    expect(formatBRL(-10)).toBe("-R$ 10,00");
  });

  it("abrevia valores a partir de 1 milhão (edge case)", () => {
    expect(formatCompactBRL(27_762_984)).toBe("R$ 27,8 mi");
    expect(formatCompactBRL(999_999.5)).toBe("R$ 999.999,50");
  });

  it("data ISO em dd/mm/aaaa sem deslocar o dia", () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
  });

  it("preço no formato do ativo", () => {
    expect(formatPreco("SB=F", 21.456)).toBe("21,46 ¢/lb");
    expect(formatPreco("USDBRL=X", 5.43219)).toBe("R$ 5,4322");
    expect(formatPreco("CL=F", 70.5)).toBe("70,50");
    expect(formatPreco("SB=F", null)).toBe("—");
  });
});
