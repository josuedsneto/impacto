# Tarefas: hedge cambial

Cada tarefa vira um commit atômico (Conventional Commits, em português). Requisitos entre colchetes.

| # | Tarefa | Requisitos | Arquivos |
|---|---|---|---|
| T1 | Extrair de `routers/cambio.py` as funções `serie_fx(hoje)` (série limpa, 503 se < 252) e `juros_em(ultimo_ts)` (Selic e Fed). `cambio_previsao` passa a usá-las; testes atuais continuam passando | HED-10 | `backend/routers/cambio.py` |
| T2 | Migration `20261118000008_analises_hedge_cambial.sql`: troca o CHECK de `analises.ferramenta`; `ferramenta` aceita `hedge_cambial` no Literal de `routers/analises.py` e em `frontend/lib/analises.ts` | HED-11 | `supabase/migrations/…`, `backend/routers/analises.py`, `frontend/lib/analises.ts` |
| T3 | `backend/hedge_cambial.py`: funções puras. Taxas do GK, prêmio P/C, taxa efetiva por estratégia, receita, métricas | HED-01..05, HED-07..09 | `backend/hedge_cambial.py` |
| T4 | Testes de T3: prêmio GK contra fórmula fechada e Monte Carlo; identidades em vol zero; collar K1=K2 = V·F; arrependimento e P abaixo do orçamento em caminhos conhecidos | HED-06..09 | `backend/tests/test_hedge_cambial.py` |
| T5 | `backend/routers/hedge_cambial.py`: `POST /api/hedge-cambial` (modelo de entrada com limites, `def`, `Depends`, `limiter`); `include_router` em `main.py` (uma linha) | HED-10 | `backend/routers/hedge_cambial.py`, `backend/main.py` |
| T6 | Testes de endpoint: 200 e formato, 400 em cada limite, K1 > K2, 503 sem juros, 503 sem dados | HED-04, HED-10 | `backend/tests/test_endpoints_hedge_cambial.py` |
| T7 | `frontend/lib/leitura.ts`: `leituraHedge` (+ teste em `leitura.test.ts`) | HED-12 | `frontend/lib/leitura.ts`, `frontend/lib/leitura.test.ts` |
| T8 | Tela `frontend/app/app/hedge-cambial/page.tsx`: formulário com padrões do spot e do forward (de `/api/cambio/previsao`), tabela, gráfico de faixa, aviso, premissas, CSV, `BotaoSalvarAnalise` | HED-05 (UI), HED-11, HED-12 | `frontend/app/app/hedge-cambial/page.tsx` |
| T9 | Entrada no menu: `NavLinks.tsx`, grupo "Risco e resultado", "Hedge cambial" (só a linha da entrada) | — | `frontend/components/layout/NavLinks.tsx` |
| T10 | `validation.md` com evidências (testes e saídas) e UAT | todos | `.specs/features/hedge-cambial/validation.md` |

Ordem: T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10. T2 não depende de nada; pode vir antes.

Revisão do advisor Opus: antes de T3 (matemática) e antes do último commit (diff).
