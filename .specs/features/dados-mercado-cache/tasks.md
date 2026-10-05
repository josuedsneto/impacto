# Dados de mercado pelo cache — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline (feature Medium). Decisões:

- `get_prices` continua sendo a única porta para preços históricos. Ganha: rebusca dos últimos 5 dias corridos com upsert que sobrescreve (no máximo a cada 30 min por ticker por processo) e tolerância a falha do Yahoo (log de aviso e devolve o que há no cache).
- Em `main.py`, um helper `fechamentos(ticker, inicio, fim)` devolve a série de fechamentos (pandas) e a data do último dado, ou levanta 503 com a mensagem da spec quando não há nada.
- `/api/stress` passa a responder `{ cenarios, ultimo_dado }` (antes era lista); a tela de estresse acompanha.
- Regressões reamostram os fechamentos diários do cache (mensal para o dólar, anual para o açúcar).
- A sonda de `/api/market/suggest` usa `market_cache._fetch_from_yfinance` (continua consultando o Yahoo, que é o objetivo da sonda, mas por um único ponto).
- Testes com pytest em `backend/tests/`, com Supabase e Yahoo simulados. Ambiente: `backend/.venv`.

**Status**: Draft

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| `market_cache.py` | unit | 1:1 com CACHE-03/04 e edge cases | `backend/tests/test_market_cache.py` | `cd backend && .venv/Scripts/python -m pytest -q` |
| Endpoints FastAPI | integration (TestClient) | happy + 503 + `ultimo_dado` por rota | `backend/tests/test_endpoints_mercado.py` | idem |
| `regression.py` | unit | dados vindos de `get_prices` | `backend/tests/test_regression_cache.py` | idem |
| Telas | unit (varredura) / build | tipos e build | - | `cd frontend && npm test && npm run build` |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Tasks de backend | `cd backend && .venv/Scripts/python -m pytest -q && python test_calcs.py && python test_mensagens.py` |
| Build | Task de frontend e fim | Quick + `cd frontend && npm test && npx tsc --noEmit && npm run build` |

---

## Execution Plan

### Phase 1: Cache e endpoints

```
T1 → T2 → T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: Fechamento correto e falha do Yahoo no cache

**What**: rebusca dos últimos 5 dias com upsert que sobrescreve, limite de 30 min por ticker, e fallback com log quando o Yahoo falha.
**Where**: `backend/market_cache.py`
**Depends on**: None
**Reuses**: `get_prices`, `_upsert_prices`
**Requirement**: CACHE-03, CACHE-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Testes: valor gravado de ontem é sobrescrito; segunda chamada em menos de 30 min não busca; Yahoo com exceção → log de aviso e linhas do cache

**Tests**: unit
**Gate**: quick
**Commit**: `fix(cache): corrige fechamento intradiário e tolera falha do Yahoo`

---

### T2: VaR e Volatilidade pelo cache

**What**: helper `fechamentos()`; `/api/var` e `/api/volatility` leem por `get_prices`, devolvem `ultimo_dado` e 503 com a mensagem da spec sem dados.
**Where**: `backend/main.py`
**Depends on**: T1
**Reuses**: `get_prices`
**Requirement**: CACHE-01, CACHE-04, CACHE-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Testes com TestClient: 200 com `ultimo_dado`; 503 com a mensagem; nenhuma chamada ao Yahoo quando o cache cobre o período

**Tests**: integration
**Gate**: quick
**Commit**: `refactor(api): lê VaR e volatilidade do cache de preços`

---

### T3: ARIMA e Teste de estresse pelo cache

**What**: `/api/arima/{ticker}` (2 anos) e `/api/stress` (desde 2007-01-01) por `get_prices`, com `ultimo_dado`; stress passa a `{ cenarios, ultimo_dado }`.
**Where**: `backend/main.py`
**Depends on**: T2
**Reuses**: `fechamentos()`
**Requirement**: CACHE-01, CACHE-02, CACHE-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste: com série desde 2007, "Crise 2008" tem início e fim preenchidos

**Tests**: integration
**Gate**: quick
**Commit**: `refactor(api): lê ARIMA e estresse do cache, com crise de 2008`

---

### T4: Regressões pelo cache

**What**: `regression.py` usa `get_prices` (dólar mensal, açúcar anual, valores atuais); respostas de run e defaults com `ultimo_dado`.
**Where**: `backend/regression.py`
**Depends on**: T3
**Reuses**: `get_prices`
**Requirement**: CACHE-01, CACHE-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste: séries mensal e anual montadas a partir de linhas diárias simuladas; `grep yf.download` vazio em `main.py` e `regression.py` (teste automatizado)

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(regressao): lê preços do cache`

---

### T5: Sonda de sugestão por um único ponto

**What**: `/api/market/suggest` usa `market_cache._fetch_from_yfinance`; `yf` e `_yf_session` saem de `main.py` exceto `market_status`.
**Where**: `backend/main.py`
**Depends on**: T4
**Reuses**: `_fetch_from_yfinance`
**Requirement**: CACHE-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Teste: sugestão de ticker sem dados responde 400 com a mensagem em português

**Tests**: integration
**Gate**: quick
**Commit**: `refactor(api): sonda de ativo sugerido passa pelo módulo de cache`

---

### T6: "Dados até" nas telas

**What**: VaR, Volatilidade, ARIMA, Teste de estresse e modelos mostram "Dados até dd/mm/aaaa"; estresse lê o novo formato da resposta.
**Where**: `frontend/app/app/stress/page.tsx`
**Depends on**: T5
**Reuses**: `PageHeader.atualizadoEm`, `formatDate`
**Requirement**: CACHE-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Build e testes do front passam

**Tests**: none
**Gate**: build
**Commit**: `feat(ui): mostra a data do último preço usado`

---

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram | Status |
|---|---|---|---|
| T1 | None | início | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T2 | T2 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |

## Test Co-location Validation

| Task | Layer | Requires | Says | Status |
|---|---|---|---|---|
| T1, T4 | backend módulo | unit | unit | ✅ |
| T2, T3, T5 | endpoints | integration | integration | ✅ |
| T6 | telas | build | none | ✅ |
