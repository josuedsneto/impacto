// Regras de linguagem da spec linguagem-clara, verificadas no código-fonte:
// - LING-02: nada de <input type="number"> (recusa vírgula); use CampoNumero
// - LING-01 AC2: rótulos sem nome de variável de código ou símbolo como texto principal
// - LING-03/04: toda ferramenta mostra a frase de leitura (<Leitura>)
// Arquivos ainda não migrados ficam em PENDENTES; cada task remove os seus.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");

const PENDENTES = new Set<string>([
  "app/app/arima/page.tsx",
  "app/app/atr/page.tsx",
  "app/app/breakeven/page.tsx",
  "app/app/cenarios/page.tsx",
  "app/app/market/page.tsx",
  "app/app/metas/page.tsx",
  "app/app/regressao-acucar/page.tsx",
  "app/app/regressao-dolar/page.tsx",
  "app/app/risco/page.tsx",
  "app/app/stress/page.tsx",
  "app/app/var/page.tsx",
  "app/app/volatilidade/page.tsx",
  "components/admin/SuggestionQueue.tsx",
  "components/atr/AtrForm.tsx",
  "components/market/IndicatorSelector.tsx",
  "components/params/ParamsForm.tsx",
  "components/regression/AcucarForm.tsx",
  "components/regression/DolarForm.tsx",
]);

/** Telas que exibem um resultado calculado e, portanto, precisam da frase de leitura. */
const FERRAMENTAS = [
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
];

const REGRAS: { nome: string; falha: (texto: string, arquivo: string) => boolean }[] = [
  // Só campos de formulário; eixos do Recharts também usam type="number" e são legítimos.
  // Analisa cada <Input ... /> inteiro: props com arrow function (=>) contêm ">".
  { nome: 'input type="number"', falha: (t) => (t.match(/<[Ii]nput\b[\s\S]*?\/>/g) ?? []).some((tag) => /type="number"/.test(tag)) },
  {
    nome: "rótulo técnico",
    falha: (t) =>
      /PCT Bound|\(pct_bound\)|λ saltos|μ salto|σ salto|S \(Preço|K \(Strike|T \(Anos|r \(Taxa|σ \(Volatilidade|>\s*(?:Steps|Ticker)\s*[<{]/.test(t),
  },
  { nome: "sem frase de leitura", falha: (t, a) => FERRAMENTAS.includes(a) && !t.includes("<Leitura") },
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

function violacoes(arquivo: string): string[] {
  const texto = readFileSync(join(RAIZ, arquivo), "utf-8");
  return REGRAS.filter((r) => r.falha(texto, arquivo)).map((r) => r.nome);
}

describe("regras de linguagem", () => {
  it.each(arquivos.filter((a) => !PENDENTES.has(a)))("%s segue as regras", (arquivo) => {
    expect(violacoes(arquivo)).toEqual([]);
  });

  it("PENDENTES só lista arquivos que existem e ainda violam alguma regra", () => {
    const parados = [...PENDENTES].filter((a) => !arquivos.includes(a) || violacoes(a).length === 0);
    expect(parados).toEqual([]);
  });

  it("toda ferramenta listada existe", () => {
    expect(FERRAMENTAS.filter((f) => !arquivos.includes(f))).toEqual([]);
  });
});
