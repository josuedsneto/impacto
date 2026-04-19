---
phase: 12-feature-pages
plan: "01"
subsystem: backend
tags: [fastapi, endpoints, statsmodels, feedparser, var, arima, stress, news, volatility, breakeven, admin-config]
dependency_graph:
  requires: []
  provides: [api/admin/config, api/var, api/breakeven, api/arima, api/stress, api/news, api/volatility]
  affects: [backend/main.py, backend/requirements.txt]
tech_stack:
  added: [statsmodels==0.14.4, feedparser==6.0.11]
  patterns: [yfinance data fetch, scipy stats, in-memory cache, ARIMA forecast, admin_config table]
key_files:
  created: [.planning/phases/12-feature-pages/migrations/admin_config.sql]
  modified: [backend/main.py, backend/requirements.txt]
decisions:
  - "feedparser used for Google News RSS — stdlib alternative would require XML parsing without feed autodiscovery"
  - "statsmodels ARIMA(1,1,1) — simple fixed order avoids auto_arima overhead; wrapped in try/except for short series"
  - "Breakeven factor stored in admin_config table — allows runtime updates without code changes"
  - "News endpoint uses module-level dict cache (_news_cache) — avoids Redis dependency for low-frequency refresh"
  - "/api/focus endpoint already existed in main.py — not duplicated"
metrics:
  duration: 2 min
  completed: "2026-04-01"
  tasks_completed: 10
  files_modified: 3
---

# Phase 12 Plan 01: Feature Pages Backend Endpoints Summary

7 new FastAPI endpoints + admin config API + Python dependencies added to power the 8 new feature pages (Focus was already present).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add statsmodels + feedparser to requirements.txt | cca9712 | backend/requirements.txt |
| 2 | Create admin_config.sql migration | 3319757 | .planning/phases/12-feature-pages/migrations/admin_config.sql |
| 3 | Add admin config endpoints (GET+PUT /api/admin/config) | 99626a0 | backend/main.py |
| 4 | Focus endpoint already present — no action needed | — | — |
| 5 | Add VaR endpoint (GET /api/var) | 99626a0 | backend/main.py |
| 6 | Add Breakeven endpoint (GET /api/breakeven) | 99626a0 | backend/main.py |
| 7 | Add ARIMA endpoint (GET /api/arima/{ticker}) | 99626a0 | backend/main.py |
| 8 | Add Stress Test endpoint (GET /api/stress) | 99626a0 | backend/main.py |
| 9 | Add News endpoint (GET /api/news) | 99626a0 | backend/main.py |
| 10 | Add Volatility endpoint (GET /api/volatility) | 99626a0 | backend/main.py |

## Endpoints Added

| Endpoint | Auth | Description |
|----------|------|-------------|
| GET /api/admin/config | require_admin | List all admin_config rows |
| PUT /api/admin/config/{key} | require_admin | Upsert config key/value |
| GET /api/var | get_current_user | Historical + Parametric VaR via yfinance |
| GET /api/breakeven | get_current_user | Sugar breakeven in BRL/saca |
| GET /api/arima/{ticker} | get_current_user | ARIMA(1,1,1) forecast with confidence intervals |
| GET /api/stress | get_current_user | Historical stress scenarios |
| GET /api/news | get_current_user | Google News RSS top 10 items (30min cache) |
| GET /api/volatility | get_current_user | Realized vol 30d/90d/1y with rolling history |

## Deviations from Plan

### Auto-noted observations

**1. /api/focus already existed**
- Found during: Task 4 pre-check
- The focus endpoint was already implemented in main.py from a previous session
- Action: Skipped re-implementation, documented as already present
- No extra commit needed

None of the other endpoints existed — plan executed exactly as written for Tasks 1-3 and 5-10.
