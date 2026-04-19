# Fixações Market Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/app/fixacoes` page where users enter a ticker, pick technical indicators, and see an interactive price chart with overlays, oscillator subplots, and per-indicator buy/sell signal markers — all backed by Supabase-cached OHLCV data.

**Architecture:** New FastAPI endpoint `GET /api/market/analysis` fetches OHLCV via the existing `market_cache.get_prices()` cache-aside service, computes technical indicators with `pandas-ta`, generates per-indicator signals, and returns structured JSON. The Next.js page calls this endpoint and renders a Plotly chart with dynamic subplots.

**Tech Stack:** FastAPI + pandas-ta (backend), Next.js App Router + react-plotly.js + shadcn/ui (frontend), Supabase PostgreSQL (cache), yfinance (data source)

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `backend/analysis.py` | All indicator computation and signal generation logic |
| `frontend/app/app/fixacoes/page.tsx` | Page state, data fetching, layout |
| `frontend/components/market/TickerSelect.tsx` | Preset dropdown + free-text "Outro..." input |
| `frontend/components/market/IndicatorSelector.tsx` | Indicator checkboxes, MA period toggles, collapsible params |
| `frontend/components/market/FixacoesChart.tsx` | Plotly chart: price row + subplots + signal markers |

### Modified files
| File | Change |
|---|---|
| `backend/requirements.txt` | Add `pandas-ta` |
| `backend/main.py` | Add `GET /api/market/analysis` endpoint |
| `frontend/app/app/layout.tsx` | Add `/app/fixacoes` nav link under "Fixações" section |

---

## Task 1: Add pandas-ta to backend dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add pandas-ta to requirements.txt**

Open `backend/requirements.txt` and add one line after `numpy==2.2.1`:

```
pandas-ta==0.3.14b0
```

The full file should now look like:
```
fastapi==0.115.6
uvicorn[standard]==0.32.1
python-dotenv==1.0.1
pydantic==2.10.3
supabase==2.10.0
PyJWT==2.10.1
cryptography==44.0.0
yfinance==1.2.0
numpy==2.2.1
pandas-ta==0.3.14b0
scipy==1.15.0
python-bcb
statsmodels>=0.14.5
scikit-learn>=1.4.0
feedparser==6.0.11
slowapi>=0.1.9
xgboost>=2.0.0
```

- [ ] **Step 2: Install and verify**

```bash
cd backend
pip install pandas-ta==0.3.14b0
python -c "import pandas_ta as ta; print(ta.version)"
```

Expected output: `0.3.14b0` (or similar version string, no errors)

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat(fixacoes): add pandas-ta dependency"
```

---

## Task 2: Create analysis.py — indicator computation and signal generation

**Files:**
- Create: `backend/analysis.py`

- [ ] **Step 1: Create the file**

Create `backend/analysis.py` with this full content:

```python
"""
analysis.py — Technical indicator computation and signal generation.

All functions accept a pandas DataFrame with columns:
  date (index or column), open, high, low, close, volume

Returns the same DataFrame with additional computed columns,
plus a list of signal dicts: {date, type, indicator, price}
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal
import pandas as pd
import pandas_ta as ta


@dataclass
class IndicatorConfig:
    indicators: list[str] = field(default_factory=list)   # e.g. ["rsi", "bollinger", "macd", "stoch", "cci"]
    rsi_period: int = 14
    bb_window: int = 20
    bb_std: float = 2.0
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    stoch_k: int = 14
    stoch_d: int = 3
    cci_period: int = 20
    sma_periods: list[int] = field(default_factory=list)   # e.g. [20, 50, 200]
    ema_periods: list[int] = field(default_factory=list)   # e.g. [9, 21]


Signal = dict  # {date: str, type: "buy"|"sell", indicator: str, price: float}


def _crossover_up(series: pd.Series) -> pd.Series:
    """Returns True on the bar where series crosses from <= 0 to > 0."""
    return (series > 0) & (series.shift(1) <= 0)


def _crossover_down(series: pd.Series) -> pd.Series:
    """Returns True on the bar where series crosses from >= 0 to < 0."""
    return (series < 0) & (series.shift(1) >= 0)


def compute_analysis(df: pd.DataFrame, cfg: IndicatorConfig) -> tuple[pd.DataFrame, list[Signal]]:
    """
    Compute requested indicators and generate buy/sell signals.

    Args:
        df: DataFrame with columns [date, open, high, low, close, volume].
            'date' must be the index (datetime).
        cfg: IndicatorConfig with selected indicators and their parameters.

    Returns:
        (enriched_df, signals)
        enriched_df has all original columns plus computed indicator columns.
        signals is a list of dicts: {date, type, indicator, price}.
    """
    df = df.copy()
    signals: list[Signal] = []

    # ── Bollinger Bands ──────────────────────────────────────────────────────
    if "bollinger" in cfg.indicators:
        bbands = ta.bbands(df["close"], length=cfg.bb_window, std=cfg.bb_std)
        if bbands is not None and not bbands.empty:
            # pandas-ta returns columns like BBL_20_2.0, BBM_20_2.0, BBU_20_2.0
            col_lower = [c for c in bbands.columns if c.startswith("BBL_")][0]
            col_mid   = [c for c in bbands.columns if c.startswith("BBM_")][0]
            col_upper = [c for c in bbands.columns if c.startswith("BBU_")][0]
            df["bb_upper"] = bbands[col_upper]
            df["bb_mid"]   = bbands[col_mid]
            df["bb_lower"] = bbands[col_lower]

            # Buy: close crosses above lower band
            above_lower = df["close"] - df["bb_lower"]
            buy_mask = _crossover_up(above_lower)
            for dt, row in df[buy_mask].iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "bollinger", "price": float(row["close"])})

            # Sell: close crosses above upper band
            above_upper = df["close"] - df["bb_upper"]
            sell_mask = _crossover_up(above_upper)
            for dt, row in df[sell_mask].iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "bollinger", "price": float(row["close"])})

    # ── RSI ──────────────────────────────────────────────────────────────────
    if "rsi" in cfg.indicators:
        rsi = ta.rsi(df["close"], length=cfg.rsi_period)
        if rsi is not None:
            df["rsi"] = rsi

            # Buy: RSI crosses above 30
            buy_mask = _crossover_up(df["rsi"] - 30)
            for dt, row in df[buy_mask].dropna(subset=["rsi"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "rsi", "price": float(row["close"])})

            # Sell: RSI crosses below 70
            sell_mask = _crossover_down(df["rsi"] - 70)
            for dt, row in df[sell_mask].dropna(subset=["rsi"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "rsi", "price": float(row["close"])})

    # ── MACD ─────────────────────────────────────────────────────────────────
    if "macd" in cfg.indicators:
        macd_df = ta.macd(df["close"], fast=cfg.macd_fast, slow=cfg.macd_slow, signal=cfg.macd_signal)
        if macd_df is not None and not macd_df.empty:
            col_macd   = [c for c in macd_df.columns if c.startswith("MACD_")][0]
            col_signal = [c for c in macd_df.columns if c.startswith("MACDs_")][0]
            col_hist   = [c for c in macd_df.columns if c.startswith("MACDh_")][0]
            df["macd"]        = macd_df[col_macd]
            df["macd_signal"] = macd_df[col_signal]
            df["macd_hist"]   = macd_df[col_hist]

            # Buy: MACD crosses above signal line
            buy_mask = _crossover_up(df["macd"] - df["macd_signal"])
            for dt, row in df[buy_mask].dropna(subset=["macd"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "macd", "price": float(row["close"])})

            # Sell: MACD crosses below signal line
            sell_mask = _crossover_down(df["macd"] - df["macd_signal"])
            for dt, row in df[sell_mask].dropna(subset=["macd"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "macd", "price": float(row["close"])})

    # ── Stochastic Slow ──────────────────────────────────────────────────────
    if "stoch" in cfg.indicators:
        stoch_df = ta.stoch(df["high"], df["low"], df["close"], k=cfg.stoch_k, d=cfg.stoch_d)
        if stoch_df is not None and not stoch_df.empty:
            col_k = [c for c in stoch_df.columns if c.startswith("STOCHk_")][0]
            col_d = [c for c in stoch_df.columns if c.startswith("STOCHd_")][0]
            df["stoch_k"] = stoch_df[col_k]
            df["stoch_d"] = stoch_df[col_d]

            # Buy: %K crosses above 20
            buy_mask = _crossover_up(df["stoch_k"] - 20)
            for dt, row in df[buy_mask].dropna(subset=["stoch_k"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "stoch", "price": float(row["close"])})

            # Sell: %K crosses below 80
            sell_mask = _crossover_down(df["stoch_k"] - 80)
            for dt, row in df[sell_mask].dropna(subset=["stoch_k"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "stoch", "price": float(row["close"])})

    # ── CCI ──────────────────────────────────────────────────────────────────
    if "cci" in cfg.indicators:
        cci = ta.cci(df["high"], df["low"], df["close"], length=cfg.cci_period)
        if cci is not None:
            df["cci"] = cci

            # Buy: CCI crosses above -100
            buy_mask = _crossover_up(df["cci"] + 100)
            for dt, row in df[buy_mask].dropna(subset=["cci"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "cci", "price": float(row["close"])})

            # Sell: CCI crosses below +100
            sell_mask = _crossover_down(df["cci"] - 100)
            for dt, row in df[sell_mask].dropna(subset=["cci"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "cci", "price": float(row["close"])})

    # ── SMA ──────────────────────────────────────────────────────────────────
    sorted_sma = sorted(cfg.sma_periods)
    for period in sorted_sma:
        sma = ta.sma(df["close"], length=period)
        if sma is not None:
            df[f"sma_{period}"] = sma

    # SMA crossover signal: fastest two periods
    if len(sorted_sma) >= 2:
        fast_col = f"sma_{sorted_sma[0]}"
        slow_col = f"sma_{sorted_sma[1]}"
        if fast_col in df.columns and slow_col in df.columns:
            cross = df[fast_col] - df[slow_col]
            buy_mask = _crossover_up(cross)
            for dt, row in df[buy_mask].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "sma", "price": float(row["close"])})
            sell_mask = _crossover_down(cross)
            for dt, row in df[sell_mask].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "sma", "price": float(row["close"])})

    # ── EMA ──────────────────────────────────────────────────────────────────
    sorted_ema = sorted(cfg.ema_periods)
    for period in sorted_ema:
        ema = ta.ema(df["close"], length=period)
        if ema is not None:
            df[f"ema_{period}"] = ema

    # EMA crossover signal: fastest two periods
    if len(sorted_ema) >= 2:
        fast_col = f"ema_{sorted_ema[0]}"
        slow_col = f"ema_{sorted_ema[1]}"
        if fast_col in df.columns and slow_col in df.columns:
            cross = df[fast_col] - df[slow_col]
            buy_mask = _crossover_up(cross)
            for dt, row in df[buy_mask].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "ema", "price": float(row["close"])})
            sell_mask = _crossover_down(cross)
            for dt, row in df[sell_mask].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "ema", "price": float(row["close"])})

    return df, signals
```

- [ ] **Step 2: Verify import works**

```bash
cd backend
python -c "from analysis import compute_analysis, IndicatorConfig; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/analysis.py
git commit -m "feat(fixacoes): add analysis.py with pandas-ta indicators and signal generation"
```

---

## Task 3: Add GET /api/market/analysis endpoint to main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add the import at the top of main.py**

After the existing line:
```python
from market_cache import get_prices, backfill_ticker
```

Add:
```python
from analysis import compute_analysis, IndicatorConfig
```

- [ ] **Step 2: Add the endpoint**

Find the block for `GET /api/market/prices` (around line 319). Add the new endpoint **after** the closing of that function, before `GET /api/market/status`:

```python
@app.get("/api/market/analysis")
@limiter.limit("20/minute")
async def market_analysis(
    request: Request,
    ticker: str,
    start: date,
    end: date,
    user: Annotated[dict, Depends(get_current_user)],
    indicators: str = "",
    rsi_period: int = 14,
    bb_window: int = 20,
    bb_std: float = 2.0,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    stoch_k: int = 14,
    stoch_d: int = 3,
    cci_period: int = 20,
    sma_periods: str = "",
    ema_periods: str = "",
):
    """
    Return OHLCV + computed technical indicators + buy/sell signals.
    Data is fetched via market_cache (Supabase-backed, no duplicate yfinance calls).
    """
    ticker = validate_ticker(ticker)
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")

    # Parse comma-separated lists
    selected = [i.strip().lower() for i in indicators.split(",") if i.strip()]
    sma_list = [int(p.strip()) for p in sma_periods.split(",") if p.strip().isdigit()]
    ema_list = [int(p.strip()) for p in ema_periods.split(",") if p.strip().isdigit()]

    cfg = IndicatorConfig(
        indicators=selected,
        rsi_period=rsi_period,
        bb_window=bb_window,
        bb_std=bb_std,
        macd_fast=macd_fast,
        macd_slow=macd_slow,
        macd_signal=macd_signal,
        stoch_k=stoch_k,
        stoch_d=stoch_d,
        cci_period=cci_period,
        sma_periods=sma_list,
        ema_periods=ema_list,
    )

    # Fetch OHLCV from cache
    raw_rows = get_prices(ticker, start, end)
    if not raw_rows:
        return {"ticker": ticker, "rows": [], "signals": []}

    import pandas as pd
    df = pd.DataFrame(raw_rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    # Ensure numeric columns
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    enriched, signals = compute_analysis(df, cfg)

    # Build row list — replace NaN with None for JSON serialisation
    enriched = enriched.reset_index()
    enriched["date"] = enriched["date"].dt.strftime("%Y-%m-%d")
    rows = enriched.where(enriched.notna(), other=None).to_dict(orient="records")

    return {"ticker": ticker, "rows": rows, "signals": signals}
```

- [ ] **Step 3: Start the backend and test the endpoint manually**

```bash
cd backend
uvicorn main:app --reload --port 8000
```

In a second terminal:
```bash
curl -s "http://localhost:8000/api/market/analysis?ticker=SB%3DF&start=2024-01-01&end=2024-12-31&indicators=rsi,bollinger&sma_periods=20,50" \
  -H "Authorization: Bearer <your-token>" | python -m json.tool | head -60
```

Expected: JSON with `ticker`, `rows` (array of OHLCV + `rsi`, `bb_upper`, `bb_mid`, `bb_lower`, `sma_20`, `sma_50` columns), and `signals` (array of buy/sell dicts).

- [ ] **Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat(fixacoes): add GET /api/market/analysis endpoint"
```

---

## Task 4: Create TickerSelect component

**Files:**
- Create: `frontend/components/market/TickerSelect.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { value: "SB=F",      label: "SB=F — Açúcar NY #11 Futuro" },
  { value: "SBK26.NYB", label: "SBK26.NYB — Açúcar Maio 2026" },
  { value: "USDBRL=X",  label: "USDBRL=X — Dólar/Real" },
  { value: "CL=F",      label: "CL=F — Petróleo WTI" },
  { value: "__outro__", label: "Outro..." },
];

interface TickerSelectProps {
  value: string;
  onChange: (ticker: string) => void;
  disabled?: boolean;
}

export function TickerSelect({ value, onChange, disabled }: TickerSelectProps) {
  const isPreset = PRESETS.some((p) => p.value === value && p.value !== "__outro__");
  const [selectValue, setSelectValue] = useState(isPreset ? value : "__outro__");
  const [customTicker, setCustomTicker] = useState(isPreset ? "" : value);

  function handleSelectChange(v: string) {
    setSelectValue(v);
    if (v !== "__outro__") {
      onChange(v);
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase();
    setCustomTicker(v);
    onChange(v);
  }

  return (
    <div className="space-y-2">
      <Label>Ticker</Label>
      <Select value={selectValue} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Selecione um ativo" />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectValue === "__outro__" && (
        <Input
          value={customTicker}
          onChange={handleCustomChange}
          placeholder="Ex: PETR4.SA, AAPL, GC=F"
          className="w-64"
          disabled={disabled}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/market/TickerSelect.tsx
git commit -m "feat(fixacoes): add TickerSelect component"
```

---

## Task 5: Create IndicatorSelector component

**Files:**
- Create: `frontend/components/market/IndicatorSelector.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface IndicatorConfig {
  indicators: string[];   // "rsi" | "bollinger" | "macd" | "stoch" | "cci"
  rsiPeriod: number;
  bbWindow: number;
  bbStd: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  stochK: number;
  stochD: number;
  cciPeriod: number;
  smaPeriods: number[];
  emaPeriods: number[];
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  indicators: ["bollinger", "rsi"],
  rsiPeriod: 14,
  bbWindow: 20,
  bbStd: 2.0,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  stochK: 14,
  stochD: 3,
  cciPeriod: 20,
  smaPeriods: [20, 50],
  emaPeriods: [],
};

const OSCILLATORS: { key: string; label: string }[] = [
  { key: "bollinger", label: "Bollinger Bands" },
  { key: "rsi",       label: "RSI" },
  { key: "macd",      label: "MACD" },
  { key: "stoch",     label: "Estocástico Lento" },
  { key: "cci",       label: "CCI" },
];

const SMA_OPTIONS = [20, 50, 200];
const EMA_OPTIONS = [9, 21];

interface Props {
  config: IndicatorConfig;
  onChange: (config: IndicatorConfig) => void;
  disabled?: boolean;
}

export function IndicatorSelector({ config, onChange, disabled }: Props) {
  const [paramsOpen, setParamsOpen] = useState(false);

  function toggleIndicator(key: string) {
    const next = config.indicators.includes(key)
      ? config.indicators.filter((k) => k !== key)
      : [...config.indicators, key];
    onChange({ ...config, indicators: next });
  }

  function toggleSma(period: number) {
    const next = config.smaPeriods.includes(period)
      ? config.smaPeriods.filter((p) => p !== period)
      : [...config.smaPeriods, period].sort((a, b) => a - b);
    onChange({ ...config, smaPeriods: next });
  }

  function toggleEma(period: number) {
    const next = config.emaPeriods.includes(period)
      ? config.emaPeriods.filter((p) => p !== period)
      : [...config.emaPeriods, period].sort((a, b) => a - b);
    onChange({ ...config, emaPeriods: next });
  }

  function setParam(key: keyof IndicatorConfig, value: number) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="space-y-3">
      {/* Oscillator checkboxes */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Indicadores</Label>
        <div className="flex flex-wrap gap-2">
          {OSCILLATORS.map(({ key, label }) => {
            const active = config.indicators.includes(key);
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => toggleIndicator(key)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* MA toggles */}
      <div className="flex flex-wrap gap-6">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">SMA</Label>
          <div className="flex gap-1">
            {SMA_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => toggleSma(p)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  config.smaPeriods.includes(p)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">EMA</Label>
          <div className="flex gap-1">
            {EMA_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => toggleEma(p)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  config.emaPeriods.includes(p)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Collapsible params */}
      <div>
        <button
          type="button"
          onClick={() => setParamsOpen(!paramsOpen)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <span>{paramsOpen ? "▲" : "▼"}</span> Parâmetros
        </button>

        {paramsOpen && (
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {config.indicators.includes("rsi") && (
              <div className="flex items-center gap-2">
                <Label className="w-28 text-xs">RSI — Período</Label>
                <Input
                  type="number"
                  value={config.rsiPeriod}
                  min={2}
                  max={100}
                  onChange={(e) => setParam("rsiPeriod", +e.target.value)}
                  className="w-20 h-7 text-xs"
                  disabled={disabled}
                />
              </div>
            )}
            {config.indicators.includes("bollinger") && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">BB — Janela</Label>
                  <Input
                    type="number"
                    value={config.bbWindow}
                    min={2}
                    max={200}
                    onChange={(e) => setParam("bbWindow", +e.target.value)}
                    className="w-20 h-7 text-xs"
                    disabled={disabled}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">BB — Desvios</Label>
                  <Input
                    type="number"
                    value={config.bbStd}
                    min={0.5}
                    max={5}
                    step={0.5}
                    onChange={(e) => setParam("bbStd", +e.target.value)}
                    className="w-20 h-7 text-xs"
                    disabled={disabled}
                  />
                </div>
              </>
            )}
            {config.indicators.includes("macd") && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">MACD — Rápido</Label>
                  <Input type="number" value={config.macdFast} min={2} max={100} onChange={(e) => setParam("macdFast", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">MACD — Lento</Label>
                  <Input type="number" value={config.macdSlow} min={2} max={200} onChange={(e) => setParam("macdSlow", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">MACD — Sinal</Label>
                  <Input type="number" value={config.macdSignal} min={2} max={50} onChange={(e) => setParam("macdSignal", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
              </>
            )}
            {config.indicators.includes("stoch") && (
              <>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">Estoc. — %K</Label>
                  <Input type="number" value={config.stochK} min={1} max={100} onChange={(e) => setParam("stochK", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="w-28 text-xs">Estoc. — %D</Label>
                  <Input type="number" value={config.stochD} min={1} max={20} onChange={(e) => setParam("stochD", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
                </div>
              </>
            )}
            {config.indicators.includes("cci") && (
              <div className="flex items-center gap-2">
                <Label className="w-28 text-xs">CCI — Período</Label>
                <Input type="number" value={config.cciPeriod} min={2} max={100} onChange={(e) => setParam("cciPeriod", +e.target.value)} className="w-20 h-7 text-xs" disabled={disabled} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/market/IndicatorSelector.tsx
git commit -m "feat(fixacoes): add IndicatorSelector component"
```

---

## Task 6: Create FixacoesChart component

**Files:**
- Create: `frontend/components/market/FixacoesChart.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// react-plotly.js requires dynamic import (no SSR) because Plotly uses window
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export interface OhlcvRow {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  // indicator columns (optional, present when selected)
  bb_upper?: number | null;
  bb_mid?: number | null;
  bb_lower?: number | null;
  rsi?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  stoch_k?: number | null;
  stoch_d?: number | null;
  cci?: number | null;
  [key: string]: number | string | null | undefined; // sma_20, ema_9, etc.
}

export interface AnalysisSignal {
  date: string;
  type: "buy" | "sell";
  indicator: string;
  price: number;
}

interface Props {
  rows: OhlcvRow[];
  signals: AnalysisSignal[];
  selectedIndicators: string[];
  smaPeriods: number[];
  emaPeriods: number[];
  chartType: "candlestick" | "line";
}

const INDICATOR_COLORS: Record<string, string> = {
  bollinger: "#f59e0b",
  rsi: "#8b5cf6",
  macd: "#3b82f6",
  stoch: "#10b981",
  cci: "#f43f5e",
  sma: "#6b7280",
  ema: "#0ea5e9",
};

const SMA_COLORS = ["#94a3b8", "#64748b", "#475569"];
const EMA_COLORS = ["#38bdf8", "#0ea5e9"];

export function FixacoesChart({ rows, signals, selectedIndicators, smaPeriods, emaPeriods, chartType }: Props) {
  const oscillators = selectedIndicators.filter((i) => ["rsi", "macd", "stoch", "cci"].includes(i));
  const totalRows = 1 + oscillators.length;

  const dates = rows.map((r) => r.date);

  // Row heights: price row gets more space
  const rowHeights = totalRows === 1
    ? [1]
    : [0.55, ...Array(oscillators.length).fill((0.45 / oscillators.length))];

  const traces: Plotly.Data[] = useMemo(() => {
    const t: Plotly.Data[] = [];

    // ── Price trace (row 1) ──────────────────────────────────────────────
    if (chartType === "candlestick") {
      t.push({
        type: "candlestick",
        x: dates,
        open: rows.map((r) => r.open),
        high: rows.map((r) => r.high),
        low: rows.map((r) => r.low),
        close: rows.map((r) => r.close),
        name: "Preço",
        row: 1,
        xaxis: "x",
        yaxis: "y",
        increasing: { line: { color: "#22c55e" } },
        decreasing: { line: { color: "#ef4444" } },
      } as Plotly.Data);
    } else {
      t.push({
        type: "scatter",
        mode: "lines",
        x: dates,
        y: rows.map((r) => r.close),
        name: "Preço",
        line: { color: "#3b82f6", width: 1.5 },
        xaxis: "x",
        yaxis: "y",
      } as Plotly.Data);
    }

    // ── Bollinger Bands (overlays on price row) ─────────────────────────
    if (selectedIndicators.includes("bollinger")) {
      const bbColor = INDICATOR_COLORS.bollinger;
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r.bb_upper),
        name: "BB Superior", line: { color: bbColor, width: 1, dash: "dot" },
        xaxis: "x", yaxis: "y",
      } as Plotly.Data);
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r.bb_mid),
        name: "BB Média", line: { color: bbColor, width: 1 },
        xaxis: "x", yaxis: "y",
      } as Plotly.Data);
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r.bb_lower),
        name: "BB Inferior", line: { color: bbColor, width: 1, dash: "dot" },
        fill: "tonexty", fillcolor: `${bbColor}15`,
        xaxis: "x", yaxis: "y",
      } as Plotly.Data);
    }

    // ── SMAs ─────────────────────────────────────────────────────────────
    smaPeriods.forEach((period, i) => {
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r[`sma_${period}`]),
        name: `SMA ${period}`, line: { color: SMA_COLORS[i % SMA_COLORS.length], width: 1.2 },
        xaxis: "x", yaxis: "y",
      } as Plotly.Data);
    });

    // ── EMAs ─────────────────────────────────────────────────────────────
    emaPeriods.forEach((period, i) => {
      t.push({
        type: "scatter", mode: "lines", x: dates,
        y: rows.map((r) => r[`ema_${period}`]),
        name: `EMA ${period}`, line: { color: EMA_COLORS[i % EMA_COLORS.length], width: 1.2 },
        xaxis: "x", yaxis: "y",
      } as Plotly.Data);
    });

    // ── Buy/Sell signal markers (on price row) ───────────────────────────
    const buySignals = signals.filter((s) => s.type === "buy");
    const sellSignals = signals.filter((s) => s.type === "sell");

    if (buySignals.length > 0) {
      t.push({
        type: "scatter", mode: "markers",
        x: buySignals.map((s) => s.date),
        y: buySignals.map((s) => s.price),
        name: "Compra",
        marker: { symbol: "triangle-up", size: 10, color: "#22c55e" },
        customdata: buySignals.map((s) => s.indicator),
        hovertemplate: "Compra (%{customdata})<br>%{x}<br>%{y:.4f}<extra></extra>",
        xaxis: "x", yaxis: "y",
      } as Plotly.Data);
    }

    if (sellSignals.length > 0) {
      t.push({
        type: "scatter", mode: "markers",
        x: sellSignals.map((s) => s.date),
        y: sellSignals.map((s) => s.price),
        name: "Venda",
        marker: { symbol: "triangle-down", size: 10, color: "#ef4444" },
        customdata: sellSignals.map((s) => s.indicator),
        hovertemplate: "Venda (%{customdata})<br>%{x}<br>%{y:.4f}<extra></extra>",
        xaxis: "x", yaxis: "y",
      } as Plotly.Data);
    }

    // ── Oscillator subplots ───────────────────────────────────────────────
    oscillators.forEach((ind, i) => {
      const row = i + 2;
      const xaxis = `x${row > 1 ? row : ""}` as const;
      const yaxis = `y${row > 1 ? row : ""}` as const;

      if (ind === "rsi") {
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.rsi),
          name: "RSI", line: { color: INDICATOR_COLORS.rsi, width: 1.5 },
          xaxis, yaxis,
        } as Plotly.Data);
        // Reference lines via shapes (added in layout)
      }

      if (ind === "macd") {
        t.push({
          type: "bar", x: dates,
          y: rows.map((r) => r.macd_hist),
          name: "MACD Histograma",
          marker: { color: rows.map((r) => (r.macd_hist ?? 0) >= 0 ? "#22c55e" : "#ef4444") },
          xaxis, yaxis,
        } as Plotly.Data);
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.macd),
          name: "MACD", line: { color: INDICATOR_COLORS.macd, width: 1.5 },
          xaxis, yaxis,
        } as Plotly.Data);
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.macd_signal),
          name: "Sinal MACD", line: { color: "#f59e0b", width: 1.5 },
          xaxis, yaxis,
        } as Plotly.Data);
      }

      if (ind === "stoch") {
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.stoch_k),
          name: "%K", line: { color: INDICATOR_COLORS.stoch, width: 1.5 },
          xaxis, yaxis,
        } as Plotly.Data);
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.stoch_d),
          name: "%D", line: { color: "#34d399", width: 1.5, dash: "dot" },
          xaxis, yaxis,
        } as Plotly.Data);
      }

      if (ind === "cci") {
        t.push({
          type: "scatter", mode: "lines", x: dates,
          y: rows.map((r) => r.cci),
          name: "CCI", line: { color: INDICATOR_COLORS.cci, width: 1.5 },
          xaxis, yaxis,
        } as Plotly.Data);
      }
    });

    return t;
  }, [rows, signals, selectedIndicators, smaPeriods, emaPeriods, chartType, dates, oscillators]);

  // Build reference line shapes for oscillator panels
  const shapes: Partial<Plotly.Shape>[] = useMemo(() => {
    const s: Partial<Plotly.Shape>[] = [];
    oscillators.forEach((ind, i) => {
      const row = i + 2;
      const yref = `y${row}` as const;
      const lineStyle = { type: "line" as const, xref: "paper" as const, yref, x0: 0, x1: 1, line: { dash: "dot" as const, width: 1, color: "#6b7280" } };
      if (ind === "rsi") {
        s.push({ ...lineStyle, y0: 70, y1: 70 });
        s.push({ ...lineStyle, y0: 30, y1: 30 });
      }
      if (ind === "stoch") {
        s.push({ ...lineStyle, y0: 80, y1: 80 });
        s.push({ ...lineStyle, y0: 20, y1: 20 });
      }
      if (ind === "cci") {
        s.push({ ...lineStyle, y0: 100, y1: 100 });
        s.push({ ...lineStyle, y0: -100, y1: -100 });
      }
    });
    return s;
  }, [oscillators]);

  const layout: Partial<Plotly.Layout> = useMemo(() => {
    const grid: Partial<Plotly.Layout["grid"]> = {
      rows: totalRows,
      columns: 1,
      pattern: "independent",
      roworder: "top to bottom",
    };

    const yaxes: Record<string, Partial<Plotly.LayoutAxis>> = {};
    oscillators.forEach((ind, i) => {
      const key = `yaxis${i + 2}`;
      yaxes[key] = {
        title: { text: ind.toUpperCase() },
        showgrid: true,
        gridcolor: "#e5e7eb",
        fixedrange: false,
      };
    });

    return {
      grid,
      height: 300 + oscillators.length * 200,
      margin: { t: 20, b: 40, l: 60, r: 20 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      font: { color: "#374151", size: 11 },
      xaxis: { showgrid: true, gridcolor: "#e5e7eb", rangeslider: { visible: false } },
      yaxis: { showgrid: true, gridcolor: "#e5e7eb", fixedrange: false },
      ...Object.fromEntries(
        oscillators.map((_, i) => [
          `xaxis${i + 2}`,
          { showgrid: true, gridcolor: "#e5e7eb", matches: "x", showticklabels: i === oscillators.length - 1 },
        ])
      ),
      ...yaxes,
      showlegend: true,
      legend: { orientation: "h", y: -0.05 },
      shapes,
    };
  }, [totalRows, oscillators, shapes]);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dado para exibir.</p>;
  }

  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ displayModeBar: true, responsive: true, scrollZoom: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/market/FixacoesChart.tsx
git commit -m "feat(fixacoes): add FixacoesChart component with Plotly subplots"
```

---

## Task 7: Create the Fixações page

**Files:**
- Create: `frontend/app/app/fixacoes/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { createBrowserClient } from "@supabase/ssr";
import { TickerSelect } from "@/components/market/TickerSelect";
import { IndicatorSelector, DEFAULT_CONFIG, type IndicatorConfig } from "@/components/market/IndicatorSelector";
import { FixacoesChart, type OhlcvRow, type AnalysisSignal } from "@/components/market/FixacoesChart";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function FixacoesPage() {
  const { start: defaultStart, end: defaultEnd } = defaultDateRange();

  const [ticker, setTicker] = useState("SB=F");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [config, setConfig] = useState<IndicatorConfig>(DEFAULT_CONFIG);
  const [chartType, setChartType] = useState<"candlestick" | "line">("candlestick");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<OhlcvRow[]>([]);
  const [signals, setSignals] = useState<AnalysisSignal[]>([]);
  const [queriedTicker, setQueriedTicker] = useState("");

  async function getToken(): Promise<string | null> {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  const handleAnalyze = useCallback(async () => {
    if (!ticker.trim()) {
      toast.error("Informe o ticker.");
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const params = new URLSearchParams({
        ticker: ticker.trim().toUpperCase(),
        start,
        end,
        indicators: config.indicators.join(","),
        rsi_period: String(config.rsiPeriod),
        bb_window: String(config.bbWindow),
        bb_std: String(config.bbStd),
        macd_fast: String(config.macdFast),
        macd_slow: String(config.macdSlow),
        macd_signal: String(config.macdSignal),
        stoch_k: String(config.stochK),
        stoch_d: String(config.stochD),
        cci_period: String(config.cciPeriod),
        sma_periods: config.smaPeriods.join(","),
        ema_periods: config.emaPeriods.join(","),
      });

      const res = await fetch(`${BACKEND_URL}/api/market/analysis?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "Erro ao consultar análise.");
        return;
      }
      if (data.rows.length === 0) {
        toast.warning(`Nenhum dado encontrado para ${ticker.toUpperCase()} no período.`);
      }
      setRows(data.rows);
      setSignals(data.signals);
      setQueriedTicker(data.ticker);
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, [ticker, start, end, config]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Fixações</h1>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Ticker + dates + button */}
          <div className="flex flex-wrap gap-4 items-end">
            <TickerSelect value={ticker} onChange={setTicker} disabled={loading} />

            <div className="space-y-1">
              <Label>Início</Label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                disabled={loading}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <Label>Fim</Label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                disabled={loading}
                className="w-40"
              />
            </div>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analisando..." : "Analisar"}
            </Button>
          </div>

          {/* Row 2: Indicators */}
          <IndicatorSelector config={config} onChange={setConfig} disabled={loading} />

          {/* Row 3: Chart type toggle */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Gráfico:</Label>
            {(["candlestick", "line"] as const).map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => setChartType(ct)}
                className={`px-3 py-1 rounded text-sm border transition-colors ${
                  chartType === ct
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:border-primary"
                }`}
              >
                {ct === "candlestick" ? "Candlestick" : "Linha"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {queriedTicker && (
        <Card>
          <CardHeader>
            <CardTitle>
              {queriedTicker} — {start} a {end}
              {signals.length > 0 && (
                <span className="ml-3 text-sm font-normal text-muted-foreground">
                  {signals.filter((s) => s.type === "buy").length} entradas ·{" "}
                  {signals.filter((s) => s.type === "sell").length} saídas
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FixacoesChart
              rows={rows}
              signals={signals}
              selectedIndicators={config.indicators}
              smaPeriods={config.smaPeriods}
              emaPeriods={config.emaPeriods}
              chartType={chartType}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/app/fixacoes/page.tsx
git commit -m "feat(fixacoes): add Fixações page"
```

---

## Task 8: Add nav link and verify end-to-end

**Files:**
- Modify: `frontend/app/app/layout.tsx`

- [ ] **Step 1: Add the nav link**

In `frontend/app/app/layout.tsx`, find the "Fixações" nav section:

```tsx
{
  label: "Fixações",
  items: [
    { href: "/app/simulation", label: "Monte Carlo" },
```

Add the Mercado link as the first item:

```tsx
{
  label: "Fixações",
  items: [
    { href: "/app/fixacoes", label: "Mercado" },
    { href: "/app/simulation", label: "Monte Carlo" },
```

- [ ] **Step 2: Start frontend and verify the page loads**

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000/app/fixacoes` in the browser.

Expected: Page renders with ticker select, date range inputs, indicator pills, chart type toggle, and "Analisar" button. No console errors.

- [ ] **Step 3: Test the golden path**

1. Leave default ticker `SB=F`, date range last 1 year, indicators `Bollinger + RSI`
2. Click "Analisar"
3. Expected: chart appears with candlestick price row + Bollinger bands overlay + RSI subplot + green/red triangles on price row
4. Switch to "Linha" — chart type changes, overlays and signals remain
5. Toggle MACD on in IndicatorSelector — a third subplot appears after clicking Analisar again
6. Check legend — can toggle individual traces on/off

- [ ] **Step 4: Test with custom ticker**

1. Select "Outro..." in the ticker dropdown
2. Type `PETR4.SA`
3. Click "Analisar"
4. Expected: chart renders for PETR4.SA (Brazilian stock)

- [ ] **Step 5: Commit**

```bash
git add frontend/app/app/layout.tsx
git commit -m "feat(fixacoes): add Mercado nav link and complete Fixações feature"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** ticker select (Task 4) ✓, DB cache (Task 3 uses `market_cache`) ✓, no duplicate yfinance fetch ✓, technical indicators (Task 2) ✓, configurable params (Task 5) ✓, candlestick/line toggle (Task 7) ✓, buy/sell triangles (Task 6) ✓, price chart + subplots (Task 6) ✓, nav link (Task 8) ✓
- [x] **No placeholders:** all steps have concrete code
- [x] **Type consistency:** `IndicatorConfig` defined in Task 5 and imported in Tasks 6 and 7. `OhlcvRow` and `AnalysisSignal` defined in Task 6 and imported in Task 7. `compute_analysis` and `IndicatorConfig` defined in Task 2, imported in Task 3.
- [x] **pandas-ta column naming:** BBL/BBM/BBU prefixes, MACDs/MACDh prefixes, STOCHk/STOCHd prefixes — all handled with dynamic column discovery in `analysis.py`
