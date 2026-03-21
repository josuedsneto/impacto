---
phase: 03-market-cache
plan: "02"
subsystem: backend-api
tags: [fastapi, market-data, routes, yfinance, supabase]
dependency_graph:
  requires: [03-01]
  provides: [market-http-api]
  affects: [frontend-market-page]
tech_stack:
  added: []
  patterns: [cache-aside-via-http, yfinance-validate-before-write, admin-only-route]
key_files:
  created: []
  modified:
    - backend/main.py
decisions:
  - "Route prefixes kept as /api/* per existing Nginx-no-strip architectural decision (not Vercel)"
  - "HTTPException imported at top level (not per-route) for cleaner code"
metrics:
  duration: "~5 min"
  completed: "2026-03-21"
  tasks: 1
  files: 1
requirements: [MKT-01, MKT-02, MKT-03, MKT-04]
---

# Phase 3 Plan 02: Market FastAPI Routes Summary

**One-liner:** Three market HTTP routes wired into FastAPI: price query via cache-aside, ticker suggestion with yfinance pre-validation, and admin backfill trigger.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add market routes to backend/main.py | 3731199 | backend/main.py |

## What Was Built

Three new routes added to `backend/main.py`:

- **GET /api/market/prices** — accepts `ticker`, `start`, `end` query params; delegates to `get_prices()` from `market_cache.py`; returns OHLCV JSON. Validates `end >= start`.
- **POST /api/market/suggest** — validates ticker via `yf.download()` (5d probe) before any DB write; returns 400 with descriptive error on invalid/unknown ticker; on success inserts into `tickers_catalog` with `status=pending`.
- **POST /api/admin/market/backfill/{ticker}** — admin-only (requires `require_admin` dependency); calls `backfill_ticker()` and updates `backfill_status=done` in `tickers_catalog`.

New imports added: `yfinance`, `supabase.create_client`, `market_cache.get_prices/backfill_ticker`, `pydantic.BaseModel`, `datetime.date`, `fastapi.HTTPException`.

## Deviations from Plan

None — plan executed exactly as written. `HTTPException` was moved to top-level import (instead of per-route local import) as a minor cleanup, with no behavior change.

## Self-Check

- [x] `backend/main.py` exists and modified
- [x] Commit `3731199` exists
- [x] `python -c "import ast; ast.parse(...)"` returns "syntax ok"
- [x] grep confirms all three route definitions present

## Self-Check: PASSED
