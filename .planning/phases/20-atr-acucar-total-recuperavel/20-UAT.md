---
status: complete
phase: 20-atr-acucar-total-recuperavel
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md]
started: 2026-04-09T11:30:00Z
updated: 2026-04-09T11:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. ATR nav link visible in sidebar
expected: On any page of the app, the left sidebar's "Análise" section contains an "ATR" link. Clicking it navigates to /app/atr.
result: pass

### 2. Usina dropdown populates
expected: On the ATR page (/app/atr), the usina selector (dropdown) shows the list of usinas your user is associated with — not blank, not an error. This confirms the INT-01 fix (response unwrapping) is working.
result: pass

### 3. Simulation runs and shows ATR results
expected: Select a usina, enter Chuva (e.g. 100 mm) and Impureza (e.g. 5%), click Simular. The Métricas section shows three values: ATR Mínimo, ATR Esperado (highlighted), ATR Máximo. If Volume de Moagem was entered, a 4th card shows Produção Total.
result: pass

### 4. Histórico tab loads chart and table
expected: After running at least one simulation, switch to the "Histórico" tab. A line chart appears showing ATR Esperado over time with a shaded band (min/max). Below it, a table lists past simulations with date, chuva, impureza, ATR values, and a "Compartilhado" badge if shared. This confirms INT-02 fix.
result: pass

### 5. Share toggle on own simulations
expected: In the Histórico table, simulations you created have a button to toggle sharing (e.g. "Compartilhar" / "Deixar de Compartilhar"). Clicking it updates the badge immediately — shared simulations from the same usina are visible to other usina members.
result: pass

### 6. Admin panel shows Usinas ATR section
expected: Navigating to /app/admin (admin users only) shows a "Usinas ATR" section below the existing admin config. It lists current usinas with a delete button for each, and a form to create a new usina by name.
result: pass

### 7. Admin create usina
expected: In the Usinas ATR section, enter a usina name and submit. The new usina appears in the list. Submitting a duplicate name shows a "já existe" or similar error (409 from backend).
result: pass

### 8. Admin associate user to usina
expected: In the Usinas ATR section, enter a user UUID and click to associate them with a usina. The operation completes without a 404 error. This confirms INT-03 fix (endpoint path /usuarios/{user_id} instead of /users).
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
