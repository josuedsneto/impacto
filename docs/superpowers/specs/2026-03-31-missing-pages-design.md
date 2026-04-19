# Design: Missing Pages Implementation
**Date:** 2026-03-31
**Stack:** Next.js (Vercel) + FastAPI (Oracle Cloud) + Supabase

---

## Overview

Implement 9 missing features: 1 login page + 8 app pages. The project follows the existing pattern: FastAPI endpoints (authenticated via Supabase JWT) + Next.js pages (shadcn/ui + Recharts).

---

## Architecture

**Frontend (Vercel):** Next.js App Router at `frontend/`
**Backend (Oracle Cloud):** FastAPI at `backend/main.py`
**Auth:** Supabase (JWT via `get_current_user` dependency)
**Data:** yfinance for market data, feedparser for news RSS
**Charts:** Recharts (already used in simulation page)

All new backend endpoints follow the existing pattern:
- Authenticated via `Depends(get_current_user)`
- Return JSON
- Use yfinance for market data

All new frontend pages follow the existing pattern:
- `getAccessToken()` from Supabase browser client
- `fetch(${BACKEND_URL}/api/..., { headers: { Authorization: Bearer ${token} } })`
- shadcn/ui components + Recharts for charts

---

## Feature 1: Login Page

**Route:** `/login` (public, outside `/app/`)

**Components:**
- `frontend/app/login/page.tsx` — two tabs: Email+Senha and Magic Link
- `frontend/middleware.ts` — protects all `/app/*` routes, redirects unauthenticated users to `/login`

**Supabase calls:**
- Tab 1: `signInWithPassword({ email, password })`
- Tab 2: `signInWithOtp({ email })` → shows "check your email" confirmation

**Flow:**
1. Unauthenticated user hits any `/app/*` → middleware redirects to `/login`
2. After successful login → redirect to `/app/dashboard`
3. Middleware uses `createServerClient` from `@supabase/ssr` to read session from cookies

---

## Feature 2: /app/pricing (Redirect)

**Implementation:** `frontend/app/app/pricing/page.tsx` with a single `redirect('/app/options')` call.
No new backend needed. Payoff, BS Pricer, and MC Pricer already live at `/app/options`.

---

## Feature 3: /app/focus

**Route:** `/app/focus`
**Backend:** Existing `GET /api/focus` (returns IPCA, Câmbio, Selic, PIB with delta)

**Frontend:**
- Server Component with `revalidate: 3600`
- 4 metric cards showing current value + weekly delta (green/red arrow)
- Shows `ano_referencia` as subtitle

---

## Feature 4: /app/var

**Route:** `/app/var`
**Backend:** New `GET /api/var/{ticker}?start=&end=&confidence=`

**Backend logic (`backend/main.py`):**
- Fetch OHLCV via `get_prices(ticker, start, end)` 
- Compute daily log returns
- **Historical VaR:** sort returns, take percentile at `(1 - confidence)`
- **Parametric VaR:** `mean - z * std` where z = 1.645 (95%) or 2.326 (99%)
- Return: `{ historical_var, parametric_var, returns: [...], mean, std, n_days }`

**Frontend:**
- Form: ticker (default SB=F), start date, end date, confidence (95% or 99%)
- Comparison table: Historical vs Parametric VaR
- Histogram of daily returns (Recharts BarChart) with vertical line at VaR threshold

---

## Feature 5: /app/breakeven

**Route:** `/app/breakeven`
**Backend:** New `POST /api/breakeven`

**Request body:**
```json
{
  "mode": "cambio_minimo" | "custo_maximo" | "grid",
  "custo_reais": float,       // R$/saca
  "preco_cents": float,       // cents/lb
  "cambio": float,            // R$/USD
  "sacas": float              // volume (optional, default 1)
}
```

**Backend logic:**
- Conversion factor (cents/lb → R$/saca) loaded from Supabase table `admin_config` key `breakeven_fator_conversao` (default: `0.022046 * 50.802 = 1.12045`). Admin can update via `/app/admin`.
- `cambio_minimo`: `custo_reais / (preco_cents * fator_conversao)`
- `custo_maximo`: `preco_cents * fator_conversao * cambio`
- `grid`: returns 10×10 matrix of (cambio × preco) → resultado R$

**Frontend — 3 tabs:**
1. *Câmbio Mínimo*: inputs custo + preço → shows câmbio mínimo necessário
2. *Custo Máximo*: inputs preço + câmbio → shows custo máximo suportável
3. *Grid de Cenários*: range inputs → color-coded table (green = lucro, red = prejuízo)

---

## Feature 6: /app/arima

**Route:** `/app/arima`
**Backend:** New `POST /api/arima`

**Request body:**
```json
{
  "ticker": "SB=F" | "USDBRL=X",
  "dias_historico": 252,
  "dias_forecast": 30
}
```

**Backend logic:**
- Fetch last `dias_historico` days of close prices via yfinance
- Fit ARIMA(p,d,q) via `statsmodels.tsa.arima.model.ARIMA` — p, d, q passed by user (defaults: 1,1,1)
- Forecast `dias_forecast` steps with 95% confidence interval
- Return: `{ historico: [{date, value}], forecast: [{date, value, lower, upper}] }`

**Frontend:**
- Select: ativo (Açúcar NY / Dólar BRL)
- Sliders: dias histórico (63–504) e dias forecast (5–90)
- Inputs p, d, q (inteiros 0–5, defaults 1,1,1)
- Recharts LineChart: historical (solid) + forecast (dashed) + CI shaded area

---

## Feature 7: /app/stress

**Route:** `/app/stress`
**Backend:** New `POST /api/stress`

**Request body:**
```json
{
  "mode": "historico" | "manual",
  "ticker": "SB=F",
  "preco_atual": float,
  "cambio_atual": float,
  "cenario": "2008" | "covid" | "custom",
  "choque_preco_pct": float,    // manual mode
  "choque_cambio_pct": float    // manual mode
}
```

**Historical scenarios (hardcoded shocks):**
| Cenário | Choque preço | Choque câmbio |
|---------|-------------|---------------|
| Crise 2008 | -45% | +60% |
| COVID 2020 | -25% | +30% |
| Seca 2021 | +35% | +15% |
| Eleições 2022 | -10% | +25% |

**Backend returns:** `{ preco_estressado, cambio_estressado, impacto_pct, receita_delta_reais }`

**Frontend — 2 tabs:**
1. *Cenários Históricos*: dropdown de crise → cards com impacto
2. *Cenários Manuais*: dois sliders (-80% a +80%) → resultado em tempo real

---

## Feature 8: /app/news

**Route:** `/app/news`
**Backend:** New `GET /api/news`

**Backend logic:**
- `pip install feedparser`
- Fetch 2 RSS feeds:
  - `https://news.google.com/rss/search?q=açúcar+futuros+NY&hl=pt-BR&gl=BR`
  - `https://news.google.com/rss/search?q=dólar+real+câmbio&hl=pt-BR&gl=BR`
- Parse with feedparser, return top 20 entries merged and sorted by date
- Backend-level cache: store last result + timestamp, refresh only if >30min old
- Return: `{ articles: [{ title, source, published, link }] }`

**Frontend:**
- Grid of news cards: título, fonte, data, link externo
- Auto-refresh every 30min via `revalidate: 1800`

---

## Feature 9: /app/volatility

**Route:** `/app/volatility`
**Backend:** New `GET /api/volatility/{ticker}?start=&end=`

**Backend logic:**
- Fetch OHLCV via `get_prices(ticker, start, end)`
- Compute log returns
- Rolling std × √252 for windows: 21d, 63d, 252d
- Return: `{ series: [{date, vol_21, vol_63, vol_252}], stats: { vol_21: {mean, max, min}, ... } }`

**Frontend:**
- Select: ticker + período (1y default)
- Recharts LineChart: 3 lines (21d, 63d, 252d) with legend
- Cone de volatilidade: current price ± N×σ projected forward (Recharts AreaChart)
- Stats table: média / máx / mín por janela

---

## ToolGrid Update

Update `frontend/components/dashboard/ToolGrid.tsx` to include all new pages:

```
Monte Carlo → /app/simulation
Payoff Opções → /app/options
Precificação → /app/pricing (redirects to /app/options)
VaR → /app/var
Breakeven → /app/breakeven
ARIMA → /app/arima
Stress Test → /app/stress
Notícias → /app/news
Volatilidade → /app/volatility
Focus BCB → /app/focus
```

---

## Admin Config (Supabase)

New table `admin_config`:
```sql
create table admin_config (
  key text primary key,
  value text not null,
  description text,
  updated_at date
);
insert into admin_config values ('breakeven_fator_conversao', '1.12045', 'Fator conversão cents/lb → R$/saca', current_date);
```

New backend endpoint: `PUT /api/admin/config/{key}` (requires `require_admin`)
New frontend section in `/app/admin`: table listing all `admin_config` rows with inline edit.

---

## New Python Dependencies (backend)

```
statsmodels   # ARIMA
feedparser    # News RSS
```

Add to `backend/requirements.txt`.

---

## New npm Dependencies (frontend)

None required — Recharts and shadcn/ui already installed.

---

## Implementation Order

1. Login page + middleware (unblocks all testing)
2. `/app/focus` (backend ready, trivial)
3. `/app/pricing` redirect (trivial)
4. Backend: var, breakeven, stress, news, volatility, arima (all in `main.py`)
5. Frontend pages: var, breakeven, stress, news, volatility, arima
6. ToolGrid update
