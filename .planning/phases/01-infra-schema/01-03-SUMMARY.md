---
phase: 01-infra-schema
plan: 03
subsystem: infra
tags: [nginx, ssl, certbot, pm2, uvicorn, nextjs, supabase, oracle-cloud]

# Dependency graph
requires:
  - phase: 01-infra-schema
    plan: 01
    provides: "7 Supabase migration SQL files"
  - phase: 01-infra-schema
    plan: 02
    provides: "Next.js frontend on :3000, FastAPI backend on :8000"
provides:
  - "nginx/impacto.conf — Nginx reverse proxy config with SSL, HTTP/2, rate limiting"
  - "scripts/setup-vm.sh — idempotent Ubuntu 22.04 ARM VM bootstrap"
  - "scripts/ecosystem.config.js — PM2 process config for Next.js and uvicorn"
  - "Supabase migrations validated locally (7 files)"
affects: [02-auth, 03-api, 04-frontend, deploy]

# Tech tracking
tech-stack:
  added: [nginx, certbot, pm2, ecosystem.config.js]
  patterns:
    - "Nginx reverse proxy without prefix stripping — /api/health forwards as /api/health"
    - "Rate limiting zone (api_limit) scoped to /api/* at 30r/s with burst=60"
    - "PM2 ecosystem.config.js as single entry point to start all services"
    - "Idempotent VM bootstrap: guards with command -v checks before reinstalling"

key-files:
  created:
    - nginx/impacto.conf
    - scripts/setup-vm.sh
    - scripts/ecosystem.config.js
  modified: []

key-decisions:
  - "Nginx does NOT strip /api prefix before proxying to FastAPI — proxy_pass http://localhost:8000 with no rewrite rule"
  - "setup-vm.sh accepts domain as $1 positional arg; SSL setup is skipped with a clear warning if domain is omitted"
  - "PM2 runs uvicorn with interpreter=none (uvicorn is the executable, not a Python script)"
  - "VM/Supabase steps deferred to provisioning — local artifact validation approved by user"

patterns-established:
  - "Template placeholder: nginx/impacto.conf uses <domain> literal; setup-vm.sh substitutes via sed before writing to sites-available"
  - "Rate limit zone declared outside server block (top level of config) so it can be shared across server blocks"

requirements-completed: [INFRA-02]

# Metrics
duration: ~30min
completed: 2026-03-20
---

# Phase 1 Plan 03: Nginx + VM Bootstrap Summary

**Nginx reverse proxy config (SSL, HTTP/2, 30r/s rate limit) and idempotent Oracle Cloud VM bootstrap script with PM2 ecosystem config — Supabase migrations validated locally (VM/Supabase push deferred to provisioning)**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-20T00:00:00Z
- **Completed:** 2026-03-20
- **Tasks:** 2 auto + 1 checkpoint (approved)
- **Files modified:** 3 created

## Accomplishments

- Nginx config with HTTP-to-HTTPS redirect, HTTP/2, TLSv1.2/1.3, 30r/s rate limiting on /api/*, proxy_read_timeout 120s, correct proxy_pass targets (:3000 frontend, :8000 FastAPI)
- Idempotent VM bootstrap script for Ubuntu 22.04 ARM64: Node.js 20, Python 3.11, Nginx, Certbot, PM2
- PM2 ecosystem.config.js starts Next.js (`next start -p 3000`) and uvicorn (`--workers 4 --host 127.0.0.1 --port 8000`)
- All 7 Supabase migration files validated for SQL structure locally; `supabase db push` deferred until Supabase project is linked

## Task Commits

1. **Task 1: Write Nginx config and VM bootstrap script** - `f0ddc41` (feat)
2. **Task 2: Apply Supabase migrations locally and verify** - validation only, no new files committed
3. **Task 3: checkpoint:human-verify** - APPROVED (local checks passed; VM/Supabase deferred)

## Files Created/Modified

- `nginx/impacto.conf` — Nginx reverse proxy with SSL template, rate limiting, HTTP/2
- `scripts/setup-vm.sh` — Idempotent VM bootstrap (Node 20, Python 3.11, Nginx, Certbot, PM2)
- `scripts/ecosystem.config.js` — PM2 app config for Next.js (:3000) and uvicorn (:8000)

## Decisions Made

- Nginx proxies `/api/*` to FastAPI WITHOUT stripping the prefix — FastAPI routes must include `/api/` (already established in Plan 02)
- `setup-vm.sh` takes domain as positional arg `$1`; gracefully skips SSL with a warning if not provided
- VM and Supabase provisioning steps deferred — infrastructure not yet available; plan artifacts are complete and correct

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Local artifact validation passed. VM and Supabase steps are pending external provisioning (Oracle Cloud VM and Supabase project ref).

## User Setup Required

**External services require manual configuration before the stack can go live:**

### Oracle Cloud VM
1. Open ports 80 and 443 in Oracle Cloud Console → Networking → Virtual Cloud Networks → Security Lists → Ingress Rules
2. Point domain A record to VM public IP at your DNS provider
3. SSH into VM: `ssh ubuntu@<vm-ip>`
4. Clone repo: `git clone <repo-url> /opt/impacto && cd /opt/impacto`
5. Run bootstrap: `sudo bash scripts/setup-vm.sh your.domain.com`
6. Start services: `pm2 start scripts/ecosystem.config.js`
7. Verify: `curl http://localhost:8000/api/health` → `{"status":"ok"}`

### Supabase
1. Get access token: Supabase Dashboard → Account → Access Tokens
2. Get project ref: Supabase Dashboard → Project Settings → General → Reference ID
3. `supabase link --project-ref <ref>`
4. `supabase db push` → verify no errors
5. Dashboard → Table Editor → confirm 6 tables exist
6. Dashboard → Authentication → Policies → confirm RLS policies on simulations, user_parameters, watchlist

## Next Phase Readiness

- All Phase 1 infrastructure artifacts are complete and committed
- Phase 2 (Auth) can begin immediately — it does not require a live VM
- VM deployment can proceed in parallel once Oracle Cloud VM is provisioned
- Supabase push can proceed once project ref is available

---
*Phase: 01-infra-schema*
*Completed: 2026-03-20*
