# Alertas — Tarefas

Legenda: `[ ]` pendente · `[x]` feito. Cada tarefa vira um commit atômico (Conventional Commits, em português).

## MVP (P1)

- [ ] **T1** Migration `supabase/migrations/20261118000001_alertas.sql`: `alert_rules`, `alert_events`, índices, RLS. (ALE-06)
- [ ] **T2** `backend/alertas.py`: schemas Pydantic por tipo, `avaliar()` puro, `DadosInsuficientes`, `vol_30d_pct()`. (ALE-02)
- [ ] **T3** `backend/tests/test_alertas_avaliar.py`: transição, direções, variação, paridade da vol. (ALE-02, ALE-03)
- [ ] **T4** `backend/alertas.py`: `disparar_regra` (estado, cooldown, insert com `on conflict do nothing`, envio). (ALE-03, ALE-04)
- [ ] **T5** `backend/alertas.py`: `enviar_email_resend()` com `requests` e tratamento de ausência de chave. (ALE-04)
- [ ] **T6** `backend/routers/__init__.py` (vazio) e `backend/routers/jobs.py`: `require_job_secret` + `POST /api/jobs/alertas`. (ALE-04)
- [ ] **T7** `backend/routers/alertas.py`: CRUD, `/eventos`, `/{id}/testar`, limite de 20. (ALE-01, ALE-06)
- [ ] **T8** `backend/main.py`: uma linha `app.include_router` para cada router. (ALE-01, ALE-04)
- [ ] **T9** `backend/tests/test_alertas_api.py`: 422, 201, limite 20, 404 alheio, `prob_cruzar` e `telegram` recusados, job sem segredo → 401/503. (ALE-01, ALE-04)
- [ ] **T10** `frontend/app/api/cron/alertas/route.ts`: valida `CRON_SECRET` e chama o job. Teste vitest da validação. (ALE-04)
- [ ] **T11** `frontend/vercel.json`: cron `0 21 * * 1-5` para `/api/cron/alertas`. (ALE-04, DEC-01, DEC-02)
- [ ] **T12** `frontend/app/app/alertas/page.tsx`: lista, interruptor, formulário, testar, histórico. (ALE-05)
- [ ] **T13** `frontend/components/layout/NavLinks.tsx`: entrada "Alertas" na seção Risco. (ALE-05)
- [ ] **T14** Validação: `pytest`, `test_calcs.py`, `test_mensagens.py`, `npm test`, `npm run lint`, `npm run build`. Grava `validation.md`.

## Briefing (P2)

- [ ] **T15** Migration: tabela `preferencias_usuario` com RLS. (BRF-01)
- [ ] **T16** Opt-in na tela de alertas. (BRF-01)
- [ ] **T17** `backend/briefing.py` + `POST /api/jobs/briefing` em `routers/jobs.py`. Conteúdo do BRF-03. (BRF-02, BRF-03)
- [ ] **T18** `frontend/app/api/cron/briefing/route.ts` e entrada `30 10 * * 1-5` em `vercel.json`. (BRF-02)
- [ ] **T19** Testes do briefing: só opt-in recebe; conteúdo com alertas de ontem. (BRF-03)

## Pendências (fora deste ciclo)

- `prob_cruzar`: avaliador depende de `backend/cambio.py` (não existe nesta base).
- Telegram (v2).
- Intradiário a cada 15 min: exige plano Pro (DEC-02).
