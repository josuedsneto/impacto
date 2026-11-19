# Tarefas — painel-hoje

Cada tarefa vira um commit atômico (Conventional Commits, em português).

- [ ] **T1 — Backend: seções do painel.** `backend/routers/painel.py` com as seções `mercado`, `faixa_dolar`, `focus`, `alertas`, `posicoes`, `analises`, `pregao` e o `try/except` por seção. Cobre PNL-02 a PNL-10. Teste: `backend/tests/test_painel.py` (AC-1, AC-2, D-3).
- [ ] **T2 — Backend: registro.** `main.py` ganha `painel` no `from routers import (...)` e na tupla do laço. `test_contrato_rotas.py` ganha a linha da rota. Cobre PNL-11, PNL-12.
- [ ] **T3 — Frontend: tipos e carga.** `lib/types/api.ts` ganha `PainelHoje`; `lib/dados-servidor.ts` ganha `getPainelHoje`. Cobre PNL-19 (parte de dados).
- [ ] **T4 — Frontend: textos.** `lib/leitura.ts` ganha `leituraPosicaoPolitica` com testes em `lib/leitura.test.ts` (AC-4, AC-6 no texto de "sem posições").
- [ ] **T5 — Frontend: ordem.** `lib/painel.ts` exporta `URGENCIA` e `ordenar`, com teste em `lib/painel.test.ts` (AC-3, PNL-14).
- [ ] **T6 — Frontend: tela.** `app/app/dashboard/page.tsx` monta os sete cartões com `ordenar`, links (PNL-15) e estados vazios (PNL-18, AC-5). `NavLinks.tsx`: só a linha da entrada Dashboard.
- [ ] **T7 — Checagens.** Backend: pytest, `test_calcs.py`, `test_mensagens.py`. Frontend: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Registrar em `validation.md`.
