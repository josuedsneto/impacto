// ANA-03/08: as quatro ferramentas têm "Salvar análise" e a tela está no menu.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");
const ler = (arquivo: string) => readFileSync(join(RAIZ, arquivo), "utf-8");

const FERRAMENTAS_SALVAVEIS = [
  "app/app/var/page.tsx",
  "app/app/breakeven/page.tsx",
  "app/app/risco/page.tsx",
  "app/app/options/page.tsx",
];

describe("Salvar análise (ANA-03)", () => {
  it.each(FERRAMENTAS_SALVAVEIS)("%s tem o botão BotaoSalvarAnalise", (tela) => {
    expect(ler(tela)).toContain("<BotaoSalvarAnalise");
  });

  it("breakeven não salva mais pelo endpoint antigo", () => {
    expect(ler("app/app/breakeven/page.tsx")).not.toContain("/api/breakeven/save");
  });
});

describe("Minhas análises (ANA-08)", () => {
  it("o menu tem a entrada da tela", () => {
    expect(ler("components/layout/NavLinks.tsx")).toContain('href: "/app/analises"');
  });

  it("a tela imprime só a área de relatório", () => {
    expect(ler("app/app/analises/page.tsx")).toContain("@media print");
  });
});
