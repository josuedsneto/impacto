# Alertas — Tarefas

Legenda: `[ ]` pendente · `[x]` feito. Cada tarefa vira um commit atômico (Conventional Commits, em português).

## MVP (P1)

- [x] **T1** Migration `supabase/migrations/20261118000003_alertas.sql`: `alert_rules`, `alert_events`, índices, RLS. (ALE-06)
- [x] **T2** `backend/alertas.py`: schemas Pydantic por tipo, `avaliar()` puro, `DadosInsuficientes`, `vol_30d_pct()`. (ALE-02)
- [x] **T3** `backend/tests/test_alertas_avaliar.py`: transição, direções, variação, paridade da vol. (ALE-02, ALE-03)
- [x] **T4** `backend/alertas.py`: `disparar_regra` (estado, cooldown, insert com `on conflict do nothing`, envio). (ALE-03, ALE-04)
- [x] **T5** `backend/alertas.py`: `enviar_email_resend()` com `requests` e tratamento de ausência de chave. (ALE-04)
- [x] **T6** `backend/routers/__init__.py` (vazio) e `backend/routers/jobs.py`: `require_job_secret` + `POST /api/jobs/alertas`. (ALE-04)
- [x] **T7** `backend/routers/alertas.py`: CRUD, `/eventos`, `/{id}/testar`, limite de 20. (ALE-01, ALE-06)
- [x] **T8** `backend/main.py`: uma linha `app.include_router` para cada router. (ALE-01, ALE-04)
- [x] **T9** `backend/tests/test_alertas_api.py`: 422, 201, limite 20, 404 alheio, `prob_cruzar` e `telegram` recusados, job sem segredo → 401/503. (ALE-01, ALE-04)
- [x] **T10** `frontend/app/api/cron/alertas/route.ts`: valida `CRON_SECRET` e chama o job. Teste vitest da validação. (ALE-04)
- [x] **T11** `frontend/vercel.json`: cron `0 21 * * 1-5` para `/api/cron/alertas`. (ALE-04, DEC-01, DEC-02)
- [x] **T12** `frontend/app/app/alertas/page.tsx`: lista, interruptor, formulário, testar, histórico. (ALE-05)
- [x] **T13** `frontend/components/layout/NavLinks.tsx`: entrada "Alertas" na seção Risco. (ALE-05)
- [x] **T14** Validação: `pytest`, `test_calcs.py`, `test_mensagens.py`, `npm test`, `npm run lint`, `npm run build`. Grava `validation.md`.

## Briefing (P2)

- [x] **T15** Migration: tabela `preferencias_usuario` com RLS. (BRF-01)
- [x] **T16** Opt-in na tela de alertas. (BRF-01)
- [x] **T17** `backend/briefing.py` + `POST /api/jobs/briefing` em `routers/jobs.py`. Conteúdo do BRF-03. (BRF-02, BRF-03)
- [x] **T18** `frontend/app/api/cron/briefing/route.ts` e entrada `30 10 * * 1-5` em `vercel.json`. (BRF-02)
- [x] **T19** Testes do briefing: só opt-in recebe; conteúdo com alertas de ontem. (BRF-03)

## Rodada 2 (alertas-v2)

- [x] **T20** Spec atualizada (ALE-07 a ALE-09, DEC-20 a DEC-27) e revisada pelo advisor Opus. Migrations `20261119000001` a `000003`.
- [x] **T21** `backend/cambio`: `prob_cruzar` com semente por regra e dia (DEC-20/21). (ALE-07)
- [x] **T22** `backend/politica_hedge.py`: `situacao()` pura, usada por `/api/posicoes/resumo` e pelo alerta. (ALE-08)
- [x] **T23** `posicao_limite`: criação com membro, avaliação sem preço, checagem de membro no job. (ALE-08)
- [x] **T24** Telegram: `telegram_bot.py`, `routers/telegram.py` (código, status, desvínculo, webhook), canal na API. (ALE-09)
- [x] **T25** Frontend: tipos novos no formulário, canal, interruptor do briefing, vínculo do Telegram, `cron/briefing` e `vercel.json`. (ALE-05, ALE-09, BRF-01/02)

## Pendências (fora deste ciclo)

- Intradiário a cada 15 min: exige plano Pro (DEC-02).
- Lógica de manchetes duplicada com `main.get_news` (DEC-25): unir quando `main.py` for dividido.
- Histerese para `prob_cruzar` (ver DEC-21): não implementada.
- Bloqueio na criação de `prob_cruzar` com nível já do lado da direção (DEC-20): não implementado.
