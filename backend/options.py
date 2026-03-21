"""
options.py — Options pricing functions for Impacto API.

Design decision (OPT-03):
Risk-neutral drift (r - 0.5*sigma^2) is used instead of historical mu because
derivatives must be priced under the risk-neutral measure. Historical drift is
irrelevant to no-arbitrage pricing. Only the risk-free rate r and volatility
sigma enter the pricing formula — the market's actual expected return does not.
"""

import numpy as np
from scipy.stats import norm


def compute_payoff(legs: list[dict], price_range: list[float] | None = None) -> dict:
    """
    OPT-01: Compute combined payoff for a multi-leg options strategy.

    Args:
        legs: List of dicts with keys:
              type ("call" | "put"), strike (float), premium (float),
              position ("long" | "short"), quantity (int)
        price_range: Optional list of underlying prices at expiry.
                     If None, 200 evenly-spaced points from
                     0.5 * min_strike to 1.5 * max_strike are generated.

    Returns:
        dict with keys:
          prices: list of underlying prices
          payoff: list of combined P&L values (same length as prices)
    """
    if not legs:
        raise ValueError("legs must be a non-empty list")

    strikes = [leg["strike"] for leg in legs]

    if price_range is None:
        lo = 0.5 * min(strikes)
        hi = 1.5 * max(strikes)
        prices = np.linspace(lo, hi, 200)
    else:
        prices = np.asarray(price_range, dtype=float)

    total_payoff = np.zeros(len(prices))

    for leg in legs:
        leg_type = leg["type"].lower()
        strike = float(leg["strike"])
        premium = float(leg["premium"])
        position = leg["position"].lower()
        quantity = int(leg.get("quantity", 1))

        S = prices
        if leg_type == "call":
            intrinsic = np.maximum(S - strike, 0.0)
            if position == "long":
                pnl = intrinsic - premium
            else:  # short
                pnl = premium - intrinsic
        elif leg_type == "put":
            intrinsic = np.maximum(strike - S, 0.0)
            if position == "long":
                pnl = intrinsic - premium
            else:  # short
                pnl = premium - intrinsic
        else:
            raise ValueError(f"Unknown option type: {leg_type!r}. Must be 'call' or 'put'.")

        total_payoff += pnl * quantity

    return {
        "prices": prices.tolist(),
        "payoff": total_payoff.tolist(),
    }


def bs_call_price(S: float, K: float, T: float, r: float, sigma: float) -> float:
    """
    OPT-02: Black-Scholes European call price.

    Args:
        S:     Current underlying price
        K:     Strike price
        T:     Time to expiry in years
        r:     Risk-free rate (annualized, continuous compounding)
        sigma: Volatility (annualized)

    Returns:
        float: European call price

    Raises:
        ValueError: If any parameter is non-positive (S, K, T, sigma).
    """
    if S <= 0:
        raise ValueError(f"S must be positive, got {S}")
    if K <= 0:
        raise ValueError(f"K must be positive, got {K}")
    if T <= 0:
        raise ValueError(f"T must be positive, got {T}")
    if sigma <= 0:
        raise ValueError(f"sigma must be positive, got {sigma}")

    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)

    price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    return float(price)


def mc_call_price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    num_simulacoes: int = 10_000,
) -> float:
    """
    OPT-03: Risk-neutral MC European call pricer.

    Uses drift = r - 0.5*sigma^2 (risk-neutral measure), NOT historical mu.
    Steps = int(round(T * 252)) trading days.

    Args:
        S:             Current underlying price
        K:             Strike price
        T:             Time to expiry in years
        r:             Risk-free rate (annualized)
        sigma:         Volatility (annualized)
        num_simulacoes: Number of simulation paths

    Returns:
        float: Discounted expected payoff (European call price)
    """
    if S <= 0:
        raise ValueError(f"S must be positive, got {S}")
    if K <= 0:
        raise ValueError(f"K must be positive, got {K}")
    if T <= 0:
        raise ValueError(f"T must be positive, got {T}")
    if sigma <= 0:
        raise ValueError(f"sigma must be positive, got {sigma}")

    steps = max(1, int(round(T * 252)))
    dt = 1.0 / 252.0

    # Risk-neutral drift per step: (r - 0.5*sigma^2) * dt
    drift = (r - 0.5 * sigma ** 2) * dt
    vol_dt = sigma * np.sqrt(dt)

    rng = np.random.default_rng()
    shocks = rng.normal(loc=drift, scale=vol_dt, size=(steps, num_simulacoes))
    ST = S * np.cumprod(np.exp(shocks), axis=0)[-1]

    payoff = np.maximum(ST - K, 0.0)
    price = np.exp(-r * T) * float(np.mean(payoff))
    return price
