# Tarefas — backend-robustez

Cada tarefa vira um commit atômico (Conventional Commits, em português).

| ID | Tarefa | Requisitos | Status |
|----|--------|-----------|--------|
| T-01 | Logging e request-id: `observabilidade.py` (configurar_logs, RequestIdMiddleware com handler global 500 em JSON) e ligação em `main.py` | HARD-02, HARD-10 | Pending |
| T-02 | Limpeza de imports e código morto em `main.py`; `serie_fechamentos` em `market_cache.py` usada por `fechamentos` e `regression.py` | HARD-11 | Pending |
| T-03 | `def` nos endpoints com I/O; remoção de `asyncio.get_event_loop()` | HARD-07 | Pending |
| T-04 | Rate limit nos seis endpoints; `request: Request` nas assinaturas | HARD-08 | Pending |
| T-05 | Validação de indicadores (HARD-01) e limites de paginação, período, VaR e tamanho de JSON | HARD-01, HARD-06 | Pending |
| T-06 | `opcao` como Literal no salvamento de cenários | HARD-06 | Pending |
| T-07 | Pedidos que geravam 500: breakeven com fechamento nulo; payoff vazio; risco com P15/média/P85 fora de ordem e truncamento | HARD-02 | Pending |
| T-08 | 409 só para violação de unicidade (23505) em usinas | HARD-09 | Pending |
| T-09 | Listagem paginada de usuários do Auth | HARD-03 | Pending |
| T-10 | Migração de `admin_config` com as constantes; leitura com fallback e aviso; validação numérica no PUT | HARD-04 | Pending |
| T-11 | Constantes aplicadas em Metas, Risco, Cenários e Breakeven | HARD-04 | Pending |
| T-12 | Heatmap de Metas centrado no último fechamento; destaque da célula central na tela | HARD-05 | Pending |
| T-13 | Jump-diffusion vetorizado (parecer do advisor sobre o compensador) | HARD-12 | Pending |
| T-14 | Testes em `backend/tests/test_robustez.py` | todos | Pending |
| T-15 | `validation.md` com evidências e UAT | todos | Pending |
