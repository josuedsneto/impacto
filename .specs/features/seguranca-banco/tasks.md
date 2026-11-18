# Tarefas — seguranca-banco

| # | Tarefa | Requisitos | Commit | Status |
|---|--------|------------|--------|--------|
| T1 | Validar `iss` no JWT e exigir `iss`; testes em `backend/tests/test_auth.py` | REQ-SEG-009..013 | `f97e970` | Done |
| T2 | `ENABLE_DOCS` controla `/docs`, `/redoc` e `/openapi.json`; `.env.example` | REQ-SEG-014..016 | `e4acb43` | Done |
| T3 | Criar `admin_config` (`20260403000000`) antes da migration de RLS | REQ-SEG-007..008 | `d64e3b3` | Done |
| T4 | Migration de grants: `anon` sem acesso; `market_coverage` com RLS; `admin_config`/`market_coverage` sem `authenticated` | REQ-SEG-001..003 | `5198d3f` | Done |
| T5 | Migration ATR: policy de UPDATE com `WITH CHECK`; `authenticated` sem INSERT/UPDATE/DELETE | REQ-SEG-004..006 | `04abe96` | Done |
| T6 | Helper `origemConfiavel` + teste + callback exige `NEXT_PUBLIC_SITE_URL` em produção | REQ-SEG-018..019 | `b6a7356` | Done |
| T7 | `next.config.ts`: CSP de produção sem localhost/wildcard; build falha sem variáveis | REQ-SEG-017 | `b6a7356` | Done (build: coordenadora) |
| T8 | Verificação (testes, lint, build) e `validation.md` | todos | (pendente) | Parcial: backend ok; frontend checks com a coordenadora |
| T9 | Registrar `watchlist` como candidata à remoção | — | — | Done (na spec; decisão do usuário) |
