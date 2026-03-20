# Impacto — Quantitative Formula Audit & Fix

## What This Is

Impacto is a Streamlit web application for Monte Carlo price simulations and options pricing on Brazilian financial assets (sugar futures SB=F, USD/BRL exchange rate). This project milestone focuses on auditing and fixing the quantitative formulas across all simulation pages, then researching OSS/academic improvements.

## Core Value

Correct, trustworthy simulation outputs — users must be able to rely on the numbers to make hedging decisions.

## Requirements

### Validated

- ✓ Multi-page Streamlit app with login guard — existing
- ✓ yfinance data loading with caching — existing
- ✓ Monte Carlo fan chart (09_Monte_Carlo.py) — existing (broken)
- ✓ Black-Scholes pricer (13_Black_Scholes.py) — existing
- ✓ European call pricer via MC (23_Opções.py) — existing
- ✓ Options payoff diagram builder (08_Payoff_Opções.py) — existing
- ✓ Statistical pages: ARIMA, VaR, Volatility, Jump Diffusion — existing

### Active

- [ ] Fix Monte Carlo simulation so `preco_inicial` uses the user-provided value correctly
- [ ] Fix hardcoded price bounds (±10) to be asset-relative (e.g., ±N% of current price)
- [ ] Fix 23_Opções.py — decouple strike range from price clipping bounds
- [ ] Apply risk-neutral drift (risk-free rate) for options pricing MC, not historical mean
- [ ] Audit all other quant pages (ARIMA, VaR, Volatility, Jump Diffusion) for formula correctness
- [ ] Research OSS/academic benchmarks and document improvement opportunities

### Out of Scope

- Full rewrite of statistical model pages — audit and document only, fix critical bugs
- UI/UX redesign — not this milestone
- New pages or new features — formula quality only

## Context

- Assets: Sugar NY #11 futures (SB=F, ~18–20 cents/lb) and USD/BRL (~5.0)
- MC simulation uses 10,000 paths, vectorized with numpy cumprod
- Black-Scholes uses scipy.stats.norm.cdf — formula is mathematically correct
- Volatility is hardcoded (0.2573) in Black-Scholes page; ARIMA/VaR use yfinance historical data
- No existing test suite

## Constraints

- **Tech stack**: Python + Streamlit + numpy/scipy/pandas — no framework changes
- **No new dependencies without justification** — keep requirements.txt minimal
- **Language**: UI and variable names stay in Portuguese

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Audit-first, then fix | User wants to identify gaps before full implementation | — Pending |
| Risk-neutral drift for options MC | Financially correct for derivatives pricing | — Pending |
| Asset-relative bounds (% of price) | Fixed ±10 is meaningless across different asset scales | — Pending |

---
*Last updated: 2026-03-20 after initialization*
