"""Smoke checks for the pricing/simulation math. Run: python test_calcs.py"""
import sys
import types

import numpy as np

# Stub market_cache so simulation.py imports without Supabase/yfinance.
_fake = types.ModuleType("market_cache")
_closes = 20 * np.exp(np.cumsum(np.random.default_rng(0).normal(0, 0.02, 500)))
_fake.get_prices = lambda *a: [{"close": c} for c in _closes]
sys.modules["market_cache"] = _fake

from options import bs_call_price, mc_call_price  # noqa: E402
from simulation import run_simulation  # noqa: E402

# MC call converges to Black-Scholes.
bs = bs_call_price(S=20, K=21, T=1, r=0.1, sigma=0.3)
mc = mc_call_price(S=20, K=21, T=1, r=0.1, sigma=0.3, num_simulacoes=400_000)
assert abs(mc - bs) / bs < 0.02, (mc, bs)

# Long-dated, many paths must not blow memory (used to allocate steps × sims).
mc_call_price(S=20, K=21, T=30, r=0.1, sigma=0.3, num_simulacoes=100_000)

# Custom volatility is annual: 25% a.a. over 252 days → P5..P95 spread ≈ ±41%, not clipped to the bounds.
r = run_simulation("SB=F", 20.0, dias_simulados=252, num_simulacoes=20_000, pct_bound=2.0, volatilidade_custom=0.25)
spread = np.log(r["p95"] / r["p5"]) / (2 * 1.645)
assert abs(spread - 0.25) < 0.02, spread
assert len(r["percentiles_series"]["p50"]) == 252

print("ok")
