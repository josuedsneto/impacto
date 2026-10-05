// EXP-04: toda ferramenta com resultado tabular ou série oferece "Exportar CSV".
// Telas ainda não migradas ficam em PENDENTES; cada task remove as suas.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");

const TELAS = [
  "app/app/simulation/page.tsx",
  "app/app/jump-diffusion/page.tsx",
  "app/app/var/page.tsx",
  "app/app/volatilidade/page.tsx",
  "app/app/stress/page.tsx",
  "app/app/arima/page.tsx",
  "app/app/risco/page.tsx",
  "app/app/cenarios/page.tsx",
  "app/app/metas/page.tsx",
  "app/app/breakeven/page.tsx",
  "app/app/regressao-dolar/page.tsx",
  "app/app/regressao-acucar/page.tsx",
  "app/app/atr/page.tsx",
  "app/app/fixacoes/page.tsx",
];

const PENDENTES = new Set<string>([
  "app/app/var/page.tsx",
  "app/app/volatilidade/page.tsx",
  "app/app/stress/page.tsx",
  "app/app/arima/page.tsx",
  "app/app/risco/page.tsx",
  "app/app/cenarios/page.tsx",
  "app/app/metas/page.tsx",
  "app/app/breakeven/page.tsx",
  "app/app/regressao-dolar/page.tsx",
  "app/app/regressao-acucar/page.tsx",
  "app/app/atr/page.tsx",
  "app/app/fixacoes/page.tsx",
]);

const exporta = (tela: string) => readFileSync(join(RAIZ, tela), "utf-8").includes("<BotaoExportar");

describe("exportar CSV (EXP-04)", () => {
  it.each(TELAS.filter((t) => !PENDENTES.has(t)))("%s tem o botão Exportar CSV", (tela) => {
    expect(exporta(tela)).toBe(true);
  });

  it("PENDENTES só lista telas que ainda não exportam", () => {
    expect([...PENDENTES].filter(exporta)).toEqual([]);
  });
});
