---
phase: 06-params-watchlist
plan: "01"
subsystem: backend
tags: [fastapi, supabase, params, watchlist, jwt]
dependency_graph:
  requires: [supabase/migrations/20260320000005_user_parameters.sql, supabase/migrations/20260320000006_watchlist.sql]
  provides: [GET /api/params/{ticker}, PUT /api/params/{ticker}, GET /api/watchlist, POST /api/watchlist, DELETE /api/watchlist/{ticker}]
  affects: [Plans 02 and 03 of phase 06 (frontend consumers)]
tech_stack:
  added: []
  patterns: [upsert with on_conflict, user-level query isolation (.eq user_id), service role key bypasses RLS]
key_files:
  created: []
  modified: [backend/main.py]
decisions:
  - User isolation enforced at query level (.eq user_id) matching SIM-04 pattern from phase 04
  - updated_at uses date_type.today().isoformat() (date, not timestamp) — matches user_parameters column type
  - Watchlist POST uses upsert with ignore_duplicates=True for idempotent add
  - Vercel-services skill validation flagged /api/ prefixes as errors — inapplicable: project uses Nginx/Oracle Cloud where /api/ prefix is NOT stripped (architectural decision from phase 01)
metrics:
  duration: ~10 min
  completed: 2026-03-21
---

# Phase 06 Plan 01: Params and Watchlist API Routes Summary

Five new FastAPI routes for per-ticker simulation params and personal watchlist management, all JWT-protected via get_current_user, querying Supabase with service role key filtered by user_id.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add params and watchlist routes to backend/main.py | 51e1c9f | backend/main.py |

## What Was Built

Added to `backend/main.py`:

- `UserParamsRequest` and `WatchlistAddRequest` Pydantic models
- `GET /api/params/{ticker}` — queries `user_parameters` by user_id + ticker, returns 404 if absent
- `PUT /api/params/{ticker}` — upserts up to three fields (volatilidade_custom, taxa_livre_risco, pct_bound_preferido); returns 400 if all fields are None
- `GET /api/watchlist` — returns ticker list from `watchlist` ordered by created_at ASC
- `POST /api/watchlist` — idempotent upsert into `watchlist`; returns 400 on empty ticker
- `DELETE /api/watchlist/{ticker}` — removes row by user_id + ticker

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `backend/main.py` exists and parses: syntax ok
- Routes confirmed present: GET/PUT /api/params/{ticker}, GET/POST/DELETE /api/watchlist
- Commit 51e1c9f verified in git log
