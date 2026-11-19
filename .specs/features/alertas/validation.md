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

---

# Rodada 2 (alertas-v2): prob_cruzar, posicao_limite, Telegram e briefing

Spec: `spec.md` (ALE-07 a ALE-09, BRF-01 a BRF-03, DEC-20 a DEC-27). Tarefas T20 a T25 em `tasks.md`.

## Evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| ALE-07 prob_cruzar | `tests/test_alertas_v2.py`: probabilidade em [0,1] e monotônica no nível; direção abaixo; limiar; mesma regra e dia dá o mesmo valor; semente depende de regra e dia; 30 fechamentos levantam DadosInsuficientes; schema recusa horizonte 300 e prob 1,5 | PASS |
| ALE-08 posicao_limite | `test_alertas_v2.py`: abaixo, dentro e acima da faixa; sem política pulada; NDF fora do % e opção de açúcar dentro; job não busca preço (`get_prices` falha se chamado) e pula quem saiu da usina | PASS |
| ALE-08 função compartilhada | `tests/test_posicoes.py` (24 passed) após extrair `politica_hedge.situacao` | PASS |
| ALE-09 Telegram | `test_alertas_v2.py`: sem token 503; webhook sem secret 503 e header errado 401; vínculo grava chat_id e consome o código (uso único); código expirado e grupo não vinculam; canal telegram aceito só com vínculo; erro de envio grava mensagem fixa | PASS |
| BRF-01 opt-in | `test_briefing_so_vai_para_quem_optou`: só quem optou recebe; manchete escapada no HTML | PASS |
| BRF-02 cron | `frontend/vercel.json` (3 crons); `app/api/cron/briefing/route.ts` gerada no build | PASS |
| BRF-03 conteúdo | `test_ultimo_dia_util_anterior_pula_fim_de_semana` (segunda pega sexta); seção "indisponível" quando falta dado | PASS |
| ALE-05 tela | `vitest` (regras de UI) + `next build` (`/app/alertas`) | PASS |

## Comandos e resultado

```
cd backend && pytest tests -q                 → 275 passed
cd backend && python test_calcs.py            → exit 0
cd backend && python test_mensagens.py        → exit 0
cd frontend && vitest run                     → 24 files, 359 tests passed
cd frontend && npx tsc --noEmit               → exit 0
cd frontend && next build --webpack           → exit 0 (rotas /app/alertas e /api/cron/briefing geradas)
```

Build com Turbopack (`next build` padrão) falha nesta máquina por causa da junção `node_modules` apontando para fora da worktree (erro "Symlink ... points out of the filesystem root"). Não é erro de código; a checagem foi feita com `--webpack`.

## Decisões e limitações registradas

- DEC-20: `prob_cruzar` não bloqueia nível já do lado da direção (o valor fica perto de 1). Documentado na tela.
- DEC-21: sem histerese; uma regra rente ao limiar pode disparar de novo após o cooldown.
- DEC-22: checagem de membro na criação e a cada rodada.
- DEC-24: no plano Hobby o briefing sai entre 07:00 e 07:59 de Brasília, não às 07:30.
- DEC-25: a URL de manchetes está duplicada com `main.get_news`; `main.py` não foi tocado além do include.
- Feriados não são tratados em "alertas de ontem" (DEC-26).

## Pendências e riscos

1. **Migrations não aplicadas** no Supabase: `20261119000001` (preferencias_usuario), `20261119000002` (CHECK de tipo com posicao_limite), `20261119000003` (telegram_vinculos). Aplicar nesta ordem, depois das da rodada anterior (`20261118000001` a `000008`). Conferir RLS das três tabelas.
2. **Variáveis de ambiente**:
   - Railway: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (além de `JOBS_SECRET`, `RESEND_API_KEY`, `ALERTAS_FROM`).
   - Vercel: nenhuma nova (usa `CRON_SECRET`, `JOBS_SECRET`, `NEXT_PUBLIC_API_URL` já existentes).
3. **Webhook do Telegram**: registrar com `setWebhook` (comando em `spec.md`, seção "Canal Telegram").
4. **Plano Vercel**: três crons em `vercel.json`. A documentação atual aceita, mas fontes antigas falam em dois no Hobby. Confirmar no painel após o deploy.
5. **Hobby e horário**: o cron de briefing roda entre 10:00 e 10:59 UTC.
6. **Limite do Resend**: os envios do briefing são espaçados em 0,6 s; com muitos opt-ins, o job pode passar de 60 s. Acompanhar pelo resumo do job.

## UAT para o usuário

1. Aplicar as três migrações e conferir RLS em `preferencias_usuario` e `telegram_vinculos`.
2. Configurar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET` no Railway e registrar o webhook.
3. Em `/app/alertas`, criar um alerta de **chance de tocar** o dólar (USDBRL=X): nível perto do último fechamento, direção, 5 dias úteis e 30%. Conferir o texto da tabela e clicar em **Testar**.
4. Criar um alerta de **% fixado fora da política**: escolher a usina e a safra. Se a usina não tiver política, o teste mostra o aviso de sem política.
5. Em **Telegram**, clicar em **Gerar código**, enviar `/start CÓDIGO` ao bot em conversa privada e clicar em **Já enviei o código**. Conferir que o canal Telegram fica disponível no formulário.
6. Criar um alerta com canal Telegram e disparar o job manualmente quando a condição estiver verdadeira. Conferir a mensagem no chat.
7. Em **Briefing diário**, ativar o interruptor. No dia seguinte, conferir o e-mail às 7h (horário de Brasília) com spot, variação, Focus, manchetes e alertas do último pregão.
8. Desativar o interruptor e confirmar que o briefing não chega mais.

---

# Rodada 3 (alertas-v3): histerese, bloqueio de nível já cruzado e sinal técnico

## Requisitos e evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| ALE-10 histerese `prob_cruzar` (margem, rearme abaixo de prob − margem) | `pytest backend/tests/test_alertas_v3.py -k "oscilacao or rearme or armada"` | Passa. Sem histerese a mesma série dispara 4 vezes; com ela, 1 |
| ALE-10 histerese `preco_cruza` (`margem_pct`, 0 mantém o atual) | `test_preco_margem_zero_mantem_comportamento_atual`, `test_preco_com_margem_so_rearma_alem_da_margem`, `test_preco_armado_na_faixa_de_margem_dispara_ao_cruzar` | Passa |
| ALE-10 validação de `margem` (< prob, 0 a 0,2; `margem_pct` 0 a 20) | `test_margem_igual_ou_maior_que_limiar_e_recusada`, `test_margem_fora_do_intervalo_e_recusada`, `test_margem_omitida_vira_padrao_na_validacao` | Passa |
| ALE-11 bloqueio de nível já cruzado na criação (422 com mensagem exata) | `test_ja_cruzado_*`, `test_criar_prob_ja_cruzada_responde_422` | Passa |
| ALE-11 bloqueio na edição (`PATCH` com `params`, só prob_cruzar) | `test_editar_params_ja_cruzado_responde_422`, `test_editar_params_de_outro_tipo_responde_422` | Passa |
| ALE-11 sem preço: aceita e registra aviso | `test_sem_preco_aceita_e_registra_aviso` | Passa |
| ALE-12 sinal técnico: sinal na última barra, não em barra anterior, sem dado suficiente | `test_sinal_*`, `test_poucas_barras_levantam_dados_insuficientes` | Passa |
| ALE-12 API de sinal técnico e indicador inválido | `test_criar_sinal_tecnico_responde_201_e_indicador_invalido_422` | Passa |
| ALE-12 migração `20261120000007` | Revisada por leitura (padrão da 20261119000002). Não aplicada no banco | Pendente de aplicação |
| ALE-10/12 tela e frase de leitura | `npm test` (`lib/alertas.test.ts`, bloco "alertas v3") | Passa |

### Comandos e resultados

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q
→ 320 passed, 5 warnings in 93.74s

cd backend && python test_calcs.py      → exit=0
cd backend && python test_mensagens.py  → exit=0

cd frontend && npm test
→ Test Files 25 passed (25) · Tests 367 passed (367)

cd frontend && npm run lint  → exit=0
cd frontend && npx tsc --noEmit  → exit=0
cd frontend && npm run build  → FALHOU (TurbopackInternalError: "Symlink [project]/node_modules is invalid, it points out of the filesystem root"). Causa: o node_modules desta worktree é uma junção para a checkout principal, e o Turbopack recusa o link. Não é erro de código. Build NÃO verificado: rodar `npm run build` numa checkout com node_modules próprio antes do merge.
```

## Decisões desta rodada (DEC-28 a DEC-32, ver spec.md)

- `ultimo_estado = true` significa "ligado" para `prob_cruzar` e `preco_cruza`: o rearme só acontece abaixo da faixa de margem. Estado armado ou nulo não é afetado pela faixa.
- Regra antiga sem `margem` usa `min(0,05; prob/2)`, para nunca travar.
- `PATCH` com `params` existe só para `prob_cruzar` (interpretação de "edição", ver DEC-30). Mudar `params` zera `ultimo_estado` e reavalia sem disparar.
- `sinal_tecnico` usa a barra do último pregão. Se o cron falha ou a barra atrasa, o sinal daquele dia se perde (limitação aceita, ver DEC-31).

## Pendências e riscos

1. **Migração não aplicada**: `20261120000007_alertas_sinal_tecnico.sql`. Aplicar antes do backend desta rodada: sem ela, criar `sinal_tecnico` dá erro de CHECK.
2. **Build não verificado** (ver resultado acima): rodar `npm run build` com `node_modules` real antes do merge.
3. **Limitação de barra atrasada**: se a barra do dia não entrar no cache a tempo, o sinal daquele dia não dispara (DEC-31).
4. **Edição**: não há tela de edição; o `PATCH` com `params` existe na API e não é usado pela tela.
5. Sem mudanças de variável de ambiente nem de cron nesta rodada.

## UAT para o usuário

1. Aplicar `20261120000007_alertas_sinal_tecnico.sql` no Supabase e conferir o CHECK de `tipo`.
2. Em `/app/alertas`, criar um alerta de **chance de tocar** o dólar com nível já do lado da direção (ex.: acima de 5,00 com o dólar a 5,60). Conferir a mensagem de bloqueio.
3. Criar o mesmo alerta com nível do lado certo. Conferir o texto "volta a valer abaixo de …%" na tabela.
4. Criar um alerta de **preço** com margem de 2% e conferir a frase "volta a valer ao recuar 2% além do nível".
5. Criar um alerta de **sinal técnico**: RSI, compra, sobre SB=F. Conferir a frase "Sinal técnico de RSI de compra no último fechamento" e clicar em **Testar**: a mensagem deve dizer que é sinal técnico, não recomendação.
