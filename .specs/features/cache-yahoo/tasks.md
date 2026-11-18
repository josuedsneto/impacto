# Cache Yahoo — Tasks

**Design:** inline (feature Medium). Decisões registradas em `spec.md` (Assumptions). Advisor Opus revisou a spec antes da implementação; correções aplicadas.

| # | Tarefa | Requisitos | Arquivos |
|---|---|---|---|
| T1 | Remover `_yf_session` de `main.py` e `market_cache.py`; sem sessão explícita | YAH-01 | `backend/main.py`, `backend/market_cache.py` |
| T2 | Negativo com TTL de 6 h para intervalos vazios (sem marcar cobertura) | YAH-02 | `backend/market_cache.py`, `backend/tests/conftest.py` |
| T3 | `to_dict("records")` no upsert; ramo duplicado de colunas simplificado | YAH-03 | `backend/market_cache.py` |
| T4 | `estado_pregao` pelo calendário ICE; `UNKNOWN` em erro; sem Yahoo | YAH-04 | `backend/main.py` |
| T5 | `statusMercado` no front; fallback `UNKNOWN` mostra "Status indisponível" | YAH-05 | `frontend/lib/mercado.ts`, `frontend/app/app/layout.tsx` |
| T6 | `require_job_secret` + `POST /api/jobs/aquecer-cache` | YAH-06.1–06.4 | `backend/routers/jobs.py`, `backend/main.py` |
| T7 | Rota do cron com `CRON_SECRET`, `vercel.json` (`0 6 * * 1-5`) | YAH-06.2, 06.3 | `frontend/app/api/cron/aquecer-cache/route.ts`, `frontend/vercel.json` |
| T8 | `/api/health?deep=1` | YAH-07 | `backend/main.py` |
| T9 | Timeout (10 s) e URL codificada nas notícias; log no Focus | YAH-08 | `backend/main.py` |
| T10 | `tzdata` em `requirements.txt` (zoneinfo no Windows) | YAH-04 | `backend/requirements.txt` |

## Test Coverage Matrix

| Camada | Tipo | Arquivo |
|---|---|---|
| `market_cache.py` | unit | `backend/tests/test_market_cache.py` |
| Endpoints, job, health, status | integração (TestClient) | `backend/tests/test_cache_yahoo.py` |
| Helper de status (front) | unit | `frontend/lib/mercado.test.ts` |
| Rota do cron | unit (handler GET) | `frontend/lib/cron-aquecer.test.ts` |

## Gate Check Commands

| Gate | Comando |
|---|---|
| Backend | `cd backend && .venv/Scripts/python -m pytest tests -q && python test_calcs.py && python test_mensagens.py` |
| Frontend | `cd frontend && npm test && npm run lint && npm run build` |
