"""Testes para options.py — Black-Scholes, payoff multi-leg e MC pricer."""

import math

import numpy as np
import pytest

from options import bs_call_price, compute_payoff, mc_call_price


# ── Black-Scholes ───────────────────────────────────────────────────────────────

def test_bs_call_valor_de_referencia():
    """BS(S=100, K=100, T=1, r=0.05, sigma=0.2) ≈ 10.4506 (valor canônico)."""
    price = bs_call_price(S=100, K=100, T=1, r=0.05, sigma=0.2)
    assert price == pytest.approx(10.4506, abs=1e-3)


def test_bs_call_deep_itm_tende_ao_valor_intrinseco_descontado():
    """Call muito dentro do dinheiro ≈ S - K·e^(-rT)."""
    S, K, T, r, sigma = 200.0, 100.0, 1.0, 0.05, 0.2
    price = bs_call_price(S, K, T, r, sigma)
    intrinseco_descontado = S - K * math.exp(-r * T)
    assert price == pytest.approx(intrinseco_descontado, abs=0.5)


def test_bs_call_monotonico_no_spot():
    """O preço da call cresce monotonicamente com o spot S."""
    precos = [bs_call_price(S=s, K=100, T=1, r=0.05, sigma=0.2) for s in range(80, 121, 5)]
    assert all(b > a for a, b in zip(precos, precos[1:]))


def test_bs_call_cresce_com_volatilidade():
    """Vega positivo: maior sigma ⇒ maior preço."""
    baixa = bs_call_price(S=100, K=100, T=1, r=0.05, sigma=0.1)
    alta = bs_call_price(S=100, K=100, T=1, r=0.05, sigma=0.4)
    assert alta > baixa


@pytest.mark.parametrize(
    "kwargs",
    [
        {"S": 0, "K": 100, "T": 1, "r": 0.05, "sigma": 0.2},
        {"S": 100, "K": -1, "T": 1, "r": 0.05, "sigma": 0.2},
        {"S": 100, "K": 100, "T": 0, "r": 0.05, "sigma": 0.2},
        {"S": 100, "K": 100, "T": 1, "r": 0.05, "sigma": 0},
    ],
)
def test_bs_call_rejeita_parametros_invalidos(kwargs):
    with pytest.raises(ValueError):
        bs_call_price(**kwargs)


# ── Payoff multi-leg ────────────────────────────────────────────────────────────

def test_payoff_long_call_breakeven_e_intrinseco():
    """Long call: prejuízo = prêmio abaixo do strike; breakeven em K + prêmio."""
    legs = [{"type": "call", "strike": 100, "premium": 5, "position": "long", "quantity": 1}]
    res = compute_payoff(legs, price_range=[90, 100, 105, 110])
    payoff = dict(zip(res["prices"], res["payoff"]))
    assert payoff[90] == pytest.approx(-5)    # OTM: perde o prêmio
    assert payoff[100] == pytest.approx(-5)   # ATM: ainda perde o prêmio
    assert payoff[105] == pytest.approx(0)    # breakeven = strike + prêmio
    assert payoff[110] == pytest.approx(5)    # ITM


def test_payoff_short_call_e_oposto_do_long():
    """Short call deve ser exatamente o negativo do long call (mesmos parâmetros)."""
    base = {"type": "call", "strike": 100, "premium": 5, "quantity": 1}
    pr = [90, 100, 110, 120]
    longo = compute_payoff([{**base, "position": "long"}], price_range=pr)["payoff"]
    curto = compute_payoff([{**base, "position": "short"}], price_range=pr)["payoff"]
    assert curto == pytest.approx([-x for x in longo])


def test_payoff_straddle_simetrico_no_strike():
    """Long straddle (call+put no mesmo strike) é simétrico em torno do strike."""
    legs = [
        {"type": "call", "strike": 100, "premium": 4, "position": "long", "quantity": 1},
        {"type": "put", "strike": 100, "premium": 4, "position": "long", "quantity": 1},
    ]
    res = compute_payoff(legs, price_range=[80, 100, 120])
    payoff = dict(zip(res["prices"], res["payoff"]))
    assert payoff[80] == pytest.approx(payoff[120])   # simetria
    assert payoff[100] == pytest.approx(-8)           # perde os dois prêmios no strike


def test_payoff_quantidade_escala_linearmente():
    legs1 = [{"type": "call", "strike": 100, "premium": 5, "position": "long", "quantity": 1}]
    legs3 = [{"type": "call", "strike": 100, "premium": 5, "position": "long", "quantity": 3}]
    p1 = compute_payoff(legs1, price_range=[120])["payoff"][0]
    p3 = compute_payoff(legs3, price_range=[120])["payoff"][0]
    assert p3 == pytest.approx(3 * p1)


def test_payoff_range_default_cobre_os_strikes():
    legs = [{"type": "call", "strike": 100, "premium": 5, "position": "long", "quantity": 1}]
    res = compute_payoff(legs)
    assert len(res["prices"]) == 200
    assert min(res["prices"]) == pytest.approx(50.0)    # 0.5 * min_strike
    assert max(res["prices"]) == pytest.approx(150.0)   # 1.5 * max_strike


def test_payoff_legs_vazio_levanta_erro():
    with pytest.raises(ValueError):
        compute_payoff([])


def test_payoff_tipo_desconhecido_levanta_erro():
    legs = [{"type": "swap", "strike": 100, "premium": 5, "position": "long", "quantity": 1}]
    with pytest.raises(ValueError):
        compute_payoff(legs)


# ── Monte Carlo pricer ──────────────────────────────────────────────────────────

def test_mc_converge_para_black_scholes(monkeypatch):
    """Com RNG semeado e muitos caminhos, o MC pricer ≈ Black-Scholes."""
    seeded = np.random.default_rng(42)
    monkeypatch.setattr("options.np.random.default_rng", lambda *a, **k: seeded)
    S, K, T, r, sigma = 100.0, 100.0, 1.0, 0.05, 0.2
    analitico = bs_call_price(S, K, T, r, sigma)
    mc = mc_call_price(S, K, T, r, sigma, num_simulacoes=200_000)
    # Tolerância relativa frouxa por causa do erro de Monte Carlo.
    assert mc == pytest.approx(analitico, rel=0.05)


def test_mc_rejeita_parametros_invalidos():
    with pytest.raises(ValueError):
        mc_call_price(S=-1, K=100, T=1, r=0.05, sigma=0.2)
