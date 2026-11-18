# Tarefas — posicoes-fixacoes

- [ ] T1 — Migration `supabase/migrations/20261118000001_posicoes_fixacoes.sql`: `posicoes`, `politica_hedge`, CHECKs, índices, RLS (R5, R6, R8, R9, R10). (POS-01, POS-02, POS-03, POS-09)
- [ ] T2 — `backend/routers/__init__.py` e `backend/routers/posicoes.py`: cálculos puros (`calcular_mtm`, `resumo_safra`) com testes. (POS-04, POS-05)
- [ ] T3 — Endpoints CRUD, lote, política e resumo no router; `include_router` na última linha de `main.py`. (POS-01 a POS-05, POS-09)
- [ ] T4 — Testes de API com `FakeSupabase` estendido (insert/update/delete) em `backend/tests/test_posicoes.py`. (POS-01 a POS-05, POS-09)
- [ ] T5 — Frontend: `lib/posicoes.ts` (parser CSV, montagem do export, testes unitários). (POS-07, POS-08)
- [ ] T6 — Frontend: `app/app/posicoes/page.tsx` (cartões, tabela, importação, exportação, política). (POS-06, POS-07, POS-08, POS-09)
- [ ] T7 — `NavLinks.tsx`: uma linha "Posições da safra" em "Mercado". (POS-06)
- [ ] T8 — `validation.md` com evidências e UAT.
