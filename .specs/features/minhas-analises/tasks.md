# Minhas análises — Tasks

**Design**: inline (feature Média). Decisões na spec (ANA-D1, ANA-D2 e a tabela de Assumptions), revisadas pelo advisor Opus antes da implementação.

## Test Coverage Matrix

| Camada | Tipo de teste | Local | Comando |
|---|---|---|---|
| API `routers/analises.py` | pytest (dono, limites, paginação, validação) | `backend/tests/test_analises.py` | `cd backend && pytest tests -q` |
| `lib/analises.ts` | vitest unitário | `frontend/lib/analises.test.ts` | `cd frontend && npm test` |
| Telas e menu | varredura de código | `frontend/lib/regras-analises.test.ts` | `cd frontend && npm test` |
| Migration RLS | revisão + UAT no Supabase | `supabase/migrations/20261118000001_analises.sql` | UAT |

## Execution Plan

### Fase 1: Backend
- [x] T1 Migration `analises` com RLS (4 políticas), CHECK e índice — `48965ae`
- [x] T2 Router CRUD + listagem com filtro e paginação, limites medidos no backend — `48965ae`
- [x] T3 Testes de dono (404), limites (422), UUID inválido (422), `limit` > 100 (422) — `48965ae`

### Fase 2: Frontend
- [x] T4 `lib/analises.ts` (título, regra de 3 da mesma ferramenta, comparação, relatório) — `1c8a1d2`
- [x] T5 `BotaoSalvarAnalise` + ligação em VaR, Breakeven (aba Manual), Risco e Opções — `1c8a1d2`
- [x] T6 Hook `useReabrirAnalise` (`?reabrir=<id>`) nas quatro telas — `1c8a1d2`
- [x] T7 Tela `app/app/analises/page.tsx`: lista, filtro, renomear, excluir, comparar, imprimir — `1c8a1d2`
- [x] T8 Entrada "Minhas análises" em `NavLinks.tsx` — `1c8a1d2`
- [x] T9 Testes vitest e varredura de regras — `1c8a1d2`

### Fase 3: Validação
- [x] T10 Advisor Opus revisa o diff final (ver validation.md)
- [x] T11 `validation.md` com evidências e UAT
