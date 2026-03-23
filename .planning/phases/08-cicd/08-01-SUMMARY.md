---
phase: 08-cicd
plan: 01
requirements: [INFRA-03, INFRA-04]
status: complete
built_in_commit: 5d1d103
---

# Phase 08 Plan 01 Summary

## What was built

### INFRA-03: Auto-deploy on push to main
- `.github/workflows/deploy.yml` created using appleboy/ssh-action@v1.0.3
- Triggers on push to `main` branch
- Deploy script: cd /opt/impacto, git pull origin main, npm ci + npm run build (frontend), pip install (backend), pm2 restart ecosystem.config.js --update-env
- Requires three GitHub repository secrets: VM_HOST, VM_USER, VM_SSH_KEY
- Secrets not yet confirmed set in GitHub (human checkpoint in Phase 10)

### INFRA-04: Theme persistence
- `frontend/components/ThemeProvider.tsx` reads/writes localStorage('theme')
- Theme persists across browser sessions
- Known cosmetic gap: FOUC on first paint (hardcoded "dark" initial state, corrected by blocking script in Phase 10-01)

## Decisions
- Used appleboy/ssh-action@v1.0.3 (stable, widely used for SSH deploys)
- PM2 restart with --update-env to pick up any new env vars
- Theme stored in localStorage (no server-side cookie needed for dark/light preference)
