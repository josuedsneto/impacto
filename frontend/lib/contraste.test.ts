// UI-06 AC6: texto com contraste mínimo de 4,5:1 contra o fundo, nos dois temas.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf-8");

function tokens(seletor: string): Record<string, string> {
  const bloco = css.match(new RegExp(`${seletor.replace(".", "\\.")}\\s*\\{([^}]*)\\}`))![1];
  return Object.fromEntries([...bloco.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** sRGB linear (0–1) a partir de "#rrggbb" ou "oklch(L C H)". */
function linear(cor: string): [number, number, number] {
  if (cor.startsWith("#")) {
    return [1, 3, 5].map((i) => {
      const c = parseInt(cor.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
  }
  const [L, C, H] = cor.match(/oklch\(([^)]+)\)/)![1].split(/\s+/).map(Number);
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

function contraste(c1: string, c2: string): number {
  const lum = (c: string) => {
    const [r, g, b] = linear(c);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(c1), lum(c2)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const PARES: [texto: string, fundo: string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["positive", "card"],
  ["negative", "card"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-muted", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
];

describe.each([
  ["claro", { ...tokens(":root") }],
  ["escuro", { ...tokens(":root"), ...tokens(".dark") }],
])("contraste no tema %s", (_tema, t) => {
  it.each(PARES)("%s sobre %s ≥ 4,5:1", (texto, fundo) => {
    expect(contraste(t[texto], t[fundo])).toBeGreaterThanOrEqual(4.5);
  });
});

it("conversão confere com valores conhecidos", () => {
  expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
  expect(contraste("oklch(1 0 0)", "#ffffff")).toBeCloseTo(1, 2);
  expect(contraste("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
});
