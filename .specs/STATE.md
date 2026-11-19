# Estado do projeto

## Decisões

| ID | Data | Decisão | Motivo |
|----|------|---------|--------|
| AD-001 | 2026-10-05 | Premissa do refactoring: **simples, bonito e claro para o usuário final** (equipe de usina/trading, UI em português). Toda spec é julgada contra essa premissa. | Pedido do usuário após a auditoria. |
| AD-002 | 2026-10-05 | Tema claro + escuro, com botão de troca no menu do usuário. Um único sistema de tema (o `ThemeProvider` próprio); `next-themes` sai. | Decisão do usuário. Hoje coexistem dois sistemas e nenhum funciona. |
| AD-003 | 2026-10-05 | Dados reais de ATR entram por upload de planilha (histórico) **e** por formulário mensal (lançamentos novos). | Decisão do usuário. `Historico Impurezas.xlsx` serve de carga inicial. |
| AD-004 | 2026-10-05 | Exportação em CSV padrão Excel BR: separador `;`, vírgula decimal, UTF-8 com BOM. | Decisão do usuário. Abre direto no Excel pt-BR, sem dependência nova. |
| AD-005 | 2026-10-05 | Responsivo completo: menu vira gaveta abaixo de 1024px; todas as páginas usáveis a partir de 360px. | Decisão do usuário. |
| AD-006 | 2026-10-05 | O app Streamlit legado sai do repositório. A remoção dos arquivos é feita pelo usuário (o agente foi bloqueado pela política de permissões). | Decisão do usuário. |
| AD-007 | 2026-10-05 | Correções de cálculo da auditoria já entregues no commit `39c87a1` (branch `refactor/auditoria`): volatilidade anual→diária no Monte Carlo, passo diário no Jump Diffusion, breakeven de Cenários via `brentq`, MC call exato, endpoints síncronos, cliente Supabase único, menu completo. | Bugs inequívocos, corrigidos antes das specs. |
| AD-008 | 2026-10-05 | Toda cor de interface vem de token em `frontend/app/globals.css` (paleta de gráficos validada com o dataviz); todo número exibido passa por `frontend/lib/format.ts`. `lib/regras-ui.test.ts` faz valer as duas regras. | Feature `fundacao-ui`; evita a volta de cores e formatação espalhadas. |
| AD-009 | 2026-11-18 | Deploy: frontend na Vercel e backend no Railway (host a confirmar). A VM Oracle (nginx, pm2, `deploy.yml`) saiu; o CI (`.github/workflows/ci.yml`) só testa. | Decisão do usuário. |
| AD-010 | 2026-11-18 | Tarefas agendadas usam o Vercel Cron (`frontend/vercel.json`) chamando `POST /api/jobs/*` do backend com `X-Job-Secret` (`JOBS_SECRET`). Não há processo residente. | Não existe VM. Funciona em qualquer host de backend. |
| AD-011 | 2026-11-18 | Endpoints novos ficam em `backend/routers/<frente>.py`; o rate limiter é único (`backend/limiter.py`). A divisão do `main.py` em routers fica para depois da integração. | Reduz conflito entre frentes paralelas. |
| AD-012 | 2026-11-18 | Câmbio: faixa de possibilidades (EWMA + simulação histórica filtrada), não previsão pontual. Backtest em `features/cambio-previsao/backtest.md`. A tela "Modelo do dólar" sai do menu (rota mantida, com link para Câmbio). | Câmbio é quase passeio aleatório; o backtest decide o modelo. |
| AD-013 | 2026-11-18 | Monte Carlo sem corte nos percentis: o `pct_bound` virou limite de referência ("X% dos cenários saíram da faixa"). Opções sobre futuro por Black-76; Garman-Kohlhagen pronto para o hedge cambial. | Percentis truncados e BS de spot distorciam o resultado. |

## Ordem de execução

As features dependem umas das outras nesta ordem. Cada uma tem `spec.md` em `features/`.

1. `limpeza-legado` — tira o ruído antes de mexer no resto.
2. `cliente-api` — base de toda chamada do frontend.
3. `fundacao-ui` — tokens, tema, formatação, feedback, layout responsivo.
4. `linguagem-clara` — textos, unidades e ajuda por página (usa `fundacao-ui`).
5. `exportar-csv` — usa o formatador de `fundacao-ui`.
6. `dados-mercado-cache` — backend.
7. `regressao-acucar-honesta` — backend + tela.
8. `atr-dados-reais` — backend + tela (a maior; depende de 2, 3, 4).
9. `backend-robustez` — ajustes P2.

## Handoff

- **Branch:** `refactor/auditoria` (com push).
- **Concluído:** `cliente-api`, `fundacao-ui`, `linguagem-clara`, `exportar-csv` (validações PASS); `limpeza-legado` exceto LEG-01.
- **Pendente do usuário:** UAT das quatro features (passos no fim de cada `validation.md`); `git rm` do Streamlit (LEG-01).
- **Próximo passo:** `dados-mercado-cache` (backend: VaR, ARIMA, Stress, Volatilidade e regressões via `get_prices`; corrigir fechamento intradiário congelado).
- **Ambiente:** testes do front `npm test`; backend `python test_calcs.py && python test_mensagens.py`; rodar `lessons.py` da raiz.


## Rodada 2026-11-18: auditoria e novas frentes

Branch integrada: `integracao/auditoria` (local, sem push), com as 16 frentes feitas em threads paralelas, cada uma com spec em `features/<slug>/`.

- **Correções:** `ci-deploy-vercel`, `atr-calibracao`, `monte-carlo-correcoes`, `seguranca-banco`, `cache-yahoo`, `opcoes-black76`.
- **Novas frentes:** `cambio-previsao`, `hedge-cambial`, `alertas` (com briefing diário como P2), `posicoes-fixacoes`, `risco-conjunto`, `minhas-analises`.
- **Melhorias:** `backend-robustez`, `frontend-dados`, `ux-acessibilidade`, `ux-navegacao-linguagem`, `regressao-acucar-honesta` + `regressao-dolar-cenario`.
- **Checagens na branch integrada:** backend com 231 testes do pytest, `test_calcs.py` e `test_mensagens.py`; frontend com 349 testes, lint, `tsc` e `next build`. Tudo passou.

**Pendente do usuário antes do deploy:**
1. Aplicar as migrations novas, nesta ordem: `20260403000000_admin_config` (idempotente; rode à mão se a `…000001` já foi aplicada), depois `20261118000001` a `20261118000008`. Rode o SQL de verificação de `features/seguranca-banco/validation.md`.
2. Variáveis de ambiente:
   - Railway: `JOBS_SECRET`, `RESEND_API_KEY`, `ALERTAS_FROM`, `ENABLE_DOCS` (deixe sem valor em produção).
   - Vercel: `CRON_SECRET`, `JOBS_SECRET`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`.
3. Confirmar o host do backend e o Root Directory da Vercel (`frontend/`).
4. UAT de cada frente, com os passos no `validation.md` dela.

**Próximos passos:** dividir `main.py` em routers; alerta `posicao_limite`; Telegram.


## Rodada 2026-11-19

Branch integrada: `integracao/rodada-2`, a partir da `main` já com os PRs #2 e #3.

- **`main-routers`:** `backend/main.py` foi de 2.000 para 53 linhas. As rotas foram para `backend/routers/*` e os helpers para `validacao.py`, `constantes.py`, `pregao.py` e `noticias.py`. O teste `tests/test_contrato_rotas.py` congela as 80 rotas.
- **`alertas` (rodada 2):** `prob_cruzar`, briefing diário por e-mail (opt-in, 10h30 UTC), `posicao_limite` e Telegram.
- **`pendencias-pequenas`:** reabrir análise de hedge, erro por linha no lote de posições, teste do heatmap, feriados da ICE (2026/2027, atualizar todo ano) e mínimo de 100 cenários no MC pricer.
- **Checagens:** backend com 291 testes, mais `test_calcs.py` e `test_mensagens.py`; frontend com 362 testes, lint, `tsc` e `next build`. Tudo passou.

**Pendente do usuário:**
1. Aplicar as migrations `20261119000001` a `20261119000004`.
2. Configurar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET` no Railway e registrar o webhook (`setWebhook`, comando na spec de alertas).
3. Conferir quantos crons o plano da Vercel permite (agora são 3).

**Decisões em aberto:**
- histerese do `prob_cruzar`;
- análise de hedge com orçamento vazio: reabrir no forward atual ou no salvo;
- remover a `watchlist`;
- tirar `SBK26.NYB` do catálogo;
- trocar Plotly por Recharts;
- teto do Monte Carlo.
