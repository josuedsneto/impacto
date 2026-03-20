# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Correct, trustworthy simulation outputs accessible to 20-100 internal users simultaneously, with persisted data and robust authentication.
**Current focus:** Phase 1 — Infra & Schema (v2.0 Plataforma Escalável)

## Current Position

Milestone: v2.0 Plataforma Escalavel
Phase: 1 of 8 (Infra & Schema) — COMPLETE
Plan: 3 of 3 — COMPLETE
Status: Phase 1 complete — ready for Phase 2 (Auth)
Last activity: 2026-03-20 — Completed 01-03 (Nginx + VM bootstrap + Supabase migrations validated)

Progress: [███░░░░░░░] 11%

## Performance Metrics

**Velocity:**
- Total plans completed: 0 (v2.0)
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-infra-schema | 3 | ~60 min | ~20 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~10 min)
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Carried forward from v1.0:

- Audit-first then fix approach confirmed in v1.0
- Risk-neutral drift for options MC (financially correct for derivatives)
- PCT_BOUND=0.50: bounds are 50% of last close to avoid truncating GBM cone
- FastAPI validates JWT locally (PyJWT + RS256 public key) — no round-trip to Supabase
- Cache-aside incremental in PostgreSQL — reduces yfinance calls, history persisted
- Oracle Cloud Always Free for deploy — zero cost, 4 vCPUs / 24GB sufficient for 100 users
- Next.js App Router + shadcn/ui new-york — modern React ecosystem
- Supabase Auth with JWT RS256 — managed auth, RLS on all user-owned tables
- market_coverage has no RLS — accessed exclusively by FastAPI via service role key
- tickers_catalog write enforced in FastAPI (not RLS) to keep policies simple
- simulations stores JSONB percentiles_series alongside scalar p5/p50/p95 for flexible querying
- All user-owned table FKs use ON DELETE CASCADE from auth.users
- FastAPI routes use full /api/health prefix — Nginx proxies without stripping prefix (proxy_pass no rewrite)
- shadcn style locked to new-york/zinc per design spec
- Nginx does NOT strip /api prefix — proxy_pass http://localhost:8000 with no rewrite (FastAPI routes include /api/)
- setup-vm.sh accepts domain as $1; SSL setup skipped with warning if omitted
- PM2 ecosystem.config.js uses interpreter=none for uvicorn (it is the executable, not a Python script)
- VM and Supabase provisioning deferred to infrastructure availability; all local artifacts validated

### Pending Todos

- Provision Oracle Cloud VM and run scripts/setup-vm.sh
- Link Supabase CLI and run supabase db push
- Begin Phase 2 (Auth)

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-20
Stopped at: Completed 01-03-PLAN.md (Nginx + VM bootstrap, Supabase migrations validated) — Phase 1 complete
Resume file: None
