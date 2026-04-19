---
phase: 20-atr-acucar-total-recuperavel
plan: "03"
subsystem: frontend-atr
tags: [nextjs, atr, supabase, plotly, shadcn]
dependency_graph:
  requires: [20-01, 20-02]
  provides: [atr-frontend-page, atr-admin-panel]
  affects: [frontend/app/app/layout.tsx, frontend/app/app/admin/page.tsx]
tech_stack:
  added: []
  patterns: [dynamic-import-plotly, tabs-lazy-load, share-toggle]
key_files:
  created:
    - frontend/components/atr/AtrForm.tsx
    - frontend/components/atr/AtrMetrics.tsx
    - frontend/components/atr/AtrHistorico.tsx
    - frontend/app/app/atr/page.tsx
    - frontend/components/admin/AtrUsinasAdmin.tsx
  modified:
    - frontend/app/app/layout.tsx
    - frontend/app/app/admin/page.tsx
decisions:
  - "Used native <select> for usina selector (consistent with AcucarForm pattern) rather than shadcn Select"
  - "Plotly area chart uses tonexty fill between atr_min and atr_max traces for CI band"
  - "handleToggleShare fails silently — no visible error to avoid blocking UI; user can retry"
  - "Admin page wired AtrUsinasAdmin as server component import (existing admin/page.tsx pattern)"
metrics:
  duration: ~15min
  completed_date: "2026-04-09T01:26:52Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 2
status: COMPLETE
---

# Phase 20 Plan 03: ATR Frontend Summary

ATR page with usina select, simulation form, Plotly trend chart with CI band, share-toggle historico table, and admin CRUD for usinas — all wired to FastAPI backend.

## What Was Built

### Task 1: ATR Components (commit 7ed99da)

**`frontend/components/atr/AtrForm.tsx`**
- Exports: `Usina`, `AtrResult` interfaces + default `AtrForm` component
- Props: `usinas: Usina[]`, `onResult: (r: AtrResult) => void`, `onUsinaChange?: (id: string) => void`
- Native `<select>` for usina, inputs for Chuva (mm), Impureza (%), Volume (optional)
- POSTs to `/api/atr/simulate` with auth token; calls `onResult` on success

**`frontend/components/atr/AtrMetrics.tsx`**
- Exports: `AtrMetrics` component
- 3-column card grid (ATR Mínimo / ATR Esperado [highlighted blue] / ATR Máximo)
- Conditional 4th card for Produção Total when not null

**`frontend/components/atr/AtrHistorico.tsx`**
- Exports: `HistoricoItem` interface + `AtrHistorico` component
- Plotly dynamic import (ssr: false) — line chart with shaded CI band (atr_min to atr_max)
- shadcn Table with share badge + toggle button (only for items owned by currentUserId)

### Task 2: Page, Admin, Nav (commit 7ed99da)

**`frontend/app/app/atr/page.tsx`**
- Tabs: Simular / Histórico
- Lazy historico load: fetched only when tab first activated, invalidated after new simulation
- PATCH `/api/atr/simulacoes/{id}/compartilhar` for toggle; updates local state immutably
- Tracks `selectedUsinaId` to pass correct `usina_id` query param to historico endpoint

**`frontend/components/admin/AtrUsinasAdmin.tsx`**
- Lists usinas with delete; form to create new usina; form to associate user by UUID paste
- All operations via `/api/admin/usinas` routes with auth token

**`frontend/app/app/layout.tsx`**
- Added `{ href: "/app/atr", label: "ATR" }` to Análise section after Regressão Açúcar

**`frontend/app/app/admin/page.tsx`**
- Imported and rendered `<AtrUsinasAdmin />` below AdminConfig

## Deviations from Plan

None — plan executed exactly as written.

## Task 3: Human Verification

**Status:** APPROVED by user on 2026-04-08.

Verification confirmed:
1. ATR link appears in sidebar under "Análise"
2. Form shows usina select + Chuva + Impureza + Volume inputs
3. GET /api/atr/usinas returns correct usina list with valid token
4. Admin panel shows "Usinas ATR" section
5. Simulation returns ATR min/esperado/max and Histórico tab loads correctly

## Self-Check

- [x] `frontend/components/atr/AtrForm.tsx` exists
- [x] `frontend/components/atr/AtrMetrics.tsx` exists
- [x] `frontend/components/atr/AtrHistorico.tsx` exists
- [x] `frontend/app/app/atr/page.tsx` exists
- [x] `frontend/components/admin/AtrUsinasAdmin.tsx` exists
- [x] commit 7ed99da exists
- [x] TypeScript: `npx tsc --noEmit` exits clean (no output)
- [x] `grep "atr" layout.tsx` returns line 35 with ATR link
- [x] `grep "compartilhar" page.tsx` returns PATCH fetch line

## Self-Check: PASSED
