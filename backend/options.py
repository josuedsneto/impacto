"""
options.py — Options pricing functions for Impacto API.

Opções de açúcar são sobre o futuro (SB=F, ICE), então o preço é Black-76:
usa o preço do futuro F e desconta o preço inteiro por e^{-rT}. Não há carrego
no futuro, por isso o Monte Carlo tem drift zero em F.

gk_price (Garman-Kohlhagen) fica pronta para opções de câmbio (hedge futuro).
"""

import numpy as np
from scipy.stats import norm

_NOMES_POSITIVOS = {
    "F": "O preço do futuro",
    "S": "O preço do ativo",
    "K": "O strike",
    "T": "O prazo até o vencimento",
    "sigma": "A volatilidade",
}


def _validar_positivos(**valores: float) -> None:
    for nome, valor in valores.items():
        if valor <= 0:
            raise ValueError(f"{_NOMES_POSITIVOS[nome]} precisa ser maior que zero (recebido: {valor}).")


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
        raise ValueError("Adicione ao menos uma perna à estratégia.")

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

        if position not in ("long", "short"):
            raise ValueError(f"Posição inválida: {position!r}. Use 'long' ou 'short'.")

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
            raise ValueError(f"Tipo de opção inválido: {leg_type!r}. Use 'call' ou 'put'.")

        total_payoff += pnl * quantity

    return {
        "prices": prices.tolist(),
        "payoff": total_payoff.tolist(),
    }


def black76_price(F: float, K: float, T: float, r: float, sigma: float, tipo: str = "call") -> float:
    """
    OPT-02: Black-76 European option on a futures price.

    Args:
        F:     Futures price (forward) today
        K:     Strike price
        T:     Time to expiry in years
        r:     Risk-free rate (annualized, continuous compounding)
        sigma: Volatility of the futures price (annualized)
        tipo:  "call" | "put"

    Returns:
        float: Option price, discounted by e^{-rT}

    Raises:
        ValueError: If F, K, T or sigma is non-positive, or tipo is unknown.
    """
    _validar_positivos(F=F, K=K, T=T, sigma=sigma)
    if tipo not in ("call", "put"):
        raise ValueError(f"Tipo de opção inválido: {tipo!r}. Use 'call' ou 'put'.")

    sq = sigma * np.sqrt(T)
    d1 = (np.log(F / K) + 0.5 * sigma ** 2 * T) / sq
    d2 = d1 - sq
    df = np.exp(-r * T)

    if tipo == "call":
        price = df * (F * norm.cdf(d1) - K * norm.cdf(d2))
    else:
        price = df * (K * norm.cdf(-d2) - F * norm.cdf(-d1))
    return float(price)


def mc_black76_price(
    F: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    num_simulacoes: int = 10_000,
    seed: int | None = None,
) -> float:
    """
    OPT-03: Monte Carlo European call on a futures price (Black-76 model).

    No futuro o drift é zero: F_T = F * exp(-sigma^2 T / 2 + sigma sqrt(T) Z).
    Amostra F_T direto da distribuição terminal exata do GBM.

    Args:
        seed: Semente opcional; mesma semente, mesmo resultado.

    Returns:
        float: Discounted expected payoff (European call price)
    """
    _validar_positivos(F=F, K=K, T=T, sigma=sigma)

    rng = np.random.default_rng(seed)
    z = rng.standard_normal(num_simulacoes)
    FT = F * np.exp(-0.5 * sigma ** 2 * T + sigma * np.sqrt(T) * z)

    payoff = np.maximum(FT - K, 0.0)
    return float(np.exp(-r * T) * np.mean(payoff))


def gk_price(
    S: float,
    K: float,
    T: float,
    r_dom: float,
    r_for: float,
    sigma: float,
    tipo: str = "call",
) -> float:
    """
    OPT-04: Garman-Kohlhagen price for a European FX option.

    Args:
        S:     Spot FX rate (domestic per unit of foreign currency)
        r_dom: Domestic risk-free rate (annualized, continuous)
        r_for: Foreign risk-free rate (annualized, continuous)
        sigma: Volatility of the FX rate (annualized)

    Raises:
        ValueError: If S, K, T or sigma is non-positive, or tipo is unknown.
    """
    _validar_positivos(S=S, K=K, T=T, sigma=sigma)
    if tipo not in ("call", "put"):
        raise ValueError(f"Tipo de opção inválido: {tipo!r}. Use 'call' ou 'put'.")

    sq = sigma * np.sqrt(T)
    d1 = (np.log(S / K) + (r_dom - r_for + 0.5 * sigma ** 2) * T) / sq
    d2 = d1 - sq
    df_for = np.exp(-r_for * T)
    df_dom = np.exp(-r_dom * T)

    if tipo == "call":
        price = S * df_for * norm.cdf(d1) - K * df_dom * norm.cdf(d2)
    else:
        price = K * df_dom * norm.cdf(-d2) - S * df_for * norm.cdf(-d1)
    return float(price)
