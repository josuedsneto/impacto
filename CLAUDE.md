# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Impacto** is a financial analysis platform for Monte Carlo price simulations, options pricing, and hedge management on Brazilian financial assets (sugar futures, USD/BRL exchange rate). The UI and variables are in Portuguese.

> **The Streamlit version (`Painel.py` + `pages/`) is deprecated and no longer maintained.**
> All new development happens in the **Next.js frontend** (`frontend/`) and **FastAPI backend** (`backend/`).

## Active Stack

### Frontend — Next.js (`frontend/`)

```bash
cd frontend
npm run dev   # → http://localhost:3000
```

- **Framework**: Next.js (App Router) with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components (`components/ui/`)
- **Auth**: Supabase SSR (`@supabase/ssr`) — server components use `createServerSupabaseClient`, client components use `createBrowserClient`
- **State**: React state + fetch against the FastAPI backend (no global store)
- **Charts**: Recharts (where used) or plain SVG/table
- **Toasts**: `sonner` via `toast.success / toast.error`

Page structure: `app/(auth)/` for login, `app/app/` for authenticated pages.
All authenticated pages: server components redirect to `/login` if no session; client components call `getToken()` and pass `Authorization: Bearer <token>` to every API call.

### Backend — FastAPI (`backend/`)

```bash
cd backend
uvicorn main:app --reload   # → http://localhost:8000
```

- **Auth guard**: `Depends(get_current_user)` on every protected route
- **Database**: Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars)
- **Rate limiting**: SlowAPI (`@limiter.limit("N/minute")` on every endpoint)
- **Migrations**: `supabase/migrations/` (single source, timestamped `YYYYMMDDHHMMSS_name.sql`) — run in Supabase SQL Editor or via `supabase db push`

Routers are in `backend/routers/` and registered in `backend/main.py`.

### Database — Supabase

Key tables: `simulations`, `price_alerts`, `fixacoes_cobertura`, `usinas`, `user_usinas`, `atr_simulacoes`.
All tables have RLS enabled. Service role key bypasses RLS (backend only — never expose to frontend).

## Frontend Page Conventions

- **Server components** (no interactivity): fetch data at render time, no `"use client"`, use `createServerSupabaseClient` from `@/lib/supabase/server`.
- **Client components** (forms, live state): `"use client"` at top, use `createBrowserClient`, call `getToken()` before each API request.
- `MetricCard` pattern (label + value + optional sub) is used across pages — add to a component if reused.
- Format BR numbers: `.toFixed(2)` with `.replace(".", ",")` where needed.

## Sidebar

Navigation is defined in `components/layout/AppSidebar.tsx` (`NAV_SECTIONS` array). Add new pages there.

## Deprecated (do not modify)

The following exist for historical reference only — do not add features or fix bugs here:

- `Painel.py` and all `pages/*.py` (Streamlit)
- `config.py`, `utils.py`, `options.py` (Streamlit helpers)
- `requirements.txt`
- CSV data files (`*.csv` in root)
