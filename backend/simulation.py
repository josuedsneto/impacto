"""
simulation.py — Monte Carlo price simulation engine.

Design decisions (from STATE.md):
- PCT_BOUND=0.50: bounds are ±50% of preco_inicial to avoid truncating GBM cone
- Returns are drawn from a normal distribution parameterized by historical daily mean and std
- Prices clipped to [lower_bound, upper_bound] each step
- Vectorized with np.cumprod, num_simulacoes paths (default 10_000)
- percentiles_series JSONB: dict keyed "p5"/"p20"/"p25"/"p50"/"p75"/"p80"/"p95",
  each value is a list of floats (one per simulated day, length = dias_simulados)
"""

import numpy as np
from market_cache import get_prices
from datetime import date, timedelta


def run_simulation(
    ticker: str,
    preco_inicial: float,
    dias_simulados: int = 252,
    num_simulacoes: int = 10_000,
    pct_bound: float = 0.50,
) -> dict:
    """
    Run Monte Carlo simulation and return scalar metrics + percentile series.

    Returns dict with keys:
      p5, p20, p25, p50, p75, p80, p95  — final-day scalar percentiles (float)
      percentiles_series                 — JSONB-serializable dict of daily series
      ticker, preco_inicial, dias_simulados, num_simulacoes, pct_bound
    """
    # --- Fetch historical returns for parameter estimation ---
    end_date = date.today()
    start_date = end_date - timedelta(days=3 * 365)  # ~3 years of history
    rows = get_prices(ticker, start_date, end_date)

    if len(rows) < 20:
        raise ValueError(
            f"Not enough historical data for '{ticker}' "
            f"(got {len(rows)} rows, need at least 20)."
        )

    closes = np.array([r["close"] for r in rows], dtype=float)
    log_returns = np.diff(np.log(closes))
    mu = float(np.mean(log_returns))
    sigma = float(np.std(log_returns, ddof=1))

    # --- Simulation bounds ---
    lower_bound = preco_inicial * (1 - pct_bound)
    upper_bound = preco_inicial * (1 + pct_bound)

    # --- Vectorized GBM paths (dias_simulados × num_simulacoes) ---
    rng = np.random.default_rng()
    shocks = rng.normal(loc=mu, scale=sigma, size=(dias_simulados, num_simulacoes))
    # Convert log-return shocks to multiplicative factors, then cumprod
    factors = np.exp(shocks)
    paths = preco_inicial * np.cumprod(factors, axis=0)
    paths = np.clip(paths, lower_bound, upper_bound)

    # --- Percentile series (daily, across simulations) ---
    pct_labels = [5, 20, 25, 50, 75, 80, 95]
    series = {
        f"p{p}": np.percentile(paths, p, axis=1).tolist()
        for p in pct_labels
    }

    # --- Scalar metrics at final day ---
    final = paths[-1, :]

    return {
        "ticker": ticker,
        "preco_inicial": preco_inicial,
        "dias_simulados": dias_simulados,
        "num_simulacoes": num_simulacoes,
        "pct_bound": pct_bound,
        "p5": float(np.percentile(final, 5)),
        "p20": float(np.percentile(final, 20)),
        "p25": float(np.percentile(final, 25)),
        "p50": float(np.percentile(final, 50)),
        "p75": float(np.percentile(final, 75)),
        "p80": float(np.percentile(final, 80)),
        "p95": float(np.percentile(final, 95)),
        "percentiles_series": series,
    }
