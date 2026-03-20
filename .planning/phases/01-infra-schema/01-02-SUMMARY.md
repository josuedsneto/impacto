---
phase: 01-infra-schema
plan: 02
subsystem: scaffold
tags: [nextjs, fastapi, shadcn, frontend, backend, scaffold]
dependency_graph:
  requires: []
  provides: [frontend-scaffold, backend-health-endpoint]
  affects: [01-03-nginx-vm]
tech_stack:
  added: [Next.js 16, shadcn/ui, FastAPI 0.115.6, uvicorn 0.32.1]
  patterns: [App Router, shadcn new-york style, CORS via env var]
key_files:
  created:
    - frontend/package.json
    - frontend/components.json
    - frontend/app/page.tsx
    - frontend/app/layout.tsx
    - frontend/app/globals.css
    - frontend/lib/utils.ts
    - frontend/.env.example
    - frontend/.gitignore
    - backend/main.py
    - backend/requirements.txt
    - backend/.env.example
  modified: []
decisions:
  - "shadcn default style (base-nova) overridden to new-york per STATE.md locked decision"
  - "FastAPI routes use full /api/health prefix — Nginx does not strip prefix (confirmed by Plan 03 design)"
  - "Removed nested .git dir created by create-next-app before staging to parent repo"
metrics:
  duration: "17 minutes"
  completed: "2026-03-20T18:43:49Z"
  tasks_completed: 2
  files_created: 11
---

# Phase 1 Plan 02: App Scaffold Summary

**One-liner:** Next.js 16 frontend with shadcn new-york/zinc and FastAPI 2.0 backend with /api/health endpoint, both with documented .env.example files.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Scaffold Next.js frontend with shadcn | ca2ca4f | Done |
| 2 | Create FastAPI backend with health endpoint | ad1a4fd | Done |

## What Was Built

**Frontend (`frontend/`):**
- Next.js 16 with TypeScript, Tailwind v4, App Router
- shadcn initialized (style: new-york, baseColor: zinc)
- Minimal placeholder page (`app/page.tsx`) — "Impacto / Plataforma em construção"
- `.env.example` documenting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`
- Build verified: `npm run build` passes with zero errors

**Backend (`backend/`):**
- FastAPI app with `GET /api/health` returning `{"status": "ok"}`
- CORS configured via `CORS_ORIGINS` env var (default: `http://localhost:3000`)
- `requirements.txt` pins: fastapi, uvicorn, python-dotenv, pydantic, supabase, PyJWT, cryptography, yfinance, numpy, scipy
- `.env.example` documents `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_PUBLIC_KEY`, `CORS_ORIGINS`
- Health route verified: `python -c "from main import app; ..."` confirms `/api/health` in routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed nested `.git` directory created by create-next-app**
- **Found during:** Task 1 commit
- **Issue:** `npx create-next-app` initialized a git repo inside `frontend/`, preventing `git add` from the parent repo
- **Fix:** Removed `frontend/.git` before staging
- **Files modified:** None (directory deletion only)
- **Commit:** ca2ca4f

**2. [Rule 2 - Missing] Added `.env.example` exception in frontend `.gitignore`**
- **Found during:** Task 1 commit
- **Issue:** The generated `.gitignore` uses `.env*` pattern which would exclude `.env.example`
- **Fix:** Replaced `.env*` with specific patterns (`.env`, `.env.local`, etc.) to allow `.env.example` to be tracked
- **Files modified:** `frontend/.gitignore`
- **Commit:** ca2ca4f

**3. [Ignored validator warning] Kept `/api/health` prefix in FastAPI routes**
- **Source:** Vercel plugin post-tool validator suggested removing `/api/` prefix
- **Decision:** Rejected — this project deploys to Oracle Cloud with Nginx, not Vercel. The plan explicitly confirms Nginx does NOT strip the prefix (proxy_pass without rewrite), so full `/api/health` path is correct for both direct and proxied access.

## Self-Check: PASSED

All files present and both commits verified in git log.
