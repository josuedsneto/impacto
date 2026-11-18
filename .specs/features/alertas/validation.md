# Alertas — Validação

Escopo entregue: MVP (ALE-01 a ALE-06). Briefing (BRF-01 a BRF-03, P2) **não foi implementado** nesta entrega: fica como segunda entrega, com tarefas T15–T19 abertas.

## Evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| ALE-01 CRUD, limite 20, 422, 404 alheio | `pytest tests/test_alertas_api.py` (criar, 422, prob_cruzar/telegram recusados, limite 20, pausar, 404 em PATCH/DELETE/testar/eventos) | PASS |
| ALE-02 avaliação pura e paridade da vol | `pytest tests/test_alertas_avaliar.py` (preço acima/abaixo, variação, None descartado, DadosInsuficientes, paridade com pandas/`/api/volatility`) | PASS |
| ALE-03 transição, cooldown, unique | `test_transicao_dispara_uma_vez_e_nao_repete`, `test_cooldown_bloqueia_e_depois_libera`, `test_estado_nulo_nao_dispara...` | PASS |
| ALE-04 job, segredo, Resend, dado velho | `test_job_sem_segredo_*` (401/503), `test_sem_resend_registra_erro...`, `test_ticker_com_dado_velho_e_pulado`; rota: `vitest lib/cron.test.ts` | PASS |
| ALE-05 tela e menu | `vitest` (regras de UI: sem cor literal, sem toFixed, h1 só no PageHeader) + `next build` (rota `/app/alertas` gerada) | PASS (UAT pendente) |
| ALE-06 RLS e filtro | migration com RLS; filtro `user_id` em todas as consultas (revisado pelo advisor) | PASS por leitura; RLS só valida no Supabase real |

## Comandos e resultado

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q   → 49 passed
cd backend && python test_calcs.py                           → ok (exit 0)
cd backend && python test_mensagens.py                       → ok (exit 0)
cd frontend && vitest run                                    → 15 files, 260 tests passed
cd frontend && next build                                    → exit 0, rota /api/cron/alertas e /app/alertas
cd frontend && eslint .                                      → 1 erro PRÉ-EXISTENTE em components/ui/input.tsx
                                                               (no-empty-object-type; arquivo gerado pelo shadcn, não tocado)
```

## Decisões registradas (ver spec.md, DEC-01 a DEC-19)

- Cron diário apenas (plano Hobby). `preco_cruza` não é intradiário. Upgrade Pro: nova entrada em `vercel.json` com `?tipos=preco_cruza`.
- Primeira avaliação não dispara (DEC-04); criação e reativação já gravam o estado.
- Cooldown com folga de 1 h (precisão de hora do cron).

## Pendências e riscos

1. **Migration não aplicada** no Supabase. Aplicar `20261118000003_alertas.sql` antes do deploy.
2. **Variáveis de ambiente**:
   - Backend (Railway): `JOBS_SECRET`, `RESEND_API_KEY`, `ALERTAS_FROM`.
   - Frontend (Vercel): `CRON_SECRET` (a Vercel envia no cron), `JOBS_SECRET` (mesmo valor do backend, sem `NEXT_PUBLIC_`), `NEXT_PUBLIC_API_URL` (já existe).
   - Sem `RESEND_API_KEY` os eventos ficam com `erro`; o job não quebra.
3. **Plano Vercel**: confirmar Hobby. Fontes divergem sobre o número de crons; o desenho usa 1 cron de alertas (e 1 de briefing no futuro).
4. **`prob_cruzar`**: avaliador pendente (`backend/cambio.py` não existe nesta base). A API recusa com 422; o job marcaria erro se houver linha antiga (não implementado, só na spec).
5. **Conflito provável**: `backend/routers/jobs.py` foi criado aqui; a thread cache-yahoo também prevê esse arquivo. Na integração, unir os dois lados (mesmo `require_job_secret`).
6. **Pré-existente**: `main.py` importa `RateLimitExceeded` mas não registra o handler; estourar o limite dá 500. Não corrigido aqui.
7. **Pré-existente**: lint com 1 erro em `components/ui/input.tsx`.
8. Sem reenvio automático de e-mail que falhou (DEC-07).

## UAT para o usuário

1. Aplicar a migration no Supabase e conferir RLS em `alert_rules` e `alert_events`.
2. Configurar as variáveis do item 2 e fazer deploy.
3. Em `/app/alertas`, criar um alerta de preço do açúcar com nível um pouco acima do último fechamento. Conferir que aparece na tabela com "Preço abaixo/acima de…".
4. Clicar em **Testar** e conferir a mensagem "Teste agora".
5. Pausar o alerta pelo interruptor e conferir que não dispara; reativar.
6. Criar 20 alertas e conferir a mensagem de limite no 21º.
7. Rodar o job manualmente (`POST /api/jobs/alertas` com `X-Job-Secret`) quando a condição estiver verdadeira. Conferir o e-mail e a linha em **Histórico de disparos**.
8. Rodar o job de novo no mesmo dia e confirmar que não há segundo e-mail.
9. Apagar um alerta e confirmar o aviso sobre o histórico.
