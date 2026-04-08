---
phase: 20-atr-acucar-total-recuperavel
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, migration, sql]

# Dependency graph
requires: []
provides:
  - Tabela usinas (UUID PK, nome UNIQUE) gerenciada por admin via service_role
  - Tabela user_usinas (associação admin-managed entre users e usinas)
  - Tabela atr_simulacoes com campos chuva_mm, impureza_pct, atr_min/esperado/max, producao_total, compartilhado
  - Indexes em user_id e usina_id para queries eficientes
  - RLS completo: usinas (read-only para autenticados), user_usinas (ver próprias), atr_simulacoes (próprias + compartilhadas da mesma usina)
affects: [20-02, 20-03, atr-page, atr-api]

# Tech tracking
tech-stack:
  added: []
  patterns: [Supabase migration SQL, RLS com subquery para shared rows, admin-managed tables via service_role bypass]

key-files:
  created:
    - supabase/migrations/20260408000001_atr_usinas.sql
  modified: []

key-decisions:
  - "usinas e user_usinas não têm política de INSERT/UPDATE/DELETE — service_role bypassa RLS automaticamente; admin nunca cria policies de escrita em tabelas admin-managed"
  - "atr_simulacoes SELECT policy usa subquery em user_usinas para isolar compartilhamento por usina — usuário vê apenas shared rows da mesma usina, não de todas"

patterns-established:
  - "Admin-managed tables: enable RLS + read-only policy para autenticados; service_role bypassa sem policy explícita"
  - "Shared rows pattern: SELECT USING com OR (own rows OR (compartilhado = true AND FK IN (SELECT from join table)))"

requirements-completed: [ATR-01]

# Metrics
duration: 1min
completed: 2026-04-08
---

# Phase 20 Plan 01: ATR — Migration Supabase (usinas + atr_simulacoes) Summary

**Migration SQL com 3 tabelas (usinas, user_usinas, atr_simulacoes), índices e RLS completo para persistência de simulações ATR isolada por usuário e usina**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-04-08T20:46:52Z
- **Completed:** 2026-04-08T20:47:45Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Tabela `usinas` com `nome UNIQUE` para integridade de dados, sem user_id (lista gerenciada por admin)
- Tabela `user_usinas` com chave composta (user_id, usina_id) e FKs com ON DELETE CASCADE
- Tabela `atr_simulacoes` com todos os campos numéricos precisos (NUMERIC) e flag `compartilhado`
- 3 índices para performance em queries de usuário e usina
- RLS habilitado nas 3 tabelas com políticas corretas por tipo de acesso

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration SQL — tabelas usinas e atr_simulacoes** - `b26e624` (feat)

**Plan metadata:** _(docs commit pending)_

## Files Created/Modified
- `supabase/migrations/20260408000001_atr_usinas.sql` — DDL completo para as 3 tabelas com índices e RLS

## Decisions Made
- service_role bypassa RLS automaticamente no Supabase — não é necessário criar policies de INSERT/UPDATE/DELETE em tabelas admin-managed; apenas a policy de SELECT é necessária para leitura por autenticados
- SELECT policy em atr_simulacoes usa subquery `IN (SELECT usina_id FROM user_usinas WHERE user_id = auth.uid())` para garantir que shared rows são visíveis apenas para membros da mesma usina

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required beyond running `supabase db push` to apply the migration.

## Next Phase Readiness
- Migration pronta para `supabase db push`
- Schema suporta fluxo completo: admin cria usinas via service_role, associa usuários em user_usinas, usuários salvam simulações privadas ou compartilham com a usina
- Próximo: implementar endpoints FastAPI e página Streamlit ATR

---
*Phase: 20-atr-acucar-total-recuperavel*
*Completed: 2026-04-08*
