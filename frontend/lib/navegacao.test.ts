// UXN-01/02 (redirects das rotas antigas) e UXN-06 (erros por campo).
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { camposDeErro } from "./api";
import { errosDaApi, errosDosCampos } from "@/components/ui/campo-numero";

describe("redirects das rotas antigas", () => {
  it("cenarios, market e fixacoes levam às rotas novas, sem redirect permanente", async () => {
    const regras = await nextConfig.redirects!();
    const porOrigem = Object.fromEntries(regras.map((r) => [r.source, r]));
    expect(porOrigem["/app/cenarios"]).toMatchObject({ destination: "/app/breakeven-safra", permanent: false });
    expect(porOrigem["/app/market"]).toMatchObject({ destination: "/app/mercado?aba=precos", permanent: false });
    expect(porOrigem["/app/fixacoes"]).toMatchObject({ destination: "/app/mercado?aba=sinais", permanent: false });
  });
});

describe("camposDeErro (422 do FastAPI)", () => {
  it("usa o último item do loc como nome do campo", () => {
    const body = { detail: [{ loc: ["body", "estoque_inicial"], msg: "x" }, { loc: ["body", "usdbrl"], msg: "y" }] };
    expect(camposDeErro(body)).toEqual({ estoque_inicial: "Valor inválido.", usdbrl: "Valor inválido." });
  });

  it("devolve undefined quando detail não é uma lista de campos", () => {
    expect(camposDeErro({ detail: "Dados insuficientes." })).toBeUndefined();
    expect(camposDeErro(null)).toBeUndefined();
  });
});

describe("erros por campo do formulário", () => {
  const campos = [
    { chave: "a", rotulo: "Câmbio", unidade: "R$/US$" },
    { chave: "b", rotulo: "Selic", unidade: "% ao ano" },
  ];
  const faixa = { min: -1000, max: 1000 };

  it("aponta vazio e fora da faixa, e não aponta campo válido", () => {
    const erros = errosDosCampos(campos, { a: "5,4", b: "" }, faixa);
    expect(Object.keys(erros)).toEqual(["b"]);
    expect(erros.b).toBe("Informe um número.");
    expect(errosDosCampos(campos, { a: "5000", b: "10" }, faixa).a).toContain("entre");
  });

  it("sem erro, o objeto é vazio (pode enviar)", () => {
    expect(errosDosCampos(campos, { a: "5,4", b: "10,5" }, faixa)).toEqual({});
  });

  it("traduz o erro da API para o rótulo em português", () => {
    expect(errosDaApi({ a: "Valor inválido.", inexistente: "x" }, campos)).toEqual({
      a: "Valor inválido para Câmbio.",
    });
  });
});
