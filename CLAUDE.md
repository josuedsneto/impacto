# CLAUDE.md

Orientação para o Claude Code (claude.ai/code) neste repositório.

## Visão geral

**Sugarcane / Impacto** é uma plataforma interna de análise de mercado e risco para usinas de açúcar: simulações Monte Carlo, opções, VaR, regressões, ATR e fixações. A interface e os textos são em português.

## Arquitetura

| Parte | Pasta | Tecnologia |
|---|---|---|
| Frontend | `frontend/` | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, Recharts |
| API | `backend/` | FastAPI, NumPy/SciPy, statsmodels, yfinance |
| Banco e login | `supabase/migrations/` | Supabase: Auth (JWT ES256), Postgres com RLS |

- O frontend autentica no Supabase e chama a API com `Authorization: Bearer <token>`. A API valida o JWT localmente (`backend/auth.py`) e usa a service role para o banco.
- Preços históricos passam pelo cache em `backend/market_cache.py` (`get_prices`): tabela `market_prices` + `market_coverage`, buscando no Yahoo só o que falta.
- Rotas do app ficam em `frontend/app/app/<ferramenta>/page.tsx`; o menu está em `frontend/components/layout/AppSidebar.tsx`.
- Specs do refactoring em andamento: `.specs/` (decisões em `.specs/STATE.md`).

## Rodar localmente

```bash
# API (porta 8000) — copie backend/.env.example para backend/.env
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend (porta 3000) — copie frontend/.env.example para frontend/.env.local
cd frontend && npm ci && npm run dev
```

## Testes e checagens

```bash
cd backend && python test_calcs.py && python test_mensagens.py   # cálculos e mensagens em português
cd frontend && npm test && npm run build && npm run lint
```

## Deploy

Push na `main` dispara `.github/workflows/deploy.yml`: SSH na VM Oracle, `git pull`, build do frontend, `pip install` e `pm2 restart` (`scripts/ecosystem.config.js`: Next na 3000, uvicorn com 4 workers na 8000). O nginx (`nginx/impacto.conf`) envia `/api/` para a API e o resto para o Next. **Não faça push na `main` sem autorização explícita.**

## Convenções

- Volatilidades e taxas que o usuário configura são anuais; as simulações andam em passos diários (divida por √252).
- Endpoints com I/O bloqueante são `def` (não `async def`) para rodar no threadpool do FastAPI.
- Use `supa_client()` de `market_cache.py`; não crie clientes Supabase por requisição.
