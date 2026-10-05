# Exportar CSV — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline (feature Medium). Decisões:

- Geração no navegador (`lib/csv.ts`), sem endpoint novo (spec, Out of Scope).
- Números com até 6 casas, vírgula decimal, sem milhar; datas em AAAA-MM-DD na tabela (ordenáveis no Excel) e dd/mm/aaaa no cabeçalho de parâmetros.
- SPEC_DEVIATION EXP-01 AC1: em telas cujo resultado vive dentro de uma aba (VaR, ARIMA, Volatilidade), o botão fica na barra do resultado, não no `PageHeader`. Motivo: o resultado é estado da aba; levantar o estado só para o botão complicaria a tela.

**Status**: Draft

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| `lib/csv.ts` | unit | 1:1 com EXP-02/EXP-03 e edge cases | `frontend/lib/csv.test.ts` | `cd frontend && npm test` |
| Telas | unit (varredura) | Cada tela da lista usa `<BotaoExportar` | `frontend/lib/regras-exportar.test.ts` | `cd frontend && npm test` |
| `components/ui` novo | none | build gate + UAT | - | build |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Tasks com teste | `cd frontend && npm test` + tsc + eslint dos arquivos |
| Build | Fim e tasks sem teste próprio | Quick + `npm run build` |

---

## Execution Plan

### Phase 1: Exportação

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

---

## Task Breakdown

### T1: Gerador de CSV

**Status**: ✅ Done

**What**: `lib/csv.ts`: `gerarCsv({ parametros, colunas, linhas })` (BOM, `;`, CRLF, vírgula decimal sem milhar, aspas quando preciso, vazio para null/NaN), `nomeArquivo(ferramenta, ativo, data)` sem acentos/espaços e `baixarCsv(nome, conteudo)` via Blob.
**Where**: `frontend/lib/csv.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: EXP-02, EXP-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Testes em `lib/csv.test.ts`: BOM, separador, CRLF, -1234.5 → "-1234,5", texto com `;` e aspas, null vazio, cabeçalho de parâmetros, nome do arquivo
- [x] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): adiciona gerador de CSV no padrão Excel BR`

---

### T2: Botão Exportar CSV

**Status**: ✅ Done

**What**: `components/ui/botao-exportar.tsx`: botão "Exportar CSV" desabilitado com dica "Gere um resultado para exportar." quando não há dados; recebe uma função que monta o CSV.
**Where**: `frontend/components/ui/botao-exportar.tsx`
**Depends on**: T1
**Reuses**: `Button`, `lib/csv.ts`
**Requirement**: EXP-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Teste de regra em `lib/regras-exportar.test.ts` com lista de pendentes: cada ferramenta da lista usa `<BotaoExportar`
- [x] Gate passa

**Tests**: none
**Gate**: build
**Commit**: `feat(ui): adiciona botão de exportar CSV`

---

### T3: Monte Carlo e Simulação com saltos

**Status**: ✅ Done

**What**: CSV da série de percentis por dia (P5…P95) e do caminho simulado, com parâmetros no cabeçalho.
**Where**: `frontend/app/app/simulation/page.tsx`
**Depends on**: T2
**Reuses**: `BotaoExportar`
**Requirement**: EXP-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Arquivos fora de `PENDENTES`
- [x] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(simulation): exporta os cenários em CSV`

---

### T4: VaR e Volatilidade

**Status**: ✅ Done

**What**: CSV com as métricas do VaR e com a série de volatilidade de 30 dias.
**Where**: `frontend/app/app/var/page.tsx`
**Depends on**: T3
**Reuses**: `BotaoExportar`
**Requirement**: EXP-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Arquivos fora de `PENDENTES`
- [x] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(var): exporta métricas e volatilidade em CSV`

---

### T5: Teste de estresse e ARIMA

**Status**: ✅ Done

**What**: CSV dos cenários de estresse e da série histórico + previsão com intervalo.
**Where**: `frontend/app/app/stress/page.tsx`
**Depends on**: T4
**Reuses**: `BotaoExportar`
**Requirement**: EXP-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Arquivos fora de `PENDENTES`
- [x] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(stress): exporta cenários e previsão em CSV`

---

### T6: Risco do EBITDA e Breakeven da safra

**Status**: ✅ Done

**What**: CSV dos percentis de faturamento/custo/EBITDA e dos percentis + distribuição do cenário.
**Where**: `frontend/app/app/risco/page.tsx`
**Depends on**: T5
**Reuses**: `BotaoExportar`
**Requirement**: EXP-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Arquivos fora de `PENDENTES`
- [x] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(risco): exporta percentis em CSV`

---

### T7: Metas e Breakeven do açúcar

**Status**: ✅ Done

**What**: CSV da série de valor de mercado vs meta e do histórico de breakeven.
**Where**: `frontend/app/app/metas/page.tsx`
**Depends on**: T6
**Reuses**: `BotaoExportar`
**Requirement**: EXP-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Arquivos fora de `PENDENTES`
- [x] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(metas): exporta série e histórico em CSV`

---

### T8: Modelos e ATR

**Status**: ✅ Done

**What**: CSV dos coeficientes do modelo do dólar, do real x previsto do modelo do açúcar e do histórico de ATR.
**Where**: `frontend/app/app/regressao-dolar/page.tsx`
**Depends on**: T7
**Reuses**: `BotaoExportar`
**Requirement**: EXP-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Arquivos fora de `PENDENTES`
- [x] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(regressao): exporta modelos e ATR em CSV`

---

### T9: Mercado e sinais

**Status**: ✅ Done

**What**: CSV da série de preços com indicadores e da lista de sinais; `PENDENTES = []`.
**Where**: `frontend/app/app/fixacoes/page.tsx`
**Depends on**: T8
**Reuses**: `BotaoExportar`
**Requirement**: EXP-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `PENDENTES = []`; gate build completo
- [x] Gate passa

**Tests**: unit
**Gate**: build
**Commit**: `feat(fixacoes): exporta preços e sinais em CSV`

---

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram | Status |
|---|---|---|---|
| T1 | None | início | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T8 | T8 → T9 | ✅ |

## Test Co-location Validation

| Task | Layer | Requires | Says | Status |
|---|---|---|---|---|
| T1 | lib | unit | unit | ✅ |
| T2 | components/ui | none | none | ✅ |
| T3–T9 | telas (varredura) | unit | unit | ✅ |
