import { describe, expect, it } from "vitest";
import { AUSENTE, leituraCambio } from "./leitura";
import { diasUteisAteFimSafra, horizonteParaApi, lerNiveis, niveisParaApi } from "./cambio";

describe("diasUteisAteFimSafra", () => {
  it("conta só dias úteis: de sexta 26/03/2027 até quarta 31/03/2027 são 3 (seg, ter, qua)", () => {
    expect(diasUteisAteFimSafra(new Date(2027, 2, 26))).toBe(3);
  });

  it("de segunda 29/03/2027 até 31/03/2027 são 2 dias úteis", () => {
    expect(diasUteisAteFimSafra(new Date(2027, 2, 29))).toBe(2);
  });

  it("em 31/03 vai para o 31/03 do ano seguinte (ano de ~260 dias úteis, respeita o teto da API)", () => {
    const n = diasUteisAteFimSafra(new Date(2027, 2, 31));
    expect(n).toBeGreaterThanOrEqual(255);
    expect(n).toBeLessThanOrEqual(262);
  });
});

describe("horizonteParaApi", () => {
  it("usa o número da opção e calcula a safra", () => {
    expect(horizonteParaApi("63")).toBe(63);
    expect(horizonteParaApi("safra", new Date(2027, 2, 26))).toBe(3);
  });
});

describe("lerNiveis e niveisParaApi", () => {
  it("lê decimal com vírgula e separador ponto e vírgula", () => {
    expect(lerNiveis("5,20; 5,80")).toEqual([5.2, 5.8]);
  });

  it("devolve null para vazio, item que não é número, fora de 0,5–20 ou mais de 10 níveis", () => {
    expect(lerNiveis("")).toBeNull();
    expect(lerNiveis("5,2; abc")).toBeNull();
    expect(lerNiveis("0,3")).toBeNull();
    expect(lerNiveis("25")).toBeNull();
    expect(lerNiveis(Array(11).fill("5").join(";"))).toBeNull();
  });

  it("remove níveis repetidos", () => {
    expect(lerNiveis("5,2; 5,2; 5,8")).toEqual([5.2, 5.8]);
  });

  it("monta a query com ponto decimal", () => {
    expect(niveisParaApi([5.2, 5.8])).toBe("5.2,5.8");
  });
});

describe("leituraCambio", () => {
  it("sem spot ou faixa, devolve a mensagem de dados ausentes", () => {
    expect(leituraCambio({ horizonte: 21, spot: null, p5: 5, p95: 6, forward: null })).toBe(AUSENTE);
  });

  it("diz o horizonte, a faixa de 90% e o preço de travar sem chamar de previsão", () => {
    const texto = leituraCambio({ horizonte: 63, spot: 5.1, p5: 4.9, p95: 5.4, forward: 5.2 });
    expect(texto).toContain("63 dias úteis");
    expect(texto).toContain("em 90% dos cenários simulados");
    expect(texto).toContain("preço de travar hoje, não previsão");
  });

  it("omite a frase do preço de travar quando o forward não existe", () => {
    const texto = leituraCambio({ horizonte: 21, spot: 5.1, p5: 4.9, p95: 5.4, forward: null });
    expect(texto).not.toContain("travar");
  });
});
