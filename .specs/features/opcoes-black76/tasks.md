# Tasks — opcoes-black76

| # | Tarefa | Requisitos | Arquivos |
|---|---|---|---|
| T1 | `compute_payoff` rejeita `position` desconhecido | Entrada AC5 | backend/options.py |
| T2 | `black76_price` (call/put) e teste de paridade + referência ATM | Black-76 AC1, AC2 | backend/options.py, backend/tests/test_options.py |
| T3 | `mc_black76_price` com seed e teste de convergência | Black-76 AC3 | backend/options.py, backend/tests/test_options.py |
| T4 | Remover `bs_call_price`/`mc_call_price`; atualizar `test_calcs.py` | Black-76 | backend/options.py, backend/test_calcs.py |
| T5 | Modelos Pydantic com `Literal`, limites, `F` no lugar de `S`; `ValueError`→400 | Black-76 AC4, Entrada AC1–AC6 | backend/main.py (só linhas de opções) |
| T6 | Testes de endpoint de validação (422) e 400 | Entrada AC1–AC4, AC6 | backend/tests/test_options.py |
| T7 | `gk_price` com testes | GK AC1–AC3 | backend/options.py, backend/tests/test_options.py |
| T8 | Front: `CamposOpcao` com `F`, unidade ¢/lb, `paraApi` e teste | P2 AC2 | frontend/components/options/CamposOpcao.tsx(+.test.ts) |
| T9 | Front: `BSPricer` automático, limpa preço inválido, nomes de aba | P2 AC1, AC3, AC4 | frontend/components/options/BSPricer.tsx, frontend/app/app/options/page.tsx |
| T10 | Front: `MCPricer` automático (debounce, sem botão) | P2 AC3, AC4 | frontend/components/options/MCPricer.tsx |
| T11 | Front: unidade no `PayoffChart` | P2 AC5 | frontend/components/options/PayoffChart.tsx, page.tsx |
| T12 | Limite do MC 10→60/min | Decisão de spec | backend/main.py |
| T13 | validation.md com evidências | — | .specs/features/opcoes-black76/validation.md |
