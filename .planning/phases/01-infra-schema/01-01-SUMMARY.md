---
phase: 01-infra-schema
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, migrations, schema]

requires: []
provides:
  - 6-table Supabase schema for v2.0 platform (market_prices, market_coverage, tickers_catalog, simulations, user_parameters, watchlist)
  - RLS policies for all user-owned tables using auth.uid()
  - Idempotent migration files applicable via supabase db push
affects:
  - 01-02 (app scaffold — imports schema via supabase client)
  - 01-03 (nginx/vm bootstrap — depends on Supabase project being set up)
  - All phases that read/write user data

tech-stack:
  added: [supabase-migrations]
  patterns:
    - "Idempotent DDL: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS"
    - "RLS on user-owned tables only; market_coverage bypasses RLS via service role"
    - "auth.uid() as the sole identity anchor for all user-row policies"

key-files:
  created:
    - supabase/migrations/20260320000001_market_prices.sql
    - supabase/migrations/20260320000002_market_coverage.sql
    - supabase/migrations/20260320000003_tickers_catalog.sql
    - supabase/migrations/20260320000004_simulations.sql
    - supabase/migrations/20260320000005_user_parameters.sql
    - supabase/migrations/20260320000006_watchlist.sql
    - supabase/migrations/20260320000007_rls_policies.sql
  modified: []

key-decisions:
  - "market_coverage has no RLS — accessed exclusively by FastAPI via service role key, never by frontend"
  - "tickers_catalog write access enforced in FastAPI (admin-only), not via RLS, to keep policies simple"
  - "simulations stores full percentiles_series as JSONB alongside scalar p5/p20/p25/p50/p75/p80/p95 columns"
  - "All user-owned tables use ON DELETE CASCADE from auth.users"

patterns-established:
  - "Migration naming: YYYYMMDDHHMMSS_table_name.sql (one table per file, policies in final file)"
  - "UNIQUE constraint naming: {table}_{col1}_{col2}_key"
  - "Index naming: idx_{table}_{col1}_{col2}"

requirements-completed: [INFRA-01]

duration: 10min
completed: 2026-03-20
---

# Phase 1 Plan 01: Supabase Schema Migrations Summary

**7 idempotent SQL migration files defining the full v2.0 Supabase schema: 6 tables with UNIQUE constraints, CHECK constraints, CASCADE deletes, and RLS policies using auth.uid() for all user-owned tables**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T00:00:00Z
- **Completed:** 2026-03-20T00:10:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Created 3 shared/public tables: market_prices (UNIQUE ticker+date), market_coverage (service-role only), tickers_catalog (CHECK constraints on tipo/status/backfill_status)
- Created 3 user-scoped tables: simulations (JSONB percentiles_series), user_parameters (UNIQUE user+ticker, numeric range checks), watchlist (composite PK)
- Applied RLS on 5 tables with SELECT/INSERT/UPDATE/DELETE policies scoped to auth.uid()

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared-table migrations** - `ac37cb8` (feat)
2. **Task 2: User-scoped migrations and RLS policies** - `a7a82ea` (feat)

## Files Created/Modified

- `supabase/migrations/20260320000001_market_prices.sql` - OHLCV table with UNIQUE(ticker, date) and index
- `supabase/migrations/20260320000002_market_coverage.sql` - Internal coverage tracker, no RLS
- `supabase/migrations/20260320000003_tickers_catalog.sql` - Asset catalog with CHECK constraints and UNIQUE(ticker)
- `supabase/migrations/20260320000004_simulations.sql` - Simulation results with JSONB percentiles and user FK
- `supabase/migrations/20260320000005_user_parameters.sql` - Per-user per-ticker preferences with numeric range checks
- `supabase/migrations/20260320000006_watchlist.sql` - Simple composite-PK watchlist
- `supabase/migrations/20260320000007_rls_policies.sql` - RLS enable + policies for 5 tables

## Decisions Made

- market_coverage has no RLS because FastAPI uses the service role key and this table should never be exposed to frontend queries.
- tickers_catalog write access is enforced in FastAPI (not RLS) to keep policies simple — a single authenticated-read policy is sufficient.
- JSONB percentiles_series stored alongside scalar percentile columns to allow both fast filtering (p50 IS NOT NULL) and full fan-chart reconstruction.
- ON DELETE CASCADE on all user_id foreign keys ensures clean row removal when auth.users is deleted.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for file creation. Apply migrations with `supabase db push` once a Supabase project is linked.

## Next Phase Readiness

- All 7 migration files ready for `supabase db push` on any linked Supabase project
- Schema provides the data layer foundation for Phase 1 Plan 02 (app scaffold) and Plan 03 (nginx + VM bootstrap)
- No blockers

---
*Phase: 01-infra-schema*
*Completed: 2026-03-20*
