# Linguagem clara — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/linguagem-clara/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Guidelines: `frontend/vitest.config.ts`, `CLAUDE.md`. Sem guia de testes de UI: strong defaults.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Lib pura (`lib/*.ts`) | unit | 1:1 com os ACs e as frases do design; edge cases listados | `frontend/lib/*.test.ts` | `cd frontend && npm test` |
| Regras de linguagem nas telas | unit (varredura de código) | Cada tela migrada sai de `PENDENTES` | `frontend/lib/regras-linguagem.test.ts` | `cd frontend && npm test` |
| Componentes `components/ui` novos | none | Build gate + UAT | - | build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Tasks com teste unitário ou que mexem em `PENDENTES` | `cd frontend && npm test` + tsc + eslint dos arquivos |
| Build | Fim de fase e tasks sem teste próprio | Quick + `npm run build` |

---

## Execution Plan

As fases rodam em sequência; a primeira tarefa de cada fase depende da fase anterior inteira.

### Phase 1: Fundação

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Simulação e opções

```
T7 → T8 → T9 → T10 → T11
```

### Phase 3: Risco e mercado

```
T12 → T13 → T14 → T15 → T16 → T17
```

### Phase 4: Negócio

```
T18 → T19 → T20 → T21 → T22 → T23
```

### Phase 5: Navegação e glossário

```
T24 → T25
```

---

## Task Breakdown

### T1: Mapa de ativos

**What**: `lib/ativos.ts` com `ATIVOS` e `nomeAtivo`; testes em `lib/ativos.test.ts`.
**Where**: `frontend/lib/ativos.ts`
**Depends on**: None
**Reuses**: -
**Requirement**: LING-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `nomeAtivo("SB=F")` = "Açúcar NY nº 11"; código desconhecido devolve o próprio código
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): adiciona mapa de nomes e unidades dos ativos`

---

### T2: Leitura e validação de números

**What**: `lib/numero.ts` com `lerNumero` e `erroFaixa`; testes em `lib/numero.test.ts`.
**Where**: `frontend/lib/numero.ts`
**Depends on**: T1
**Reuses**: `lib/format.ts`
**Requirement**: LING-02

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] "10,5" → 10.5; "1.234,5" → 1234.5; "1234.5" → 1234.5; "abc" e "" → null
- [ ] `erroFaixa(150, 1, 100, "%")` = "Use um valor entre 1 e 100 %."
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): lê números com vírgula e valida faixa`

---

### T3: Frases de leitura de mercado

**What**: `lib/leitura.ts`: `leituraVaR`, `leituraMonteCarlo`, `leituraVolatilidade`, `leituraStress`, `leituraArima`, `leituraJump`, `leituraPayoff`, `leituraCall`; testes com as frases do design.
**Where**: `frontend/lib/leitura.ts`
**Depends on**: T2
**Reuses**: `lib/format.ts`, `lib/ativos.ts`
**Requirement**: LING-03, LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cada função tem teste com a frase exata do design
- [ ] Valor ausente → "Sem dados suficientes para este cálculo."
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): adiciona frases de leitura das ferramentas de mercado`

---

### T4: Frases de leitura de negócio

**What**: Em `lib/leitura.ts`: `leituraCenarios`, `leituraRisco`, `leituraMetas`, `leituraBreakeven`, `leituraRegDolar`, `leituraRegAcucar`, `leituraAtr`.
**Where**: `frontend/lib/leitura.ts`
**Depends on**: T3
**Reuses**: T3
**Requirement**: LING-03, LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Cada função tem teste com a frase exata do design
- [ ] Probabilidade < 1% vira "menos de 1%"; P10 < 0 acrescenta "Há risco de prejuízo."
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): adiciona frases de leitura das ferramentas de negócio`

---

### T5: Campo numérico e caixa de leitura

**What**: `components/ui/campo-numero.tsx` (`CampoNumero`, `campoValido`) e `components/ui/leitura.tsx` (`Leitura`).
**Where**: `frontend/components/ui/campo-numero.tsx`
**Depends on**: T4
**Reuses**: `Input`, `Label`, `FieldTooltip`, `lib/numero.ts`
**Requirement**: LING-01, LING-02, LING-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Rótulo no formato "nome (unidade)" e erro de faixa abaixo do campo
- [ ] `type="text" inputMode="decimal"`
- [ ] Gate passa

**Tests**: none
**Gate**: build
**Commit**: `feat(ui): adiciona campo numérico pt-BR e caixa de leitura`

---

### T6: Teste de regras de linguagem

**What**: `lib/regras-linguagem.test.ts`: proíbe `type="number"` e rótulos técnicos (pct_bound, Steps, λ saltos, S (Preço, …) fora de `components/ui/`; exige `<Leitura` nas 15 telas de ferramenta; lista `PENDENTES` com quem viola hoje.
**Where**: `frontend/lib/regras-linguagem.test.ts`
**Depends on**: T5
**Reuses**: padrão de `lib/regras-ui.test.ts`
**Requirement**: LING-01, LING-02, LING-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Passa com a lista inicial; falha se a lista tiver arquivo já limpo
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `test(ui): adiciona regras de linguagem com lista de pendentes`

---

### T7: Monte Carlo

**What**: Seletor de ativo por nome, rótulos e faixas do design, variação máxima em %, ajuda corrigida, frase de leitura.
**Where**: `frontend/components/simulation/SimulationForm.tsx`
**Depends on**: None
**Reuses**: `CampoNumero`, `TickerSelect`, `leituraMonteCarlo`
**Requirement**: LING-01..05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivos fora de `PENDENTES`; API recebe `pct_bound` = 0,5 quando o campo tem 50
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(simulation): usa linguagem clara e frase de leitura`

---

### T8: Opções: Black-Scholes e Monte Carlo

**What**: Rótulos do design; juros e volatilidade em %; frase `leituraCall`.
**Where**: `frontend/components/options/BSPricer.tsx`
**Depends on**: T7
**Reuses**: `CampoNumero`, `leituraCall`
**Requirement**: LING-01..03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Digitar 10,5 em juros envia `r: 0.105`
- [ ] `BSPricer.tsx` e `MCPricer.tsx` fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(options): usa linguagem clara nos precificadores`

---

### T9: Opções: payoff

**What**: Rótulos do construtor de estratégia e frase `leituraPayoff`.
**Where**: `frontend/components/options/PayoffBuilder.tsx`
**Depends on**: T8
**Reuses**: `CampoNumero`, `leituraPayoff`
**Requirement**: LING-01, LING-03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `PayoffBuilder.tsx` e `app/app/options/page.tsx` fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(options): explica o resultado da estratégia`

---

### T10: Simulação com saltos

**What**: Rótulos do design, campos em %, frase `leituraJump`.
**Where**: `frontend/app/app/jump-diffusion/page.tsx`
**Depends on**: T9
**Reuses**: `CampoNumero`, `leituraJump`
**Requirement**: LING-01..03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(jump-diffusion): usa linguagem clara e frase de leitura`

---

### T11: Parâmetros em %

**What**: Campos em % com conversão ao carregar (×100) e ao salvar (÷100); seletor de ativo por nome.
**Where**: `frontend/components/params/ParamsForm.tsx`
**Depends on**: T10
**Reuses**: `CampoNumero`, `ativos.ts`
**Requirement**: LING-01, LING-02, LING-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Valor salvo 0,25 aparece como 25; digitar 30 salva 0,3
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: build
**Commit**: `feat(params): mostra parâmetros em porcentagem`

---

### T12: VaR

**What**: Frase `leituraVaR` e nomes dos ativos nas abas.
**Where**: `frontend/app/app/var/page.tsx`
**Depends on**: None
**Reuses**: `leituraVaR`, `nomeAtivo`
**Requirement**: LING-03, LING-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(var): explica a perda máxima em uma frase`

---

### T13: Volatilidade

**What**: Frase `leituraVolatilidade`; atalhos por nome do ativo.
**Where**: `frontend/app/app/volatilidade/page.tsx`
**Depends on**: T12
**Reuses**: `leituraVolatilidade`
**Requirement**: LING-04, LING-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(volatilidade): explica a volatilidade em uma frase`

---

### T14: Teste de estresse

**What**: Frase `leituraStress`; seletor por nome.
**Where**: `frontend/app/app/stress/page.tsx`
**Depends on**: T13
**Reuses**: `leituraStress`
**Requirement**: LING-04, LING-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(stress): explica a pior queda em uma frase`

---

### T15: Previsão ARIMA

**What**: Frase `leituraArima`; abas por nome.
**Where**: `frontend/app/app/arima/page.tsx`
**Depends on**: T14
**Reuses**: `leituraArima`
**Requirement**: LING-04, LING-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(arima): explica a previsão em uma frase`

---

### T16: Breakeven da safra (Cenários)

**What**: Rótulos do design e frase `leituraCenarios`.
**Where**: `frontend/app/app/cenarios/page.tsx`
**Depends on**: T15
**Reuses**: `CampoNumero`, `leituraCenarios`
**Requirement**: LING-01..03

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(cenarios): usa linguagem clara e frase de leitura`

---

### T17: Risco do EBITDA

**What**: Rótulos e colunas do design e frase `leituraRisco`.
**Where**: `frontend/app/app/risco/page.tsx`
**Depends on**: T16
**Reuses**: `CampoNumero`, `leituraRisco`
**Requirement**: LING-01, LING-02, LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: build
**Commit**: `feat(risco): usa linguagem clara e frase de leitura`

---

### T18: Metas

**What**: Frase `leituraMetas`.
**Where**: `frontend/app/app/metas/page.tsx`
**Depends on**: None
**Reuses**: `leituraMetas`
**Requirement**: LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(metas): explica a distância até a meta`

---

### T19: Breakeven do açúcar

**What**: Rótulos do design e frase `leituraBreakeven` nas abas Ao vivo e Manual.
**Where**: `frontend/app/app/breakeven/page.tsx`
**Depends on**: T18
**Reuses**: `CampoNumero`, `leituraBreakeven`
**Requirement**: LING-01, LING-02, LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Arquivo fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(breakeven): usa linguagem clara e frase de leitura`

---

### T20: Modelo do dólar

**What**: Rótulos do design no formulário e frase `leituraRegDolar`.
**Where**: `frontend/components/regression/DolarForm.tsx`
**Depends on**: T19
**Reuses**: `CampoNumero`, `leituraRegDolar`
**Requirement**: LING-01, LING-02, LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `DolarForm.tsx` e a página fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(regressao-dolar): usa linguagem clara e frase de leitura`

---

### T21: Modelo do açúcar

**What**: Rótulos do design, nomes dos modelos e frase `leituraRegAcucar`.
**Where**: `frontend/components/regression/AcucarForm.tsx`
**Depends on**: T20
**Reuses**: `CampoNumero`, `leituraRegAcucar`
**Requirement**: LING-01, LING-02, LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `AcucarForm.tsx` e a página fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(regressao-acucar): usa linguagem clara e frase de leitura`

---

### T22: ATR da usina

**What**: Rótulos do design e frase `leituraAtr`.
**Where**: `frontend/components/atr/AtrForm.tsx`
**Depends on**: T21
**Reuses**: `CampoNumero`, `leituraAtr`
**Requirement**: LING-01, LING-02, LING-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `AtrForm.tsx` e a página fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(atr): usa linguagem clara e frase de leitura`

---

### T23: Indicadores de Fixações e Preços diários

**What**: Rótulos dos indicadores e datas "De/Até"; `TickerSelect` com nomes de `ativos.ts`.
**Where**: `frontend/components/market/IndicatorSelector.tsx`
**Depends on**: T22
**Reuses**: `CampoNumero`, `ativos.ts`
**Requirement**: LING-01, LING-02, LING-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `IndicatorSelector.tsx`, `TickerSelect.tsx`, `TickerSuggestForm.tsx` e `app/app/market/page.tsx` fora de `PENDENTES`
- [ ] Gate passa

**Tests**: unit
**Gate**: build
**Commit**: `feat(market): usa linguagem clara nos indicadores`

---

### T24: Menu e títulos

**What**: Nomes do menu e títulos do `PageHeader` conforme o design.
**Where**: `frontend/components/layout/NavLinks.tsx`
**Depends on**: None
**Reuses**: `NavLinks`
**Requirement**: LING-06

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste em `regras-linguagem.test.ts` confere que cada link do menu tem o mesmo nome do título da página
- [ ] Gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(ui): renomeia o menu pelo que cada ferramenta responde`

---

### T25: Glossário

**What**: Página `/app/glossario`, link no menu Conta e prop `termo` no `FieldTooltip`.
**Where**: `frontend/app/app/glossario/page.tsx`
**Depends on**: T24
**Reuses**: `PageHeader`, `FieldTooltip`
**Requirement**: LING-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Termos em ordem alfabética, cada um com até 3 frases
- [ ] `PENDENTES = []`; gate build completo
- [ ] Gate passa

**Tests**: unit
**Gate**: build
**Commit**: `feat(ui): adiciona glossário de termos`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1–T6, T12–T15, T18, T24 | 1 arquivo | ✅ |
| T3/T4 | mesmo arquivo, divididas por grupo de ferramentas | ✅ |
| T7–T11, T16, T17, T19–T23, T25 | 1 tela + componentes usados só por ela | ⚠️ coeso: a tela é a unidade que o usuário vê |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
|---|---|---|---|
| T1 | None | início da fase | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | None | início da fase | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T8 | T8 → T9 | ✅ |
| T10 | T9 | T9 → T10 | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | None | início da fase | ✅ |
| T13 | T12 | T12 → T13 | ✅ |
| T14 | T13 | T13 → T14 | ✅ |
| T15 | T14 | T14 → T15 | ✅ |
| T16 | T15 | T15 → T16 | ✅ |
| T17 | T16 | T16 → T17 | ✅ |
| T18 | None | início da fase | ✅ |
| T19 | T18 | T18 → T19 | ✅ |
| T20 | T19 | T19 → T20 | ✅ |
| T21 | T20 | T20 → T21 | ✅ |
| T22 | T21 | T21 → T22 | ✅ |
| T23 | T22 | T22 → T23 | ✅ |
| T24 | None | início da fase | ✅ |
| T25 | T24 | T24 → T25 | ✅ |

## Test Co-location Validation

| Task | Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1–T4, T6 | Lib pura / regras | unit | unit | ✅ |
| T5 | Componentes `components/ui` | none | none | ✅ |
| T7–T25 | Telas verificadas por regras-linguagem | unit (varredura) | unit | ✅ |
