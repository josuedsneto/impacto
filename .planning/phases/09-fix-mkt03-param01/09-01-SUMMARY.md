---
phase: 09-fix-mkt03-param01
plan: "01"
subsystem: market
tags: [bug-fix, mkt-03, supabase, fastapi, react]
dependency_graph:
  requires: []
  provides: [MKT-03-suggest-ticker]
  affects: [tickers_catalog]
tech_stack:
  added: []
  patterns: [Literal-enum-for-db-constraint]
key_files:
  modified:
    - backend/main.py
    - frontend/components/market/TickerSuggestForm.tsx
decisions:
  - "Used Literal['commodity','fx','acao','indice'] for tipo field to enforce DB CHECK constraint at API layer"
  - "Did not modify pre-existing /api/ route prefixes — out of scope and architectural"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 09 Plan 01: Fix MKT-03 Ticker Suggest Runtime Bugs Summary

Fixed two runtime bugs causing every POST /api/market/suggest to fail: wrong insert column name (suggested_by vs adicionado_por) and invalid tipo default value (equity not in DB CHECK constraint), plus aligned frontend dropdown to match DB-valid values.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix TickerSuggestRequest model and insert payload | 11df028 | backend/main.py |
| 2 | Align frontend TickerSuggestForm dropdown | 7cc729e | frontend/components/market/TickerSuggestForm.tsx |

## Changes Made

### Task 1 — backend/main.py

- Added `Literal` to `from typing import Annotated, Literal`
- Changed `tipo: str = "equity"` to `tipo: Literal["commodity", "fx", "acao", "indice"] = "commodity"`
- Changed insert payload key `"suggested_by"` to `"adicionado_por"` to match DB column name

### Task 2 — frontend/components/market/TickerSuggestForm.tsx

- Changed `useState("equity")` to `useState("commodity")`
- Replaced 5 SelectItem options (equity, futures, fx, etf, crypto) with 4 DB-valid options:
  - commodity → "Commodity / Futuro"
  - fx → "Câmbio (FX)"
  - acao → "Ação"
  - indice → "Índice"

## Deviations from Plan

None — plan executed exactly as written.

Note: The post-edit validator reported 19 pre-existing errors about `/api/` route prefixes. These are out of scope for this plan (pre-existing, architectural decision, not caused by this task's changes). Logged to deferred items.

## Self-Check: PASSED

- `backend/main.py` modified: FOUND
- `frontend/components/market/TickerSuggestForm.tsx` modified: FOUND
- Commit 11df028: FOUND
- Commit 7cc729e: FOUND
- `python -c "from main import TickerSuggestRequest; r = TickerSuggestRequest(ticker='TEST'); assert r.tipo == 'commodity'"`: PASSED
- No `suggested_by` in file: CONFIRMED
- Frontend node validation (valid values present, invalid absent): OK
