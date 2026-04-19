# Fixações — Market Technical Analysis Feature

**Date:** 2026-04-13  
**Status:** Approved

## Overview

Rebuild the Fixações market feature as a Next.js page backed by a new FastAPI endpoint. Users enter any financial ticker, data is fetched from yfinance and cached in Supabase so no ticker+period is ever fetched twice. The page renders an interactive price chart with configurable technical indicators (overlays + oscillator subplots) and per-indicator buy/sell signals shown as triangles on the price chart.

---

## Architecture

```
Frontend (/app/fixacoes)
  └── FixacoesPage          — state management, data fetching
      ├── TickerSelect      — Select (4 presets + "Outro..." → text input)
      ├── IndicatorSelector — indicator checkboxes + MA period inputs + collapsible params
      └── FixacoesChart     — Plotly: price row + oscillator subplots + signal markers

Backend (FastAPI)
  └── GET /api/market/analysis
        ├── market_cache.get_prices()   — OHLCV from Supabase (no re-fetch for cached ranges)
        ├── pandas-ta                   — computes requested indicators
        ├── signal generation           — per-indicator buy/sell crossover logic
        └── returns { ticker, rows[], signals[] }

Supabase
  └── market_prices + market_coverage  — existing tables, no schema changes
```

No new database tables. The existing cache-aside service (`market_cache.get_prices()`) deduplicates yfinance fetches across all users.

---

## Backend

### New endpoint: `GET /api/market/analysis`

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `ticker` | string | required | Yahoo Finance ticker, e.g. `SB=F` |
| `start` | date | required | Start date, e.g. `2024-01-01` |
| `end` | date | required | End date, e.g. `2025-04-13` |
| `indicators` | string (CSV) | `""` | Comma-separated: `rsi,bollinger,macd,stoch,cci` |
| `rsi_period` | int | 14 | RSI lookback period |
| `bb_window` | int | 20 | Bollinger Bands window |
| `bb_std` | float | 2.0 | Bollinger Bands std dev multiplier |
| `macd_fast` | int | 12 | MACD fast EMA period |
| `macd_slow` | int | 26 | MACD slow EMA period |
| `macd_signal` | int | 9 | MACD signal line period |
| `stoch_k` | int | 14 | Stochastic %K period |
| `stoch_d` | int | 3 | Stochastic %D smoothing |
| `cci_period` | int | 20 | CCI lookback period |
| `sma_periods` | string (CSV) | `""` | SMA periods to compute, e.g. `20,50,200` |
| `ema_periods` | string (CSV) | `""` | EMA periods to compute, e.g. `9,21` |

**Response shape:**

```json
{
  "ticker": "SB=F",
  "rows": [
    {
      "date": "2024-01-02",
      "open": 23.5,
      "high": 24.1,
      "low": 23.2,
      "close": 23.8,
      "volume": 1234567,
      "bb_upper": 25.0,
      "bb_mid": 23.5,
      "bb_lower": 22.0,
      "rsi": 55.2,
      "macd": 0.3,
      "macd_signal": 0.2,
      "macd_hist": 0.1,
      "stoch_k": 65.0,
      "stoch_d": 60.0,
      "cci": 85.0,
      "sma_20": 23.5,
      "sma_50": null,
      "ema_9": 23.6
    }
  ],
  "signals": [
    { "date": "2024-03-15", "type": "buy",  "indicator": "rsi",      "price": 21.3 },
    { "date": "2024-05-10", "type": "sell", "indicator": "bollinger", "price": 25.8 }
  ]
}
```

- Fields for unselected indicators are omitted from each row.
- `null` values appear during warmup periods (first N rows before indicator has enough history).
- Signals are only emitted for selected indicators.

### Technical library: `pandas-ta`

Add `pandas-ta` to `backend/requirements.txt`. All indicator computations use `df.ta.*()` methods.

### Signal generation logic (per indicator)

| Indicator | Buy signal | Sell signal |
|---|---|---|
| RSI | RSI crosses above 30 (from below) | RSI crosses below 70 (from above) |
| Bollinger Bands | Close crosses above lower band (from below) | Close crosses above upper band (from below) |
| MACD | MACD crosses above signal line | MACD crosses below signal line |
| Stochastic Slow | %K crosses above 20 | %K crosses below 80 |
| CCI | CCI crosses above −100 | CCI crosses below +100 |
| SMA (crossover) | Fast SMA crosses above slow SMA (if ≥2 periods selected) | Fast SMA crosses below slow SMA |
| EMA (crossover) | Fast EMA crosses above slow EMA (if ≥2 periods selected) | Fast EMA crosses below slow EMA |

---

## Frontend

### Route: `/app/fixacoes`

**File:** `frontend/app/app/fixacoes/page.tsx`

**Default state on load:**
- Ticker: `SB=F`
- Date range: today − 1 year → today
- Selected indicators: `bollinger`, `rsi`
- SMA periods: `20, 50`
- EMA periods: none
- Chart type: Candlestick

### Components

#### `TickerSelect` (`components/market/TickerSelect.tsx`)
- shadcn `Select` with options: `SBK26.NYB`, `USDBRL=X`, `SB=F`, `CL=F`, `Outro...`
- When "Outro..." is selected, shows a text `Input` for free-form ticker entry
- Emits `onChange(ticker: string)`

#### `IndicatorSelector` (`components/market/IndicatorSelector.tsx`)
- Checkboxes for: Bollinger Bands, RSI, MACD, Estocástico Lento, CCI
- MA section: SMA period chips (20, 50, 200 toggleable) + EMA period chips (9, 21 toggleable)
- Collapsible "Parâmetros" panel — shows numeric inputs for params of each selected indicator
- Emits `onChange(config: IndicatorConfig)`

#### `FixacoesChart` (`components/market/FixacoesChart.tsx`)
- Uses `react-plotly.js` (already installed)
- Toggle: Candlestick / Linha (radio or segmented control)
- **Row 1 (price):** candlestick or line trace + all overlay indicators (BB bands, SMAs, EMAs) + buy/sell signal scatter traces
- **Rows 2–N (oscillators):** one subplot per selected oscillator (RSI, MACD, Stochastic, CCI) with shared x-axis
- All subplots share the x-axis (zoom/pan linked)
- Buy signals: `marker.symbol = "triangle-up"`, `marker.color = "green"`, plotted at signal price
- Sell signals: `marker.symbol = "triangle-down"`, `marker.color = "red"`, plotted at signal price
- Each indicator's signals are a separate named Plotly trace (toggleable in legend)
- RSI subplot: dashed reference lines at 30 and 70
- Stochastic subplot: dashed reference lines at 20 and 80
- CCI subplot: dashed reference lines at −100 and +100
- MACD subplot: histogram bars + MACD line + signal line

### Page layout

```
Fixações
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Ticker ▼]  [Início 📅]  [Fim 📅]  [Analisar]

Indicadores: [✓ Bollinger] [✓ RSI] [ ] MACD [ ] Estocástico [ ] CCI
MAs: SMA [20✓] [50✓] [200 ] | EMA [9 ] [21 ]
▼ Parâmetros (collapsible)

[Candlestick | Linha]

┌── Preço + Overlays ──────────────────────────┐
│  ▲ green buy triangles per indicator          │
│  ▼ red sell triangles per indicator           │
└──────────────────────────────────────────────┘
┌── RSI ───────────────────────────────────────┐
└──────────────────────────────────────────────┘
┌── MACD (if selected) ────────────────────────┐
└──────────────────────────────────────────────┘
```

---

## Data flow

1. User selects ticker, date range, indicators, params → clicks "Analisar"
2. Page calls `GET /api/market/analysis?ticker=...&start=...&end=...&indicators=...&<params>`
3. Backend: `market_cache.get_prices()` returns OHLCV (from Supabase if cached, else fetches yfinance + stores)
4. Backend: computes selected indicators with `pandas-ta`, generates signals
5. Backend returns `{ ticker, rows[], signals[] }`
6. `FixacoesChart` renders price chart + overlays + subplots + signal markers

---

## Files to create / modify

### New files
- `frontend/app/app/fixacoes/page.tsx`
- `frontend/components/market/TickerSelect.tsx`
- `frontend/components/market/IndicatorSelector.tsx`
- `frontend/components/market/FixacoesChart.tsx`

### Modified files
- `backend/main.py` — add `GET /api/market/analysis` endpoint
- `backend/requirements.txt` — add `pandas-ta`
- `frontend/app/app/layout.tsx` — add `{ href: "/app/fixacoes", label: "Mercado" }` to the "Fixações" nav section

### Unchanged
- `backend/market_cache.py` — no changes needed
- Supabase schema — no new tables

---

## Out of scope
- Email alerts (existed in old Streamlit page, not requested)
- Excel download
- Caching computed indicator results in DB (OHLCV cache is sufficient)
