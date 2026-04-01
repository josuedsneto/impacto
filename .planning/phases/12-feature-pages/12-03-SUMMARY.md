---
phase: 12-feature-pages
plan: "03"
subsystem: frontend-pages
tags: [frontend, next-js, shadcn, recharts, stress-test, news, volatility, admin]
dependency_graph:
  requires: [12-02]
  provides: [stress-page, noticias-page, volatilidade-page, admin-config, tool-grid-complete]
  affects: [frontend/app/app/admin, frontend/components/dashboard/ToolGrid]
tech_stack:
  added: []
  patterns: [client-component-fetch, tabs-pattern, recharts-linechart, inline-save-pattern]
key_files:
  created:
    - frontend/app/app/stress/page.tsx
    - frontend/app/app/noticias/page.tsx
    - frontend/app/app/volatilidade/page.tsx
    - frontend/components/admin/AdminConfig.tsx
  modified:
    - frontend/app/app/admin/page.tsx
    - frontend/components/dashboard/ToolGrid.tsx
decisions:
  - "AdminConfig extracted as client component — admin page stays server component for auth guard"
  - "News auto-refresh via setInterval 30min — matches Streamlit ttl=1800 behavior"
  - "Drawdown color thresholds: >20% red (destructive badge), >10% yellow, otherwise plain text"
metrics:
  duration_minutes: 2
  completed_date: "2026-04-01"
  tasks_completed: 5
  files_changed: 6
---

# Phase 12 Plan 03: Remaining Feature Pages + Admin Config + ToolGrid Summary

Stress, Notícias, and Volatilidade frontend pages implemented; AdminConfig section added to admin panel; ToolGrid wired to all 11 pages.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Stress test page | 2173a69 | frontend/app/app/stress/page.tsx |
| 2 | Notícias page | 2173a69 | frontend/app/app/noticias/page.tsx |
| 3 | Volatilidade page | 2173a69 | frontend/app/app/volatilidade/page.tsx |
| 4 | Admin page config section | 2173a69 | frontend/app/app/admin/page.tsx, frontend/components/admin/AdminConfig.tsx |
| 5 | ToolGrid update | 2173a69 | frontend/components/dashboard/ToolGrid.tsx |

## What Was Built

**Stress page** (`/app/stress`): Ticker selector (Açúcar NY / USD/BRL), fetches `/api/stress?ticker=`, renders a shadcn Table with Cenário, Período, Drawdown, Preço Final. Drawdown >20% shows destructive red badge; >10% shows yellow badge.

**Notícias page** (`/app/noticias`): Fetches `/api/news` on mount, auto-refreshes every 30 minutes via `setInterval`. Each news item renders as a shadcn Card with title as external link, source, and published date. Shows "Última atualização: HH:MM" timestamp.

**Volatilidade page** (`/app/volatilidade`): Two tabs (Açúcar NY, USD/BRL), each fetches `/api/volatility?ticker=`. Top section shows 3 metric cards (Vol 30d, 90d, 1y annualized). Bottom section renders a Recharts LineChart of rolling 30d volatility.

**AdminConfig component** (`components/admin/AdminConfig.tsx`): Client component fetching `/api/admin/config`. Renders editable table rows with inline save button per row; PUT `/api/admin/config/{key}` on save. Shows "Salvo!" confirmation for 2 seconds.

**ToolGrid**: Expanded from 4 to 11 entries, adding: Focus, VaR, Breakeven, ARIMA, Estresse, Notícias, Volatilidade.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing component] Created AdminConfig as separate client component**
- **Found during:** Task 4
- **Issue:** Admin page is a server component (uses `createServerSupabaseClient` + redirect); adding a client-side fetch section directly would require converting the entire page to "use client", losing server-side auth guard
- **Fix:** Extracted `AdminConfig` as a separate `"use client"` component imported into the server page — matches the same pattern used by `SuggestionQueue`
- **Files modified:** frontend/components/admin/AdminConfig.tsx (new), frontend/app/app/admin/page.tsx (import added)
- **Commit:** 2173a69

None other — plan executed as written.

## Self-Check: PASSED
