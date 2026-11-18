# Segurança do banco, auth e configuração de produção — Especificação

## Problem Statement

A auditoria encontrou falhas na camada de dados e de configuração. A anon key é pública, e o Supabase concede privilégios a `anon` e `authenticated` em `public` por padrão. Por isso `market_coverage` (sem RLS) e outras tabelas ficavam acessíveis a quem tivesse só a chave pública. Uma policy de UPDATE em `atr_simulacoes` sem `WITH CHECK` deixava o próprio usuário mover uma simulação para outra usina, e a policy de INSERT aceitava qualquer `usina_id`. `admin_config` não tinha `CREATE TABLE` em `supabase/migrations/`, então um banco novo falhava. O JWT não conferia `iss`. O Swagger só era desligado com `RAILWAY_ENVIRONMENT`. O CSP de produção mantinha `localhost:8000` e `*.supabase.co`, e o callback de auth aceitava o header `Host` como origem.

## Goals

- [ ] `anon` não tem nenhum privilégio em tabelas de `public`.
- [ ] `market_coverage` e `admin_config` não são acessíveis por `authenticated`.
- [ ] `authenticated` não escreve em `atr_simulacoes`; usuário não move simulação de usina.
- [ ] Um banco novo aplica as migrations em ordem, sem falha em `admin_config`.
- [ ] Tokens com `iss` de outro projeto, `aud`/`alg`/`sub`/`exp` inválidos são rejeitados (testado).
- [ ] `/docs`, `/redoc` e `/openapi.json` ficam desligados por padrão; ligam só com `ENABLE_DOCS=true`.
- [ ] Build de produção falha sem origens configuradas; callback não aceita `Host` em produção.

## Out of Scope

| Item | Motivo |
|------|--------|
| Remover a tabela `watchlist` | Decisão do usuário. Só fica registrada como candidata (abaixo). |
| Trocar `'unsafe-inline'` do CSP por nonce | Exige reescrever o layout do Next. Dívida separada. |
| Aplicar as migrations no projeto Supabase | Quem aplica é o usuário (SQL de verificação abaixo). |
| Rever policies de `simulations`, `user_parameters`, `breakeven_simulations`, `risco_simulations`, `cenarios_simulations`, `regression_runs` | Não mudam além do REVOKE de `anon`. As policies de `authenticated` continuam. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| `anon` | `REVOKE ALL` em todas as 14 tabelas de `public` + `ALTER DEFAULT PRIVILEGES ... REVOKE ALL ON TABLES FROM anon` | Nenhuma policy cita `anon`; defesa em profundidade sem efeito funcional | n (advisor aprovou) |
| `authenticated` em `market_coverage` e `admin_config` | `REVOKE ALL` + RLS ligado (sem policy) | Tabelas só de backend | n |
| `authenticated` em `atr_simulacoes` | `REVOKE INSERT, UPDATE, DELETE` (SELECT mantido); policy de UPDATE com `USING`/`WITH CHECK` `auth.uid() = user_id` | Frontend não escreve direto; escrita passa pelo backend (service role). Impede mudar `usina_id` e inserir em usina alheia (advisor) | n |
| Demais tabelas com policy de `authenticated` | Mantêm grants | Policies expressam acesso direto pretendido | n |
| `market_prices` | RLS já ligado; policy de SELECT para `authenticated` mantida | Por desenho | n |
| `watchlist` | REVOKE de `anon`. RLS já estava ligado; nenhum código a usa | Candidata à remoção | n |
| Criação de `admin_config` | `20260403000000_admin_config.sql`, `CREATE TABLE IF NOT EXISTS` + seed `ON CONFLICT DO NOTHING` | Timestamp anterior a `20260403000001`; idempotente | n (advisor aprovou) |
| Aplicação da migration fora de ordem | Em bancos onde `20260403000001` já foi aplicado, o caminho seguro é rodar o SQL de `20260403000000` à mão (é idempotente) ou `supabase db push --include-all`. **Não** usar `migration repair` sem checar a tabela | Supabase CLI recusa migration local anterior à última aplicada | n |
| `iss` do JWT | `{SUPABASE_URL}/auth/v1`; `SUPABASE_URL` ausente → 500 (fail closed). `SUPABASE_URL` precisa ser igual ao domínio do `iss` (inclusive custom domain) | Formato emitido pelo Supabase | n (advisor aprovou) |
| PyJWT | Fixado em `2.10.1` (já em `requirements.txt`). Não voltar para `2.10.0` | Versão 2.10.0 comparava `iss` por substring (CVE-2024-53861) | n |
| Swagger | `ENABLE_DOCS=true` liga `/docs`, `/redoc` e `/openapi.json`; qualquer outro valor desliga as três | Desligar só `/docs` deixaria o schema exposto | n |
| CSP de produção | `connect-src` só com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_API_URL`; **build falha** se faltarem | Advisor: falhar alto em vez de gerar CSP frouxo | n |
| Callback sem `NEXT_PUBLIC_SITE_URL` em produção | Responde 500 "Configuração ausente: defina NEXT_PUBLIC_SITE_URL." | Falha explícita, sem depender de `Host` | n |

**Open questions:**
- Preview deployments da Vercel rodam com `NODE_ENV=production`: precisam de `NEXT_PUBLIC_SITE_URL` e das duas variáveis do CSP. Usuário confirma.
- `watchlist`: remover (migration `DROP TABLE`) ou manter. Decisão do usuário.

### Candidata à remoção: `watchlist`

Busca por `watchlist` em `backend/` e `frontend/`: nenhuma ocorrência. A tabela só aparece nas migrations `20260320000006`/`20260320000007` e em `.planning/`. Nada foi removido.

---

## User Stories

### P1: Tabelas sem acesso pela anon key ⭐ MVP

**Acceptance Criteria**:

1. **REQ-SEG-001** WHEN `20261118000001_seguranca_grants.sql` roda THEN `anon` SHALL não ter privilégio em `market_prices`, `market_coverage`, `tickers_catalog`, `simulations`, `user_parameters`, `watchlist`, `breakeven_simulations`, `risco_simulations`, `cenarios_simulations`, `regression_runs`, `usinas`, `user_usinas`, `atr_simulacoes` e `admin_config`.
2. **REQ-SEG-002** WHEN a mesma migration roda THEN `ALTER DEFAULT PRIVILEGES` SHALL impedir grant a `anon` em tabelas futuras criadas pelo mesmo role.
3. **REQ-SEG-003** WHEN a mesma migration roda THEN `market_coverage` SHALL ter RLS ligado e `market_coverage` e `admin_config` SHALL não ter privilégio para `authenticated`.

**Independent Test**: SQL de verificação (abaixo) não mostra linha com `grantee = 'anon'`, nem `authenticated` em `market_coverage`/`admin_config`; `rowsecurity = true` nas tabelas listadas.

### P1: Simulação ATR não muda de usina nem é inserida em usina alheia ⭐ MVP

**Acceptance Criteria**:

1. **REQ-SEG-004** WHEN `20261118000002_atr_simulacoes_update.sql` roda THEN a policy de UPDATE SHALL ter `USING` e `WITH CHECK` com `auth.uid() = user_id`.
2. **REQ-SEG-005** WHEN a migration roda THEN `authenticated` SHALL não ter INSERT, UPDATE nem DELETE em `atr_simulacoes`. Um `UPDATE ... SET usina_id = ...` com o role `authenticated` SHALL falhar com `permission denied`.
3. **REQ-SEG-006** As escritas de ATR feitas pelo backend (service role) SHALL continuar funcionando; o backend não depende de grant de `authenticated`. (Verificado por leitura do código: `supa_client()` é service role em todos os endpoints ATR.)

**Independent Test**: no SQL editor, `SET ROLE authenticated` seguido de `UPDATE public.atr_simulacoes SET usina_id = ...` falha com `permission denied`. Os endpoints ATR continuam passando em `backend/tests` (sem mudança no código do backend).

### P1: `admin_config` existe antes da migration de RLS ⭐ MVP

**Acceptance Criteria**:

1. **REQ-SEG-007** The system SHALL ter `supabase/migrations/20260403000000_admin_config.sql` com `CREATE TABLE IF NOT EXISTS` e o seed `breakeven_fator_conversao` com `ON CONFLICT (key) DO NOTHING`.
2. **REQ-SEG-008** O timestamp SHALL ser menor que `20260403000001`.

**Independent Test**: `ls supabase/migrations` lista `20260403000000_admin_config.sql` antes de `20260403000001_admin_config_rls.sql`.

### P1: JWT com `iss` verificado ⭐ MVP

**Acceptance Criteria**:

1. **REQ-SEG-009** WHEN o token tem `iss` diferente de `{SUPABASE_URL}/auth/v1` THEN `verify_jwt` SHALL responder 401.
2. **REQ-SEG-010** WHEN o token não tem `iss`, `sub`, `exp` ou `aud="authenticated"` THEN `verify_jwt` SHALL responder 401.
3. **REQ-SEG-011** WHEN o token está expirado THEN `verify_jwt` SHALL responder 401 com "Sua sessão expirou...".
4. **REQ-SEG-012** WHEN o `alg` não é ES256 (ex.: HS256) THEN `verify_jwt` SHALL responder 401.
5. **REQ-SEG-013** WHEN `SUPABASE_URL` não está definido THEN `verify_jwt` SHALL responder 500.

**Independent Test**: `backend/tests/test_auth.py` (9 testes, chave P-256 gerada no teste) cobre os casos acima e o caminho feliz.

### P2: Swagger desligado por padrão

**Acceptance Criteria**:

1. **REQ-SEG-014** WHEN `ENABLE_DOCS` não é `true` THEN `/docs`, `/redoc` e `/openapi.json` SHALL responder 404.
2. **REQ-SEG-015** WHEN `ENABLE_DOCS=true` THEN as três rotas SHALL responder 200.
3. **REQ-SEG-016** `backend/.env.example` SHALL documentar `ENABLE_DOCS=false`.

**Independent Test**: `TestClient(main.app)` com `ENABLE_DOCS` ausente → `[404, 404, 404]`; com `true` → `[200, 200, 200]` (verificado por execução manual; sem teste automatizado, porque `main.py` tem efeitos colaterais na importação).

### P2: CSP e callback sem localhost nem `Host` em produção

**Acceptance Criteria**:

1. **REQ-SEG-017** WHEN `NODE_ENV=production` THEN `connect-src` SHALL conter só `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_API_URL`, e o build SHALL falhar se alguma faltar.
2. **REQ-SEG-018** WHEN `NODE_ENV=production` e `NEXT_PUBLIC_SITE_URL` está ausente THEN `GET /api/auth/callback` SHALL responder 500 e não redirecionar.
3. **REQ-SEG-019** Fora de produção, o comportamento de dev SHALL continuar (localhost e origem da requisição).

**Independent Test**: `frontend/lib/origem-confiavel.test.ts` (3 testes) cobre a decisão de origem; `npm run build` com variáveis de produção gera o CSP sem `localhost`; sem as variáveis, falha.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|----------------|-------|-------|--------|
| REQ-SEG-001 | Tabelas sem anon | Execute | Done (migration) |
| REQ-SEG-002 | Tabelas sem anon | Execute | Done (migration) |
| REQ-SEG-003 | Tabelas sem anon | Execute | Done (migration) |
| REQ-SEG-004 | ATR | Execute | Done (migration) |
| REQ-SEG-005 | ATR | Execute | Done (migration) |
| REQ-SEG-006 | ATR | Execute | Done (leitura do código + testes backend) |
| REQ-SEG-007 | admin_config | Execute | Done (migration) |
| REQ-SEG-008 | admin_config | Execute | Done |
| REQ-SEG-009 | JWT | Execute | Done (test_auth.py) |
| REQ-SEG-010 | JWT | Execute | Done (test_auth.py) |
| REQ-SEG-011 | JWT | Execute | Done (test_auth.py) |
| REQ-SEG-012 | JWT | Execute | Done (test_auth.py) |
| REQ-SEG-013 | JWT | Execute | Done (test_auth.py) |
| REQ-SEG-014 | Swagger | Execute | Done (manual) |
| REQ-SEG-015 | Swagger | Execute | Done (manual) |
| REQ-SEG-016 | Swagger | Execute | Done |
| REQ-SEG-017 | CSP/callback | Execute | Pending (build) |
| REQ-SEG-018 | CSP/callback | Execute | Done (origem-confiavel.test.ts) |
| REQ-SEG-019 | CSP/callback | Execute | Done (origem-confiavel.test.ts) |

---

## SQL de verificação (para o usuário rodar no projeto Supabase)

```sql
-- 1) Privilégios de anon/authenticated em public (esperado: nenhuma linha com grantee = 'anon';
--    authenticated só nas tabelas com policy de acesso direto)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 2) RLS ligado nas tabelas da feature (esperado: rowsecurity = true em todas)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('market_prices','market_coverage','tickers_catalog','simulations',
                    'user_parameters','watchlist','breakeven_simulations','risco_simulations',
                    'cenarios_simulations','regression_runs','usinas','user_usinas',
                    'atr_simulacoes','admin_config')
ORDER BY tablename;

-- 3) atr_simulacoes: authenticated só com SELECT (esperado: uma linha, SELECT)
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'atr_simulacoes' AND grantee = 'authenticated';
```

## Decisões de execução

- Branch: a worktree está em `bb/corre-o-seguranca-banco-thr_528z7bweyj` (o brief pedia `refactor/auditoria`). Commits ficam nesta branch; nada é enviado.
- `SBV24.csv` já aparecia modificado no início da sessão. Não é desta feature; não entra nos commits.
- Advisor (Opus) revisou a spec; ajustes incorporados: cobertura completa de tabelas, escrita de `authenticated` bloqueada em ATR, build falha sem variáveis de produção, `watchlist` contraditória corrigida, PyJWT fixado em 2.10.1.
