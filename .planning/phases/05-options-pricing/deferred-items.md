# Deferred Items — Phase 05-01

## Pre-existing: Route prefix includes /api/ prefix (vercel-services rule)

All existing FastAPI routes in backend/main.py use /api/* prefixes (e.g. /api/health, /api/me, /api/simulations).
Per vercel-services skill, Vercel strips the routePrefix before forwarding, so routes should omit the prefix.

This is a pre-existing architectural pattern established in prior phases (STATE.md records:
"FastAPI routes use full /api/health prefix — Nginx proxies without stripping prefix").
This is out of scope for 05-01. Raise as separate task if deploying to Vercel with Services preset.

Lines affected: 29, 34, 40, 65, 83, 138, 161, 203, 222
