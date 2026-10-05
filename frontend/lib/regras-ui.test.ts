// Regras de UI da spec fundacao-ui, verificadas no código-fonte:
// - UI-06 AC5: sem cor literal (hex, rgb, hsl, oklch) fora de components/ui e globals.css
// - UI-02: sem toFixed em texto de tela (use lib/format.ts)
// - UI-09 AC2: <h1> só dentro do PageHeader
// Arquivos ainda não migrados ficam em PENDENTES; cada task de migração remove o seu.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");

const PENDENTES = new Set<string>([
  "app/app/admin/page.tsx",
  "app/app/atr/page.tsx",
  "app/app/params/page.tsx",
  "app/app/regressao-acucar/page.tsx",
  "app/page.tsx",
  "components/atr/AtrHistorico.tsx",
  "components/atr/AtrMetrics.tsx",
  "components/regression/AcucarMetrics.tsx",
]);

const REGRAS: { nome: string; re: RegExp; exceto?: string; so?: RegExp }[] = [
  { nome: "cor literal", re: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b|\b(?:rgba?|hsla?|oklch)\(/ },
  { nome: "toFixed", re: /\.toFixed\(/ },
  // Login e landing têm título próprio; a regra vale para as rotas /app e seus componentes.
  { nome: "<h1> fora do PageHeader", re: /<h1[\s>]/, exceto: "components/layout/PageHeader.tsx", so: /^(app\/app|components)\// },
];

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivosTsx(caminho);
    return caminho.endsWith(".tsx") ? [caminho] : [];
  });
}

const arquivos = [...arquivosTsx(join(RAIZ, "app")), ...arquivosTsx(join(RAIZ, "components"))]
  .map((a) => relative(RAIZ, a).replaceAll("\\", "/"))
  .filter((a) => !a.startsWith("components/ui/"));

export function violacoes(arquivo: string): string[] {
  const texto = readFileSync(join(RAIZ, arquivo), "utf-8");
  return REGRAS.filter((r) => r.exceto !== arquivo && (!r.so || r.so.test(arquivo)) && r.re.test(texto)).map((r) => r.nome);
}

describe("regras de UI", () => {
  it.each(arquivos.filter((a) => !PENDENTES.has(a)))("%s segue as regras", (arquivo) => {
    expect(violacoes(arquivo)).toEqual([]);
  });

  it("PENDENTES só lista arquivos que existem e ainda violam alguma regra", () => {
    const parados = [...PENDENTES].filter((a) => !arquivos.includes(a) || violacoes(a).length === 0);
    expect(parados).toEqual([]);
  });
});
