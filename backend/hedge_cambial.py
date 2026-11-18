"""
hedge_cambial.py — compara estratégias de hedge do USD/BRL sobre os mesmos caminhos.

Funções puras (sem I/O). Spec: .specs/features/hedge-cambial.

Convenções:
- ST: câmbio no vencimento (R$ por US$), um valor por caminho.
- Taxas do GK: r_dom = ln(1+Selic), r_for tal que o forward GK é igual ao F da paridade coberta.
- Prêmio pago hoje vale prêmio·(1+Selic)^T no vencimento (capitalizado).
- Receita (R$) = V · taxa líquida, com taxa líquida = payoff por US$ − prêmio capitalizado.
"""

from __future__ import annotations

import math

import numpy as np

from options import gk_price

ESTRATEGIAS = ("aberto", "forward_total", "forward_parcial", "put", "collar")
NOMES = {
    "aberto": "Ficar aberto",
    "forward_total": "Travar 100% no forward",
    "forward_parcial": "Travar parte no forward",
    "put": "Comprar put de dólar",
    "collar": "Collar (put comprada e call vendida)",
}


def taxas_gk(F: float, S0: float, selic_aa: float, T: float) -> tuple[float, float]:
    """r_dom e r_for contínuos. r_for é escolhido para que S0·exp((r_dom − r_for)·T) = F."""
    r_dom = math.log(1 + selic_aa)
    r_for = r_dom - math.log(F / S0) / T
    return r_dom, r_for


def premio(S0: float, K: float, T: float, r_dom: float, r_for: float, sigma: float, tipo: str) -> float:
    """Prêmio por US$ (R$ por US$), hoje. Com sigma = 0, o valor intrínseco descontado (wrapper; gk_price exige sigma > 0)."""
    if sigma > 0:
        return float(gk_price(S0, K, T, r_dom, r_for, sigma, tipo))
    F = S0 * math.exp((r_dom - r_for) * T)
    df = math.exp(-r_dom * T)
    intrinseco = max(K - F, 0.0) if tipo == "put" else max(F - K, 0.0)
    return df * intrinseco


def simular_estrategias(
    ST: np.ndarray,
    V: float,
    S0: float,
    F: float,
    selic_aa: float,
    T: float,
    sigma: float,
    orcamento: float,
    x: float,
    K_put: float,
    K1: float,
    K2: float,
) -> dict:
    """
    Receita em R$ e métricas das cinco estratégias sobre os caminhos ST.

    x: fração do volume travada no forward (0 a 1). K_put: strike da put.
    K1 ≤ K2: put comprada em K1 e call vendida em K2 (collar).
    """
    ST = np.asarray(ST, dtype=float)
    r_dom, r_for = taxas_gk(F, S0, selic_aa, T)
    fator = (1 + selic_aa) ** T  # = exp(r_dom·T)

    p_put = premio(S0, K_put, T, r_dom, r_for, sigma, "put")
    p_k1 = premio(S0, K1, T, r_dom, r_for, sigma, "put")
    c_k2 = premio(S0, K2, T, r_dom, r_for, sigma, "call")
    custo_put = p_put * fator
    custo_collar = (p_k1 - c_k2) * fator

    payoff = {
        "aberto": ST,
        "forward_total": np.full(len(ST), F),
        "forward_parcial": x * F + (1 - x) * ST,
        "put": ST + np.maximum(K_put - ST, 0.0) - custo_put,
        "collar": np.clip(ST, K1, K2) - custo_collar,
    }
    premio_hoje = {
        "aberto": 0.0,
        "forward_total": 0.0,
        "forward_parcial": 0.0,
        "put": p_put,
        "collar": p_k1 - c_k2,
    }

    receita_aberto = V * ST
    estrategias = []
    for chave in ESTRATEGIAS:
        receita = V * payoff[chave]
        estrategias.append({
            "id": chave,
            "nome": NOMES[chave],
            "receita_rs": {
                "p5": float(np.percentile(receita, 5)),
                "p50": float(np.percentile(receita, 50)),
                "p95": float(np.percentile(receita, 95)),
                "media": float(receita.mean()),
            },
            "p_abaixo_orcamento": float(np.mean(payoff[chave] < orcamento)),
            "p_arrepender": float(np.mean(receita < receita_aberto)),
            "premio_rs": float(V * premio_hoje[chave]),
        })

    return {"estrategias": estrategias, "carrego_rs": float(V * (F - S0))}
