# Tarefas — monte-carlo-correcoes

| # | Tarefa | Requisitos | Estado |
|---|--------|-----------|--------|
| T1 | `simulation.py`: sem clip; banda em log; `pct_passou_limite`; docstring real | MC-01, MC-02, MC-03 | feito |
| T2 | `simulation.py`: simulação em blocos de dias com carry do log | MC-05, MC-06 | feito |
| T3 | `simulation.py`: filtro de dados antes do log; `DadosInsuficientesError` | MC-08 | feito |
| T4 | `simulation.py`: `seed` na função | MC-09 | feito |
| T5 | `main.py`: `validate_ticker` na criação e no PUT de params; `preco_inicial gt=0` | MC-07 | feito |
| T6 | `main.py`: 422 para dados insuficientes; `pct_passou_limite` no insert | MC-08 | feito |
| T7 | Migração `pct_passou_limite` | MC-02 | feito (aplicar no Supabase) |
| T8 | `backend/tests/test_simulation.py` (blocos, filtro, pct≥1, rota) | MC-05..MC-09 | feito |
| T9 | `test_calcs.py`: seed fixa e asserção de não truncamento | MC-01, MC-09 | feito |
| T10 | `frontend/lib/simulacao.ts`: dois limites nomeados; MCPricer usa o de opções | MC-10 | feito |
| T11 | `SimulationForm`: preço de partida pelo último fechamento, copy de limite de referência | MC-04, MC-10 | feito |
| T12 | `SimulationMetrics` e CSV: `pct_passou_limite` | MC-04 | feito |
| T13 | Testes e gates (pytest, test_calcs, test_mensagens, npm test, lint, build) | todos | em andamento |
| T14 | Diff final revisado pelo advisor Opus | todos | pendente |
| T15 | `validation.md` com evidências e UAT | todos | pendente |
