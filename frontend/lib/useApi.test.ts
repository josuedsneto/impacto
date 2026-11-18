import { describe, expect, it } from "vitest";
import { buscar } from "./useApi";

describe("buscar (base do useApi, FD-06)", () => {
  it("devolve os dados quando a API responde", async () => {
    await expect(buscar("/api/x", async () => ({ preco: 21.5 }))).resolves.toEqual({
      dados: { preco: 21.5 },
      carregando: false,
      erro: null,
    });
  });

  it("devolve a mensagem em português em vez de lançar", async () => {
    const msg = "O servidor demorou demais para responder. Tente novamente.";
    const r = await buscar("/api/x", async () => {
      throw new Error(msg);
    });
    expect(r).toEqual({ dados: null, carregando: false, erro: msg });
  });
});
