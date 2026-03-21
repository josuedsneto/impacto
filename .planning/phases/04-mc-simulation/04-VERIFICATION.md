---
phase: 04-mc-simulation
verified: 2026-03-21T00:00:00Z
status: passed
score: 7/7 must-haves verified
gaps: []
human_verification:
  - test: "Run Simular flow end-to-end"
    expected: "Fan chart and metrics appear below the form within 15s after clicking Simular"
    why_human: "Requires a live backend + Supabase instance to validate timing and rendering"
  - test: "Histórico tab shows simulation immediately after completion"
    expected: "After Simular completes, switching to Histórico tab shows the new simulation without a page reload"
    why_human: "State update after onResult is a runtime behaviour, not statically verifiable"
  - test: "Cross-user isolation"
    expected: "Logging in as User B and navigating to /app/simulation Histórico does not show User A's simulations"
    why_human: "RLS + JWT scoping requires two live sessions to validate"
---

# Phase 4: MC Simulation Verification Report

**Phase Goal:** Users can run a Monte Carlo simulation through the API, see the fan chart and metrics, and find past simulations in a history tab; simulations from other users are never visible.
**Verified:** 2026-03-21
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/simulations runs MC and returns fan chart percentiles + scalar metrics | VERIFIED | `backend/main.py:160` defines route; calls `run_simulation()` from `simulation.py` |
| 2 | Simulation is persisted with user_id from JWT | VERIFIED | `main.py:180` — `"user_id": user["id"]` in insert payload |
| 3 | GET /api/simulations returns only rows for the authenticated user | VERIFIED | `main.py:214` — `.eq("user_id", user["id"])` filter |
| 4 | GET /api/simulations/{id} returns 404 for another user's simulation | VERIFIED | `main.py:235` — `.eq("user_id", user["id"])` + 404 raise if no data |
| 5 | SimulationForm / FanChart / SimulationMetrics are substantive components wired to the page | VERIFIED | All three imported and rendered in `frontend/app/app/simulation/page.tsx:6-10,116-121` |
| 6 | New simulation is prepended to history state immediately (SIM-02) | VERIFIED | `page.tsx:61` — `setHistory((prev) => [toSummary(result), ...prev])` |
| 7 | Clicking a Histórico item replays fan chart from saved percentiles_series (SIM-03) | VERIFIED | `page.tsx:92` — fetch GET /api/simulations/{id} on click, result set as activeResult |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/simulation.py` | MC engine with `run_simulation()` returning `percentiles_series` | VERIFIED | 85 lines, `run_simulation` defined at line 18, `percentiles_series` at line 84 |
| `backend/main.py` | POST /api/simulations, GET /api/simulations, GET /api/simulations/{id} | VERIFIED | Routes at lines 160, 202, 221; `from simulation import run_simulation` at line 11 |
| `frontend/components/simulation/SimulationForm.tsx` | Controlled form calling POST /api/simulations with Bearer token | VERIFIED | 171 lines; fetch at line 58; `Authorization: Bearer` at line 62; `onResult` callback at line 79 |
| `frontend/components/simulation/FanChart.tsx` | Recharts AreaChart with p5–p95 bands | VERIFIED | 84 lines; imports recharts; renders AreaChart bands |
| `frontend/components/simulation/SimulationMetrics.tsx` | Summary card with p5, p50, p95 | VERIFIED | 38 lines (meets min_lines=30) |
| `frontend/app/app/simulation/page.tsx` | Two-tab page: Simular + Histórico | VERIFIED | Contains "Histórico" tab, imports all three components, fetches GET /api/simulations |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/main.py` | `backend/simulation.py run_simulation()` | `from simulation import run_simulation` | WIRED | `main.py:11` |
| `POST /api/simulations` | simulations table | supabase insert with user_id | WIRED | `main.py:177-200` |
| `SimulationForm` | `POST /api/simulations` | fetch with Bearer token | WIRED | `SimulationForm.tsx:58,62` |
| `page.tsx` | `SimulationForm` | import + onResult prop | WIRED | `page.tsx:6,116` |
| `page.tsx` | `FanChart` | import + activeResult.percentiles_series | WIRED | `page.tsx:9,121` |
| `Histórico tab` | `GET /api/simulations` | fetch with Bearer token on activation | WIRED | `page.tsx:71` |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SIM-01 | 04-01, 04-02, 04-03 | Usuário executa simulação MC e vê fan chart + métricas em menos de 15s | SATISFIED* | Engine exists, route wired, form + chart + metrics rendered; 15s timing needs human |
| SIM-02 | 04-02, 04-03 | Simulação salva aparece na aba Histórico sem recarregar a página | SATISFIED | `setHistory((prev) => [toSummary(result), ...prev])` at `page.tsx:61` |
| SIM-03 | 04-02, 04-03 | Fan chart pode ser replayed via percentis JSONB salvos | SATISFIED | GET /api/simulations/{id} returns full percentiles_series; page replays on click |
| SIM-04 | 04-01, 04-03 | Usuário A não consegue ver simulações do usuário B (RLS) | SATISFIED* | `.eq("user_id", user["id"])` enforced in both list and get routes; cross-user test needs human |

*Timing constraint (< 15s) and cross-user RLS enforcement require human/runtime verification.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

No TODO/FIXME/placeholder/stub patterns detected across any of the five new files.

### Human Verification Required

#### 1. Simulation runs within 15s (SIM-01 timing constraint)

**Test:** With backend running and Supabase connected, enter ticker=SB=F, accept defaults, click Simular.
**Expected:** Fan chart and metrics appear within 15 seconds.
**Why human:** Cold-cache latency (yfinance fetch + 10,000-path MC) cannot be timed statically.

#### 2. Histórico tab updates without reload (SIM-02)

**Test:** Run a simulation, then click the Histórico tab before reloading the page.
**Expected:** The completed simulation appears at the top of the list immediately.
**Why human:** React state update from `handleNewResult` requires a running browser.

#### 3. Cross-user isolation (SIM-04)

**Test:** Log in as User A, run a simulation. Log out. Log in as User B. Open Histórico tab.
**Expected:** User B sees zero simulations; User A's simulations are not visible.
**Why human:** Requires two live Supabase sessions.

### Gaps Summary

No gaps. All automated checks passed. All five files are substantive and wired. Requirements SIM-01 through SIM-04 are all covered by real implementation. Three human verification items remain for runtime and multi-user concerns, but no code gaps block goal achievement.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
