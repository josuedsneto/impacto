"""Testes do núcleo de câmbio (cambio.py): invariantes exatas e cobertura com GBM de vol conhecida."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import cambio  # noqa: E402


def test_forward_paridade_coberta_exemplo():
    # S=5,00; Selic 10% a.a. em 252 dias úteis; Fed 5% ACT/360 em 360 dias corridos → F = 5 × 1,10/1,05
    assert cambio.forward(5.0, 0.10, 252, 0.05, 360) == pytest.approx(5.0 * 1.10 / 1.05, rel=1e-12)


def test_limpar_remove_zero_duplicata_e_salto():
    closes = np.array([5.0, 0.0, 5.0, 5.1, 9.0, 5.2])
    datas = np.array(["d1", "d2", "d1", "d3", "d4", "d5"])
    c, d = cambio.limpar(closes, datas)
    assert list(d) == ["d1", "d3", "d5"]  # zero fora, duplicata fora, salto 5,1→9,0 fora
    assert list(c) == [5.0, 5.1, 5.2]


def test_prob_tocar_direcao_e_invariante():
    # caminhos: um sobe até 5,9 e volta a 5,0; outro cai a 4,0
    caminhos = np.array([[5.2, 5.9, 5.0], [4.9, 4.0, 4.1]], dtype=np.float32)
    s0 = 5.0
    assert cambio.prob_tocar(caminhos, s0, 5.8) == 0.5       # só o primeiro toca 5,8 (máximo 5,9)
    assert cambio.prob_acima(caminhos, 5.8) == 0.0           # vencimento não passa 5,8
    assert cambio.prob_tocar(caminhos, s0, 4.5) == 0.5       # só o segundo toca 4,5 (mínimo 4,0)
    assert cambio.prob_abaixo(caminhos, 4.5) == 0.5
    # invariante: para K > S0, P(tocar) ≥ P(acima no vencimento)
    for k in [5.05, 5.3, 5.8]:
        assert cambio.prob_tocar(caminhos, s0, k) >= cambio.prob_acima(caminhos, k)


def test_bandas_ordenadas_e_alargam_com_horizonte():
    closes = 5.0 * np.exp(np.cumsum(np.random.default_rng(1).normal(0, 0.006, 400)))
    caminhos = cambio.simular(closes, h=126, n=4000, seed=7)
    b = cambio.bandas(caminhos)
    assert np.all(b["p5"] < b["p50"]) and np.all(b["p50"] < b["p95"])
    largura = b["p95"] - b["p5"]
    assert largura[125] > largura[4]


def test_simular_reprodutivel_e_forma():
    closes = 5.0 * np.exp(np.cumsum(np.random.default_rng(2).normal(0, 0.005, 300)))
    a = cambio.simular(closes, h=10, n=50, seed=3)
    b = cambio.simular(closes, h=10, n=50, seed=3)
    assert a.shape == (50, 10)
    assert np.array_equal(a, b)


def test_vol_zero_nao_quebra():
    closes = np.full(300, 5.0)
    caminhos = cambio.simular(closes, h=5, n=20, seed=0)
    assert np.allclose(caminhos, 5.0)


def test_cobertura_p5_p95_gbm_vol_conhecida():
    # GBM com vol diária 0,8% conhecida. N=1000 origens sem overlap (h=5), 2000 caminhos, seed fixa.
    rng = np.random.default_rng(42)
    janela, h, origens = 756, 5, 1000
    total = janela + origens * h + 1
    closes = 5.0 * np.exp(np.cumsum(rng.normal(0, 0.008, total)))
    dentro = 0
    for j in range(origens):
        t = janela - 1 + j * h
        caminhos = cambio.simular(closes[t - janela + 1 : t + 1], h=h, n=2000, seed=j)
        b = cambio.bandas(caminhos)
        real = closes[t + h]
        if b["p5"][-1] <= real <= b["p95"][-1]:
            dentro += 1
    cobertura = dentro / origens
    assert 0.87 <= cobertura <= 0.93, f"cobertura {cobertura:.3f} fora de 87–93%"
