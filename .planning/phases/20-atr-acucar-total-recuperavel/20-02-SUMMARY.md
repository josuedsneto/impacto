---
phase: 20-atr-acucar-total-recuperavel
plan: 02
subsystem: backend
tags: [atr, fastapi, calibration, ols, supabase]
dependency_graph:
  requires: ["20-01"]
  provides: ["backend/atr.py", "/api/atr/*", "/api/admin/usinas"]
  affects: ["backend/main.py"]
tech_stack:
  added: ["statsmodels OLS for ATR calibration"]
  patterns: ["run_in_executor for CPU-bound OLS", "service_role + business-rule filter for historico"]
key_files:
  created: ["backend/atr.py"]
  modified: ["backend/main.py"]
decisions:
  - "Sector defaults (intercept=135, coef_chuva=0.15, coef_impureza=-1.8, sigma=5) used when history < 5 points"
  - "OLS fallback to sector defaults on any fit failure (collinear/insufficient data)"
  - "asyncio.get_running_loop() used in atr_simulate (not get_event_loop) — correct pattern for FastAPI async context"
  - "historico filters visible rows in Python after service_role fetch — business rule not expressible in simple RLS"
  - "calibrate_atr uses atr_simulacoes.atr_esperado as atr_real proxy — no separate historical upload flow"
metrics:
  duration_seconds: 238
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_modified: 2
---

# Phase 20 Plan 02: ATR Backend Module and FastAPI Routes Summary

OLS-based ATR calibration module with sector defaults fallback plus 5 FastAPI routes for usina listing, simulate-and-persist, history with sharing, and admin usina management.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Módulo atr.py — calibração e predição ATR | cc2c101 | backend/atr.py |
| 2 | Rotas FastAPI ATR em main.py | 222350e | backend/main.py |

## What Was Built

### backend/atr.py

Three exported functions:
- `get_sector_defaults()` — Consecana/Unica empirical ATR coefficients (intercept=135, coef_chuva=0.15, coef_impureza=-1.8, sigma=5.0)
- `calibrate_atr(history)` — OLS fit when >= 5 data points; returns sector defaults otherwise; fallback on OLS failure
- `predict_atr(chuva_mm, impureza_pct, params, volume_moagem=None)` — 90% CI (z=1.645), optional producao_total in tonnes

Verified: `predict_atr(100, 5.0, get_sector_defaults())` returns `atr_esperado=141.0` (135 + 15 - 9).

### backend/main.py additions

**Pydantic models:** `AtrSimulateBody`, `AtrUsinaCreateBody`, `AtrShareBody`

**ATR routes (5 total):**
- `GET /api/atr/usinas` — user's associated usinas via user_usinas join
- `POST /api/atr/simulate` — verifies association, calibrates from history, predicts, auto-saves to atr_simulacoes
- `GET /api/atr/historico` — own + shared simulations from the same usina
- `PATCH /api/atr/simulacoes/{sim_id}/compartilhar` — toggle sharing (owner only)

**Admin usinas routes (5 total):**
- `GET /api/admin/usinas` — list all usinas
- `POST /api/admin/usinas` — create usina (409 on duplicate)
- `DELETE /api/admin/usinas/{usina_id}` — delete usina
- `POST /api/admin/usinas/{usina_id}/usuarios/{user_id_target}` — associate user
- `DELETE /api/admin/usinas/{usina_id}/usuarios/{user_id_target}` — remove association

## Decisions Made

1. `asyncio.get_running_loop()` used in `atr_simulate` instead of `get_event_loop()` — correct for FastAPI async routes (FastAPI runs inside a running loop)
2. `historico` route fetches all usina rows via service_role then filters in Python — the business rule (own OR compartilhado AND same usina) requires two conditions that can't be expressed as a single RLS-friendly query
3. OLS calibration uses `atr_simulacoes.atr_esperado` as `atr_real` proxy — bootstrapping approach before real historical ATR data is available
4. `Optional` added to `typing` import; `asyncio` kept as inline import per existing main.py pattern

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

```
# Task 1 verify
ATR: 141.0
Full result: {'atr_min': 132.775, 'atr_esperado': 141.0, 'atr_max': 149.225, 'producao_total': None}

# Task 2 verify
['/api/atr/usinas', '/api/atr/simulate', '/api/atr/historico',
 '/api/atr/simulacoes/{sim_id}/compartilhar', '/api/admin/usinas',
 '/api/admin/usinas', '/api/admin/usinas/{usina_id}',
 '/api/admin/usinas/{usina_id}/usuarios/{user_id_target}',
 '/api/admin/usinas/{usina_id}/usuarios/{user_id_target}']
```

## Self-Check: PASSED
