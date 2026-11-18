import { describe, expect, it } from "vitest";
import { statusMercado } from "./mercado";

describe("statusMercado (YAH-05)", () => {
  it("REGULAR mostra mercado aberto", () => {
    expect(statusMercado("REGULAR").rotulo).toBe("Mercado aberto");
  });

  it("CLOSED mostra mercado fechado", () => {
    expect(statusMercado("CLOSED").rotulo).toBe("Mercado fechado");
  });

  it("UNKNOWN e qualquer valor desconhecido mostram status indisponível, não fechado", () => {
    expect(statusMercado("UNKNOWN").rotulo).toBe("Status indisponível");
    expect(statusMercado("").rotulo).toBe("Status indisponível");
  });
});
