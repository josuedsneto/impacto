# Dashboard Page Design

**Date:** 2026-03-30
**Status:** Approved
**Audience:** Mill analysts and trading/commercial teams

---

## Overview

A unified market dashboard for sugarcane industry professionals. Combines live market data with quick access to all analytical tools in a single, readable screen. Light-mode SaaS aesthetic with no emojis — financial-grade look and feel.

---

## Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (224px, dark)  │  Main area (flex-1, light)    │
│                         │                               │
│  IMPACTO                │  Header (title + date + user) │
│  Análise de Mercado     │  Ticker tape (dark strip)     │
│                         │                               │
│  · Dashboard (active)   │  PREÇOS AO VIVO               │
│                         │  [ Sugar card ] [ FX card ]   │
│  MERCADO                │                               │
│  · Monte Carlo          │  INFORMAÇÕES EM TEMPO REAL    │
│  · Payoff Opções        │  [Notícias] [Focus] [Resumo]  │
│  · Precificação         │                               │
│  · Volatilidade         │  FERRAMENTAS                  │
│                         │  [MC] [Payoff] [Preç] [VaR]   │
│  RISCO                  │  [Breakeven]                  │
│  · VaR                  │                               │
│  · Breakeven            │                               │
│  · Stress Test          │                               │
│                         │                               │
│  ANÁLISE                │                               │
│  · Notícias             │                               │
│  · Focus BCB            │                               │
│  · ARIMA                │                               │
└─────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Sidebar (`frontend/app/app/layout.tsx` — already exists)

- Background: `#111827` (gray-900)
- Brand: "IMPACTO" + subtitle "Análise de Mercado"
- Nav items grouped into 3 sections: Mercado · Risco · Análise
- Active item: left blue border (`#3b82f6`), lighter background
- No icons — dot indicator only
- Width: 224px, fixed

### 2. Header

- White background, bottom border
- Left: `<h1>Dashboard</h1>` (20px, bold) + date subtitle (13px, muted)
- Right: "Mercado aberto" badge (green dot + text) + user email + avatar initials
- Padding: 18px 28px

### 3. Ticker Tape

- Dark strip (`#1f2937`) below header, full width
- Items: Açúcar NY · USD/BRL · SBK26 · SELIC · IPCA Exp.
- Each shows: label · value · change (green/red/gray)
- Separated by `·` dots
- Data: pulled from backend `/api/market/prices` at page load (server component)

### 4. Price Cards (live widgets) — 2-column grid

Each card shows:
- Asset name + exchange label
- Large price (32px, tabular-nums)
- Unit (¢/lb or R$)
- 12-month range (min/max)
- Percent change badge (green/red)
- Mini bar chart (19 bars, 48px tall) — last ~3 months of closes

**Data source:** `/api/market/prices?ticker=SB=F` and `USDBRL=X`, last 90 days

### 5. Live Widgets — 3-column grid

#### Notícias do Mercado
- 4 most recent news items from Google News RSS
- Tag badge per item: Açúcar (amber) or Câmbio (blue)
- Headline + timestamp
- Client component (fetches on browser side, no SSR needed)
- Existing `NewsFeed` component — reuse with style updates

#### Relatório Focus · BCB
- 4 key indicators: IPCA · SELIC · USD/BRL · PIB
- Each: name + projection year + value + delta vs prior week (red/green/gray)
- Data: BCB Focus API (existing `16_Relatorio_Focus.py` logic → backend endpoint)
- Server component with `revalidate: 3600`

#### Resumo da Conta
- Last MC simulation: ticker + P50 + time
- VaR 95% for main ticker
- Last breakeven BRL/sc value
- Simulation count this month
- Data: `/api/simulations` (last item) + user-specific stats
- Server component

### 6. Tool Navigation Cards — 5-column grid

One card per tool: Monte Carlo · Payoff Opções · Precificação · VaR · Breakeven
Each card: title (13px bold) + one-line description (11px muted) + "Acessar →" link
Hover: blue border + light blue background
No icons — text only

---

## Data Flow

```
DashboardPage (Server Component)
  ├── supabase.auth.getUser()          → redirect to /login if unauthenticated
  ├── fetchPrices("SB=F", token)       → /api/market/prices (with revalidate:3600)
  ├── fetchPrices("USDBRL=X", token)   → /api/market/prices (with revalidate:3600)
  ├── fetchFocus(token)                → /api/focus (new endpoint, revalidate:3600)
  └── fetchAccountSummary(token)       → /api/simulations (last + count)

NewsFeed (Client Component)
  └── useEffect → Google News RSS via allorigins.win proxy
```

**Fetch timeout:** All server-side fetches must include `signal: AbortSignal.timeout(8000)` to prevent hanging when the Oracle VM backend is unreachable (prevents 504 cascades).

---

## Visual Tokens

| Token | Value |
|-------|-------|
| Background | `#f4f6f9` |
| Card background | `#ffffff` |
| Card border | `#e5e7eb` |
| Sidebar bg | `#111827` |
| Ticker bg | `#1f2937` |
| Primary text | `#111827` |
| Muted text | `#6b7280` |
| Positive | `#15803d` (text) · `#f0fdf4` (bg) |
| Negative | `#b91c1c` (text) · `#fef2f2` (bg) |
| Accent | `#3b82f6` |
| Price font size | 32px |
| Section labels | 11px, uppercase, `#6b7280`, 1.5px letter-spacing |

---

## New Backend Endpoint Required

`GET /api/focus` — Returns latest BCB Focus report values for IPCA, SELIC, USD/BRL, PIB (current year + prior week delta). Reuses logic from `pages/16_Relatorio_Focus.py`.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `frontend/app/app/dashboard/page.tsx` | Rewrite with new layout |
| `frontend/components/dashboard/PriceCard.tsx` | Update styles (larger price, new bar chart) |
| `frontend/components/dashboard/NewsFeed.tsx` | Minor style updates only |
| `frontend/components/dashboard/FocusWidget.tsx` | New component |
| `frontend/components/dashboard/AccountSummary.tsx` | New component |
| `frontend/components/dashboard/ToolGrid.tsx` | New component |
| `backend/main.py` | Add `GET /api/focus` endpoint |

---

## Out of Scope

- Scrolling/animated ticker tape (static is sufficient)
- Dark mode toggle (light mode only for now)
- Real-time WebSocket price updates (poll on page load is enough)
- Mobile responsive layout (desktop-first)
