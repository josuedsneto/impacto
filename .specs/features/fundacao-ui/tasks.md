# Fundação de UI — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/fundacao-ui/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerado do código e da spec. Guidelines encontradas: `frontend/vitest.config.ts` (sem limite de cobertura), `CLAUDE.md` (comandos). Sem guia de testes de UI: strong defaults aplicados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Lib pura (`lib/*.ts`) | unit | 1:1 com os ACs; todo edge case listado | `frontend/lib/*.test.ts` | `cd frontend && npm test` |
| Regras de código das telas (UI-02, UI-06 AC5, UI-09 AC2) | unit (varredura de código) | Cada arquivo migrado sai da lista de pendentes e passa a ser verificado | `frontend/lib/regras-ui.test.ts` | `cd frontend && npm test` |
| Componentes e páginas React | none (sem jsdom/RTL no projeto) | Build gate + regras-ui + UAT de comportamento visual | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Tasks com teste unitário ou que mexem na lista de pendentes | `cd frontend && npm test` |
| Build | Fim de fase e tasks sem teste próprio | `cd frontend && npm test && npx tsc --noEmit -p . && npx eslint <arquivos da task> && npm run build` |

---

## Execution Plan

As fases rodam em sequência; a primeira tarefa de cada fase depende da fase anterior inteira.

### Phase 1: Fundação

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Componentes base e layout

```
T7 → T8 → T9 → T10 → T11
```

### Phase 3: Dashboard e mercado

```
T12 → T13 → T14 → T15 → T16 → T17
```

### Phase 4: Simulação

```
T18 → T19 → T20 → T21 → T22
```

### Phase 5: Risco

```
T23 → T24 → T25 → T26 → T27 → T28
```

### Phase 6: Análise e conta

```
T29 → T30 → T31 → T32 → T33 → T34 → T35
```

### Phase 7: Páginas públicas

```
T36 → T37
```

---

## Task Breakdown

### T1: Criar formatador pt-BR

**Status**: ✅ Done

**What**: `lib/format.ts` com `formatNumber`, `formatBRL`, `formatCents`, `formatFX`, `formatPercent`, `formatCompactBRL`, `formatDate`.
**Where**: `frontend/lib/format.ts`
**Depends on**: None
**Reuses**: `Intl.NumberFormat`
**Requirement**: UI-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Testes em `frontend/lib/format.test.ts` cobrem UI-01 AC2–AC7 e os edge cases (negativo, ≥ 1 milhão)
- [x] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): adiciona formatador de números pt-BR`

---

### T2: Criar teste de regras de UI com lista de pendentes

**What**: `lib/regras-ui.test.ts` varre `app/` e `components/` (exceto `components/ui/`) e falha se um arquivo fora da lista `PENDENTES` tiver cor literal (hex/rgb), `toFixed` ou `<h1` fora de `PageHeader`; `PENDENTES` começa com os arquivos que hoje violam.
**Where**: `frontend/lib/regras-ui.test.ts`
**Depends on**: T1
**Reuses**: `node:fs`
**Requirement**: UI-02, UI-06, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste passa com a lista inicial
- [ ] Teste falha se um arquivo migrado volta a ter `toFixed` (verificado removendo um item da lista)
- [ ] Teste falha se `PENDENTES` tiver arquivo que já está limpo (lista não apodrece)

**Tests**: unit
**Gate**: quick
**Commit**: `test(ui): adiciona regras de UI com lista de arquivos pendentes`

---

### T3: Definir tokens de cor e verificar contraste

**What**: tokens `--chart-1..5`, `--positive`, `--negative`, `--brand`, `--sidebar*`, `--chart-grid` em `:root` e `.dark`, mapeados no `@theme inline`; teste calcula contraste de `--foreground`/`--muted-foreground` contra `--background`/`--card` nos dois temas.
**Where**: `frontend/app/globals.css`
**Depends on**: T2
**Reuses**: tokens shadcn existentes
**Requirement**: UI-06, UI-11

**Tools**: MCP: NONE · Skill: `dataviz` (paleta já validada no design)

**Done when**:
- [ ] `frontend/lib/contraste.test.ts` lê `globals.css` e confirma texto ≥ 4,5:1 nos dois temas
- [ ] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): adiciona tokens de marca, gráfico e variação`

---

### T4: Tema segue o sistema e unifica o provider

**What**: `ThemeProvider` e script anti-flash usam a preferência salva ou o sistema; `ui/sonner.tsx` usa o `useTheme` próprio; `next-themes` sai do `package.json`.
**Where**: `frontend/components/ThemeProvider.tsx`
**Depends on**: T3
**Reuses**: `ThemeProvider` atual
**Requirement**: UI-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Sem preferência salva, abre no tema do sistema; com `localStorage` bloqueado, não lança erro
- [ ] `grep next-themes` vazio em `frontend/` (fora de `node_modules`)
- [ ] Gate build passa

**Tests**: none
**Gate**: build
**Commit**: `refactor(ui): unifica o tema e segue o sistema operacional`

---

### T5: Montar o Toaster no layout raiz

**What**: `<Toaster richColors position="top-right" />` no `app/layout.tsx`.
**Where**: `frontend/app/layout.tsx`
**Depends on**: T4
**Reuses**: `components/ui/sonner.tsx`
**Requirement**: UI-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Um único `<Toaster` em `app/`
- [ ] Gate build passa

**Tests**: none
**Gate**: build
**Commit**: `fix(ui): monta o Toaster para os avisos aparecerem`

---

### T6: Botão de tema no menu do usuário

**What**: item "Tema escuro"/"Tema claro" no `UserMenu`, chamando `toggle()`; cores do menu passam a tokens.
**Where**: `frontend/components/dashboard/UserMenu.tsx`
**Depends on**: T5
**Reuses**: `useTheme`, `DropdownMenu`
**Requirement**: UI-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `UserMenu.tsx` fora de `PENDENTES`; gate quick passa
- [ ] Gate build passa (fim da fase)

**Tests**: unit
**Gate**: build
**Commit**: `feat(ui): adiciona troca de tema no menu do usuário`

---

### T7: Criar PageHeader

**What**: componente com `titulo`, `descricao`, `acoes?`, `atualizadoEm?`; único lugar com `<h1>`.
**Where**: `frontend/components/layout/PageHeader.tsx`
**Depends on**: None
**Reuses**: classes de tipografia atuais
**Requirement**: UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Ações empilham abaixo do título em < 640px
- [ ] Gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): adiciona cabeçalho padrão de página`

---

### T8: Criar estados de carregamento, erro e vazio

**What**: `Skeleton`, `ErrorState` (mensagem + "Tentar novamente") e `EmptyState` (frase + ação opcional).
**Where**: `frontend/components/ui/feedback.tsx`
**Depends on**: T7
**Reuses**: `Button`
**Requirement**: UI-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Componentes exportados e tipados
- [ ] Gate build passa

**Tests**: none
**Gate**: build
**Commit**: `feat(ui): adiciona estados de carregamento, erro e vazio`

---

### T9: Extrair NavLinks e migrar o menu lateral

**What**: `NavLinks` com `onNavigate?`; `AppSidebar` usa `NavLinks`, tokens e `hidden lg:flex`.
**Where**: `frontend/components/layout/NavLinks.tsx`
**Depends on**: T8
**Reuses**: `NAV_SECTIONS` de `AppSidebar.tsx`
**Requirement**: UI-03, UI-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `AppSidebar.tsx` fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(ui): extrai links do menu e usa tokens no menu lateral`

---

### T10: Criar a gaveta de menu para celular

**What**: `MobileNav` com botão "Menu" (`lg:hidden`) e `<dialog>`; fecha com Esc, clique fora ou ao navegar; foco no primeiro link.
**Where**: `frontend/components/layout/MobileNav.tsx`
**Depends on**: T9
**Reuses**: `NavLinks`
**Requirement**: UI-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Gate build passa

**Tests**: none
**Gate**: build
**Commit**: `feat(ui): adiciona menu em gaveta para telas pequenas`

---

### T11: Layout /app responsivo

**What**: cabeçalho com `MobileNav`, faixa de cotações com `format.ts` e tokens, espaçamento padrão do conteúdo.
**Where**: `frontend/app/app/layout.tsx`
**Depends on**: T10
**Reuses**: `MobileNav`, `format.ts`
**Requirement**: UI-03, UI-04, UI-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `app/app/layout.tsx` fora de `PENDENTES`
- [ ] Gate build passa (fim da fase)

**Tests**: unit
**Gate**: build
**Commit**: `feat(ui): torna o layout do app responsivo`

---

### T12: Migrar a página do dashboard

**What**: `PageHeader`, grades `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, tokens.
**Where**: `frontend/app/app/dashboard/page.tsx`
**Depends on**: None
**Reuses**: `PageHeader`
**Requirement**: UI-04, UI-06, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(dashboard): usa cabeçalho padrão e grade responsiva`

---

### T13: Migrar PriceCard

**What**: tokens (`--chart-2` açúcar, `--chart-1` dólar, `text-positive/negative`), `format.ts`.
**Where**: `frontend/components/dashboard/PriceCard.tsx`
**Depends on**: T12
**Reuses**: `format.ts`
**Requirement**: UI-02, UI-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(dashboard): formata e colore o cartão de preço por tokens`

---

### T14: Migrar FocusWidget

**What**: tokens e `formatPercent`/`formatFX`.
**Where**: `frontend/components/dashboard/FocusWidget.tsx`
**Depends on**: T13
**Reuses**: `format.ts`
**Requirement**: UI-02, UI-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(dashboard): formata o widget do Focus`

---

### T15: Migrar NewsFeed e AccountSummary

**What**: tokens, `formatDate`, `EmptyState` quando não há notícias ou simulações.
**Where**: `frontend/components/dashboard/NewsFeed.tsx`
**Depends on**: T14
**Reuses**: `feedback.tsx`
**Requirement**: UI-06, UI-08

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `NewsFeed.tsx` e `AccountSummary.tsx` fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(dashboard): migra notícias e resumo da conta`

---

### T16: Migrar Fixações

**What**: página com `PageHeader` e layout formulário + resultado; `FixacoesChart` lê cores dos tokens (Plotly).
**Where**: `frontend/app/app/fixacoes/page.tsx`
**Depends on**: T15
**Reuses**: `PageHeader`, tokens
**Requirement**: UI-06, UI-09, UI-10, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Página e `FixacoesChart.tsx` fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(fixacoes): aplica layout padrão e cores do tema`

---

### T17: Migrar Análise Técnica (market)

**What**: `PageHeader`, `PriceChart` com tokens e `format.ts`, sucesso do `TickerSuggestForm` mantido em toast.
**Where**: `frontend/app/app/market/page.tsx`
**Depends on**: T16
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-09, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Página e `PriceChart.tsx` fora de `PENDENTES`
- [ ] Gate build passa (fim da fase)

**Tests**: unit
**Gate**: build
**Commit**: `refactor(market): aplica layout padrão e formatação`

---

### T18: Migrar Monte Carlo

**What**: página, `SimulationForm`, `SimulationMetrics`, `FanChart`: `PageHeader`, layout formulário + resultado, `format.ts`, tokens, toast "Simulação salva", `ErrorState`/`EmptyState` no histórico.
**Where**: `frontend/app/app/simulation/page.tsx`
**Depends on**: None
**Reuses**: `PageHeader`, `feedback.tsx`, `format.ts`
**Requirement**: UI-02, UI-07, UI-08, UI-09, UI-10, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Página e 3 componentes fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(simulation): aplica layout padrão, formatação e avisos`

---

### T19: Migrar Jump Diffusion

**What**: `PageHeader`, layout formulário + resultado, `format.ts`, `var(--chart-N)`.
**Where**: `frontend/app/app/jump-diffusion/page.tsx`
**Depends on**: T18
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-09, UI-10, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(jump-diffusion): aplica layout padrão e formatação`

---

### T20: Migrar ARIMA

**What**: `PageHeader`, `ErrorState` com "Tentar novamente", `format.ts`, tokens no gráfico.
**Where**: `frontend/app/app/arima/page.tsx`
**Depends on**: T19
**Reuses**: `PageHeader`, `feedback.tsx`
**Requirement**: UI-02, UI-08, UI-09, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(arima): aplica layout padrão e estados de erro`

---

### T21: Migrar Volatilidade

**What**: `PageHeader`, cartões responsivos, `formatPercent`, tokens no gráfico.
**Where**: `frontend/app/app/volatilidade/page.tsx`
**Depends on**: T20
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-04, UI-09, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(volatilidade): aplica layout padrão e formatação`

---

### T22: Migrar Opções

**What**: página + `BSPricer`, `MCPricer`, `PayoffBuilder`, `PayoffChart`: `PageHeader`, `format.ts`, tokens.
**Where**: `frontend/app/app/options/page.tsx`
**Depends on**: T21
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-09, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Página e 4 componentes fora de `PENDENTES`
- [ ] Gate build passa (fim da fase)

**Tests**: unit
**Gate**: build
**Commit**: `refactor(options): aplica layout padrão e formatação`

---

### T23: Migrar VaR

**What**: `PageHeader`, `ErrorState`, `formatPercent`/`formatCents`.
**Where**: `frontend/app/app/var/page.tsx`
**Depends on**: None
**Reuses**: `PageHeader`, `feedback.tsx`
**Requirement**: UI-02, UI-08, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(var): aplica layout padrão e formatação`

---

### T24: Migrar Breakeven

**What**: `PageHeader`, layout formulário + resultado, `formatBRL`, toast "Simulação salva".
**Where**: `frontend/app/app/breakeven/page.tsx`
**Depends on**: T23
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-07, UI-09, UI-10

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(breakeven): aplica layout padrão, formatação e avisos`

---

### T25: Migrar Stress Test

**What**: `PageHeader`, `ErrorState`, `formatPercent`, `formatDate`, tabela com rolagem própria.
**Where**: `frontend/app/app/stress/page.tsx`
**Depends on**: T24
**Reuses**: `PageHeader`, `feedback.tsx`
**Requirement**: UI-02, UI-04, UI-08, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(stress): aplica layout padrão e formatação`

---

### T26: Migrar Risco (EBITDA)

**What**: `PageHeader`, `formatCompactBRL`, tokens no gráfico, remove imports sem uso.
**Where**: `frontend/app/app/risco/page.tsx`
**Depends on**: T25
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-09, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(risco): aplica layout padrão e formatação`

---

### T27: Migrar Cenários

**What**: `PageHeader`, layout formulário + resultado, `format.ts`, tokens no gráfico.
**Where**: `frontend/app/app/cenarios/page.tsx`
**Depends on**: T26
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-09, UI-10, UI-11

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(cenarios): aplica layout padrão e formatação`

---

### T28: Migrar Metas

**What**: `PageHeader`, `formatBRL`, mapa de calor com tokens `--positive`/`--negative`, tabela com rolagem própria.
**Where**: `frontend/app/app/metas/page.tsx`
**Depends on**: T27
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-04, UI-06, UI-09

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate build passa (fim da fase)

**Tests**: unit
**Gate**: build
**Commit**: `refactor(metas): aplica layout padrão e cores do tema`

---

### T29: Migrar Notícias

**What**: `PageHeader` com "Atualizado às", `Skeleton`, `ErrorState`, `EmptyState`.
**Where**: `frontend/app/app/noticias/page.tsx`
**Depends on**: None
**Reuses**: `PageHeader`, `feedback.tsx`
**Requirement**: UI-08, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(noticias): aplica layout padrão e estados de tela`

---

### T30: Migrar Boletim Focus

**What**: `PageHeader`, `ErrorState`, `formatPercent`/`formatFX`.
**Where**: `frontend/app/app/focus/page.tsx`
**Depends on**: T29
**Reuses**: `PageHeader`, `format.ts`
**Requirement**: UI-02, UI-08, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(focus): aplica layout padrão e formatação`

---

### T31: Migrar Regressão Dólar e trocar Plotly por Recharts

**What**: página + `DolarForm`, `DolarMetrics`, `DolarCharts` (Recharts): `PageHeader`, layout formulário + resultado, `format.ts`.
**Where**: `frontend/app/app/regressao-dolar/page.tsx`
**Depends on**: T30
**Reuses**: `PageHeader`, `format.ts`, padrão Recharts de `FanChart`
**Requirement**: UI-02, UI-09, UI-10, UI-11, UI-12

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Página e 3 componentes fora de `PENDENTES`; `DolarCharts.tsx` sem import de plotly; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(regressao-dolar): aplica layout padrão e usa Recharts`

---

### T32: Migrar Regressão Açúcar e trocar Plotly por Recharts

**What**: página + `AcucarForm`, `AcucarMetrics`, `AcucarCharts` (Recharts).
**Where**: `frontend/app/app/regressao-acucar/page.tsx`
**Depends on**: T31
**Reuses**: `DolarCharts` migrado
**Requirement**: UI-02, UI-09, UI-10, UI-11, UI-12

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Página e 3 componentes fora de `PENDENTES`; `AcucarCharts.tsx` sem import de plotly; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(regressao-acucar): aplica layout padrão e usa Recharts`

---

### T33: Migrar ATR e trocar Plotly por Recharts

**What**: página + `AtrForm`, `AtrMetrics`, `AtrHistorico` (Recharts); toast ao compartilhar.
**Where**: `frontend/app/app/atr/page.tsx`
**Depends on**: T32
**Reuses**: `PageHeader`, `feedback.tsx`, `format.ts`
**Requirement**: UI-02, UI-07, UI-09, UI-11, UI-12

**Tools**: MCP: NONE · Skill: `dataviz`

**Done when**:
- [ ] Página e 3 componentes fora de `PENDENTES`; `grep -rl plotly components` lista só `FixacoesChart.tsx`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(atr): aplica layout padrão e usa Recharts`

---

### T34: Migrar Parâmetros

**What**: `PageHeader`; sucesso de salvar vira toast.
**Where**: `frontend/app/app/params/page.tsx`
**Depends on**: T33
**Reuses**: `PageHeader`
**Requirement**: UI-07, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Página e `ParamsForm.tsx` fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(params): aplica layout padrão e avisos`

---

### T35: Migrar Admin

**What**: `PageHeader`; `AdminConfig`, `AtrUsinasAdmin`, `SuggestionQueue` com tokens e toasts.
**Where**: `frontend/app/app/admin/page.tsx`
**Depends on**: T34
**Reuses**: `PageHeader`
**Requirement**: UI-06, UI-07, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Página e 3 componentes fora de `PENDENTES`
- [ ] Gate build passa (fim da fase)

**Tests**: unit
**Gate**: build
**Commit**: `refactor(admin): aplica layout padrão e avisos`

---

### T36: Migrar a landing page pública

**What**: tokens no lugar das 38 cores literais; seções empilham no celular.
**Where**: `frontend/app/page.tsx`
**Depends on**: None
**Reuses**: tokens
**Requirement**: UI-04, UI-06

**Tools**: MCP: NONE · Skill: `frontend-design`

**Done when**:
- [ ] Arquivo fora de `PENDENTES`; gate quick passa

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(landing): usa tokens de cor e layout responsivo`

---

### T37: Fechar a lista de pendentes

**What**: `PENDENTES` vazia; login revisado nos dois temas.
**Where**: `frontend/lib/regras-ui.test.ts`
**Depends on**: T36
**Reuses**: -
**Requirement**: UI-02, UI-06, UI-09

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `PENDENTES = []` e gate build completo passa

**Tests**: unit
**Gate**: build
**Commit**: `test(ui): exige as regras de UI em todos os arquivos`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1–T11 | 1 arquivo ou componente cada | ✅ |
| T15 | 2 componentes irmãos do dashboard, mesma mudança | ⚠️ coeso |
| T16–T18, T22, T31–T35 | 1 página + componentes usados só por ela | ⚠️ coeso: a página é a unidade que o usuário vê e testa |
| T12–T14, T19–T21, T23–T30, T36–T37 | 1 arquivo | ✅ |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
|---|---|---|---|
| T1 | None | início da fase 1 | ✅ |
| T2–T6 | T(n-1) | cadeia T1→…→T6 | ✅ |
| T7 | None | início da fase 2 | ✅ |
| T8–T11 | T(n-1) | cadeia T7→…→T11 | ✅ |
| T12 | None | início da fase 3 | ✅ |
| T13–T17 | T(n-1) | cadeia | ✅ |
| T18 | None | início da fase 4 | ✅ |
| T19–T22 | T(n-1) | cadeia | ✅ |
| T23 | None | início da fase 5 | ✅ |
| T24–T28 | T(n-1) | cadeia | ✅ |
| T29 | None | início da fase 6 | ✅ |
| T30–T35 | T(n-1) | cadeia | ✅ |
| T36 | None | início da fase 7 | ✅ |
| T37 | T36 | cadeia | ✅ |

## Test Co-location Validation

| Task | Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1, T3 | Lib pura | unit | unit | ✅ |
| T2, T37 | Regras de código | unit | unit | ✅ |
| T4, T5, T8, T10 | Componente sem arquivo em `PENDENTES` | none | none | ✅ |
| T6, T7, T9, T11–T36 | Componente/página verificado por regras-ui | unit (varredura) | unit | ✅ |
