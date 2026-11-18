// DEC-19: a rota de cron só aceita o segredo exato e falha fechada sem segredo.
import { describe, expect, it } from "vitest";
import { cronAutorizado } from "./cron";

describe("cronAutorizado", () => {
  it("aceita o Bearer exato", () => {
    expect(cronAutorizado("Bearer segredo-123", "segredo-123")).toBe(true);
  });
  it("recusa segredo errado, de tamanho diferente ou ausente", () => {
    expect(cronAutorizado("Bearer segredo-124", "segredo-123")).toBe(false);
    expect(cronAutorizado("Bearer segredo", "segredo-123")).toBe(false);
    expect(cronAutorizado(null, "segredo-123")).toBe(false);
  });
  it("recusa tudo quando CRON_SECRET não está configurado (sem aceitar 'Bearer undefined')", () => {
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
  });
});
