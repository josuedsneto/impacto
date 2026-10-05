# Fundação de UI — Validação

**Date**: 2026-10-05
**Spec**: `.specs/features/fundacao-ui/spec.md`
**Diff range**: `3963f79..e7fa338` (branch `refactor/auditoria`, 38 commits)
**Verifier**: revisão independente feita pelo próprio agente (fallback sem sub-agente; o usuário escolheu execução direta)

**Result**: PASS — todos os critérios verificáveis por código cobertos com evidência e 8/8 mutantes mortos. Critérios visuais (gaveta, troca de tema, 360px, aparência de toasts e gráficos) aguardam UAT do usuário.

---

## Task Completion

T1–T37 concluídas. Desvio registrado: T12 e T13 num commit só (`c360fb0`), porque mudavam a mesma interface de props. Commits de correção dentro da feature: `69a458a` (TooltipProvider fora do menu), `3650674` (lint do FixacoesChart que entrou em `d5f072d`).

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| UI-01 AC2 | "1.234,50" | `frontend/lib/format.test.ts:15` - `expect(formatNumber(1234.5, 2)).toBe("1.234,50")` | ✅ |
| UI-01 AC3 | "5,23%" | `frontend/lib/format.test.ts:19` - `toBe("5,23%")` | ✅ |
| UI-01 AC4 | "R$ 1.234,50" | `frontend/lib/format.test.ts:23` - `toBe("R$ 1.234,50")` | ✅ |
| UI-01 AC5 | "21,46 ¢/lb" | `frontend/lib/format.test.ts:27` - `toBe("21,46 ¢/lb")` | ✅ |
| UI-01 AC6 | "R$ 5,4322" | `frontend/lib/format.test.ts:31` - `toBe("R$ 5,4322")` | ✅ |
| UI-01 AC7 | "—" para null/undefined/NaN | `frontend/lib/format.test.ts:37-41` - `toBe("—")` em todas as funções | ✅ |
| UI-01 AC1 + UI-02 AC8 | sem `toFixed` em telas | `frontend/lib/regras-ui.test.ts:44` - `expect(violacoes(arquivo)).toEqual([])` com regra `frontend/lib/regras-ui.test.ts:14` | ✅ |
| UI-06 AC5 | sem cor literal nem cor fixa | `frontend/lib/regras-ui.test.ts:44` com regras `:13` e `:18` | ✅ |
| UI-06 AC6 | texto ≥ 4,5:1 nos dois temas | `frontend/lib/contraste.test.ts:60` - `toBeGreaterThanOrEqual(4.5)` em 9 pares × 2 temas | ✅ |
| UI-09 AC2 | `<h1>` só no PageHeader | `frontend/lib/regras-ui.test.ts:44` com regra `:22` | ✅ |
| UI-07 AC1 | um único Toaster | `frontend/app/layout.tsx:44` (único `<Toaster` em `app/`, conferido por grep) | ✅ |
| UI-12 AC3 | Plotly só em FixacoesChart | `grep -rl plotly components app` → só `components/market/FixacoesChart.tsx` | ✅ |
| UI-05 AC4 | sem escolha, tema do sistema | `frontend/app/layout.tsx:37` (script com `prefers-color-scheme`) | ⏳ UAT |
| UI-05 AC1–AC3 | botão alterna tema sem recarregar e sem piscar | `frontend/components/dashboard/UserMenu.tsx:56` | ⏳ UAT |
| UI-03 AC1–AC3 | gaveta abaixo de 1024px, fecha com Esc/fora/link | `frontend/components/layout/MobileNav.tsx:12` | ⏳ UAT |
| UI-04 AC4–AC6 | grades empilham, sem rolagem horizontal em 360px | classes responsivas em todas as rotas | ⏳ UAT |
| UI-07 AC2–AC3, UI-08 | toasts e estados de carregamento/erro/vazio | uso de `toast`, `ErrorState`, `EmptyState`, `Skeleton` nas 21 rotas | ⏳ UAT |
| UI-10, UI-11 | formulário + resultado lado a lado; gráficos no tema | rotas e gráficos migrados | ⏳ UAT |

## Edge Cases

- [x] `localStorage` bloqueado: `try/catch` em `frontend/components/ThemeProvider.tsx:24` e no script do layout.
- [x] `formatBRL(-10)` = "-R$ 10,00" — `frontend/lib/format.test.ts:46`.
- [x] Abreviação ≥ 1 milhão — `frontend/lib/format.test.ts:50-51`.

## Discrimination Sensor

Cópias em pasta temporária (`frontend/.sensor/`) e um arquivo temporário em `components/`; tudo apagado, `git status` igual ao baseline.

| # | Alvo | Mutação | Killed? |
|---|---|---|---|
| 1 | `format.ts` | percentual sem estilo percent | ✅ |
| 2 | `format.ts` | NaN não vira "—" | ✅ |
| 3 | `format.ts` | data ISO sem UTC (volta um dia) | ✅ |
| 4 | `format.ts` | abrevia valores abaixo de 1 milhão | ✅ |
| 5 | `format.ts` | SB=F sem ¢/lb | ✅ |
| 6 | `globals.css` | título do menu com contraste 3,7:1 | ✅ |
| 7 | `globals.css` | texto secundário claro demais | ✅ |
| 8 | componente novo | `toFixed` + `bg-blue-600` | ✅ |

**Result**: 8/8 killed.

## Gate Check

- `npm test`: 103 passed, 0 failed (antes da feature: 13).
- `npx tsc --noEmit`: 0 erros. `npm run build`: compilado.
- Lint por arquivo alterado em cada task: 0 erros.

## Bugs corrigidos no caminho (além da spec)

- ARIMA: `hsl(var(--primary))` com tokens oklch era cor inválida; previsão e intervalo não apareciam.
- Cenários: divisão vermelho/verde do gráfico usava a probabilidade como posição no eixo.
- Focus: alta do PIB aparecia em vermelho.
- Opções: preço do payoff virava texto e o eixo ficava irregular.
- Volatilidade: valores nulos apareciam como 0,00%.
- ATR: histórico desenhado do mais novo para o mais antigo; compartilhar falhava em silêncio.
- Breakeven: erro do histórico era engolido.
- Admin: `TooltipProvider` só envolvia o menu.

## Requirement Traceability Update

UI-01, UI-02, UI-06, UI-09, UI-12 → Verified. UI-03, UI-04, UI-05, UI-07, UI-08, UI-10, UI-11 → Implementing (UAT pendente).

## Summary

**Overall**: ✅ Pronto para UAT.

**UAT (você, no navegador)**:
1. Celular (ou janela com 360px): abrir 3 ferramentas pelo botão Menu; a gaveta fecha com Esc, clique fora e ao escolher link; nenhuma página rola na horizontal.
2. Menu do usuário → Tema escuro e Tema claro: tudo muda sem recarregar; recarregar a página mantém o tema sem piscar.
3. Monte Carlo: simular (toast verde), forçar erro com 2.000 dias (toast vermelho), aba Histórico vazia mostra a frase de estado vazio.
4. Conferir gráficos (Monte Carlo, ARIMA, Cenários, Metas) nos dois temas.
