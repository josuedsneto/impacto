# Dados do frontend — Tarefas

**Spec**: `.specs/features/frontend-dados/spec.md`
**Status**: Em execução (branch `bb/melhoria-frontend-dados-thr_x8etdrks5p`)

## Tarefas

| ID | Tarefa | Requisitos | Status |
|---|---|---|---|
| T1 | Spec + revisão do advisor Opus | todos | feito |
| T2 | `lib/types/api.ts` (PriceRow, FocusData, MarketStatus) | FD-11 | feito |
| T3 | `lib/dados-servidor.ts` (URL validada, `Carga<T>`, `React.cache`) + teste | FD-01, FD-02, FD-04 | feito |
| T4 | Layout e dashboard usam `dados-servidor`; erro de cotação por ticker | FD-03, FD-04, FD-05 | feito |
| T5 | `rotuloMercado`, `formatDataHora`, `formatHora`, `formatInteiro` em `format.ts` + teste | FD-05, FD-09 | feito |
| T6 | Timeout com mensagem própria em `api.ts` + teste atualizado | FD-08 | feito |
| T7 | Regra de `toLocale*String`/`Intl.` em `regras-ui.test.ts`; troca nos pontos da auditoria e extras | FD-09 | feito |
| T8 | `lib/useApi.ts` (hook + `buscar`) + teste; breakeven usa o hook | FD-06, FD-07 | feito |
| T9 | Remover `any` de `FixacoesChart.tsx` | FD-10 | feito |
| T10 | Tipos duplicados de `FocusWidget` e `PriceCard` apontam para `lib/types/` | FD-11 | feito |
| T11 | `npm test`, `tsc --noEmit`, `npm run lint`, `npm run build` (medir Plotly) | gate | pendente |
| T12 | `validation.md` com evidências e UAT | gate | pendente |

## Ordem

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12
```

Commits atômicos seguem a ordem; cada um passa em `npm test`.
