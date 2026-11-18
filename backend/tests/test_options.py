"""Opções sobre futuro (Black-76), Garman-Kohlhagen e validação da estratégia."""
import math

import pytest

from options import black76_price, compute_payoff, gk_price, mc_black76_price


# ── Black-76 ──────────────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "F,K,T,r,sigma",
    [(20, 21, 1, 0.10, 0.30), (20, 15, 0.25, 0.05, 0.20), (18.5, 22, 2, 0.03, 0.45)],
)
def test_paridade_put_call_black76(F, K, T, r, sigma):
    c = black76_price(F, K, T, r, sigma, "call")
    p = black76_price(F, K, T, r, sigma, "put")
    assert abs((c - p) - math.exp(-r * T) * (F - K)) < 1e-9


def test_black76_referencia_atm():
    # ATM: C = e^{-rT} · F · (2N(σ√T/2) − 1) = e^{-0.05} · 20 · 0.0796556 ≈ 1.51541
    assert black76_price(F=20, K=20, T=1, r=0.05, sigma=0.2, tipo="call") == pytest.approx(1.51541, abs=1e-4)


def test_black76_rejeita_parametro_nao_positivo():
    with pytest.raises(ValueError, match="volatilidade"):
        black76_price(F=20, K=20, T=1, r=0.05, sigma=0)
    with pytest.raises(ValueError, match="futuro"):
        black76_price(F=0, K=20, T=1, r=0.05, sigma=0.2)


def test_black76_tipo_invalido():
    with pytest.raises(ValueError):
        black76_price(F=20, K=20, T=1, r=0.05, sigma=0.2, tipo="straddle")


def test_mc_converge_para_black76_com_seed_fixa():
    bs = black76_price(F=20, K=21, T=1, r=0.10, sigma=0.30)
    mc = mc_black76_price(F=20, K=21, T=1, r=0.10, sigma=0.30, num_simulacoes=200_000, seed=42)
    assert abs(mc - bs) / bs < 0.01


def test_mc_mesma_seed_mesmo_resultado():
    a = mc_black76_price(F=20, K=21, T=1, r=0.1, sigma=0.3, num_simulacoes=1000, seed=7)
    b = mc_black76_price(F=20, K=21, T=1, r=0.1, sigma=0.3, num_simulacoes=1000, seed=7)
    assert a == b


# ── Garman-Kohlhagen ──────────────────────────────────────────────────────────

def test_gk_paridade_put_call():
    S, K, T, rd, rf, sg = 5.2, 5.0, 0.5, 0.10, 0.04, 0.15
    c = gk_price(S, K, T, rd, rf, sg, "call")
    p = gk_price(S, K, T, rd, rf, sg, "put")
    assert abs((c - p) - (S * math.exp(-rf * T) - K * math.exp(-rd * T))) < 1e-9


def test_gk_igual_black76_com_futuro_implicito():
    S, K, T, rd, rf, sg = 5.2, 5.0, 0.5, 0.10, 0.04, 0.15
    F = S * math.exp((rd - rf) * T)
    for tipo in ("call", "put"):
        assert abs(gk_price(S, K, T, rd, rf, sg, tipo) - black76_price(F, K, T, rd, sg, tipo)) < 1e-9


def test_gk_rejeita_spot_nao_positivo():
    with pytest.raises(ValueError):
        gk_price(0, 5, 1, 0.1, 0.04, 0.2)


# ── Estratégia: validação na função ───────────────────────────────────────────

def test_compute_payoff_rejeita_posicao_desconhecida():
    leg = {"type": "call", "strike": 20, "premium": 1, "position": "comprado", "quantity": 1}
    with pytest.raises(ValueError, match="Posição inválida"):
        compute_payoff([leg])


def test_compute_payoff_sem_pernas():
    with pytest.raises(ValueError):
        compute_payoff([])


# ── Endpoints ─────────────────────────────────────────────────────────────────

PERNA_OK = {"type": "call", "strike": 20, "premium": 1, "position": "long", "quantity": 1}


@pytest.mark.parametrize(
    "perna",
    [
        {**PERNA_OK, "type": "bull"},
        {**PERNA_OK, "position": "comprado"},
        {**PERNA_OK, "quantity": 0},
        {**PERNA_OK, "quantity": -3},
        {**PERNA_OK, "quantity": 100_001},
        {**PERNA_OK, "strike": 0},
        {**PERNA_OK, "premium": -1},
    ],
)
def test_payoff_entrada_invalida_responde_422(api, perna):
    r = api.post("/api/options/payoff", json={"legs": [perna]})
    assert r.status_code == 422


def test_payoff_sem_pernas_responde_422(api):
    assert api.post("/api/options/payoff", json={"legs": []}).status_code == 422


def test_payoff_valido_responde_200(api):
    r = api.post("/api/options/payoff", json={"legs": [PERNA_OK]})
    assert r.status_code == 200
    assert len(r.json()["payoff"]) == 200


def test_bs_price_usa_futuro_black76(api):
    r = api.post("/api/options/bs-price", json={"F": 20, "K": 20, "T": 1, "r": 0.05, "sigma": 0.2})
    assert r.status_code == 200
    assert r.json()["price"] == pytest.approx(black76_price(20, 20, 1, 0.05, 0.2), abs=1e-9)


def test_bs_price_parametro_invalido_responde_422(api):
    r = api.post("/api/options/bs-price", json={"F": 0, "K": 20, "T": 1, "r": 0.05, "sigma": 0.2})
    assert r.status_code == 422
