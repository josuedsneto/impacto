"""POS-V2-01 a POS-V2-05: MTM de opção por Black-76 (açúcar) e Garman-Kohlhagen (dólar), com fallback."""
import math

import numpy as np
import pytest

import main  # noqa: F401  # routers.posicoes importa limiter de main
from cambio import forward
from hedge_cambial import taxas_gk
from mtm_opcoes import opcao_acucar, opcao_dolar, vol_historica
from options import black76_price, gk_price
from routers.posicoes import FATOR, calcular_mtm, mtm_com_modelo


def _op(**kw):
    return {"id": "p1", "instrumento": "opcao_acucar", "volume": 1000.0, "preco_fixado": 18.0,
            "premio": 0.5, "tipo_opcao": None, "vencimento": "2027-03-31", **kw}


# ── Black-76 (açúcar) ───────────────────────────────────────────────────────────

def test_black76_bate_com_options_py():
    p = _op()
    d = opcao_acucar(p, sb=19.0, vol=0.30, fed=4.0, du=126)
    T, r = 126 / 252, math.log(1.04)
    assert d["modelo"] == "black76"
    assert d["valor_unitario"] == pytest.approx(black76_price(19.0, 18.0, T, r, 0.30, "put"), rel=1e-12)
    assert d["vol_anual"] == 0.30 and d["taxa_dom"] == pytest.approx(r)
    assert d["taxa_for"] is None and d["anos_ate_vencimento"] == pytest.approx(T)
    assert d["aviso"] is None


def test_call_usa_a_call_do_black76():
    d = opcao_acucar(_op(tipo_opcao="call", preco_fixado=18.0), sb=19.0, vol=0.30, fed=4.0, du=126)
    assert d["valor_unitario"] == pytest.approx(black76_price(19.0, 18.0, 126 / 252, math.log(1.04), 0.30, "call"))


def test_mtm_black76_em_reais_usa_o_fator_do_mvp():
    d = opcao_acucar(_op(), sb=19.0, vol=0.30, fed=4.0, du=126)
    mtm = mtm_com_modelo(_op(), d, sb=19.0, fx=5.0)
    assert mtm == pytest.approx((d["valor_unitario"] - 0.5) * FATOR * 5.0 * 1000)


# ── Garman-Kohlhagen (dólar) ────────────────────────────────────────────────────

def test_gk_bate_com_options_py_e_com_a_paridade_do_hedge():
    p = {"id": "d1", "instrumento": "opcao_dolar", "volume": 100000.0, "preco_fixado": 5.2, "premio": 0.0,
         "tipo_opcao": None, "vencimento": "2027-03-31"}
    spot, selic, fed, du, dc, vol = 5.0, 14.0, 4.0, 126, 160, 0.15
    d = opcao_dolar(p, spot, vol, selic, fed, du, dc)
    F = forward(spot, selic / 100, du, fed / 100, dc)
    r_dom, r_for = taxas_gk(F, spot, selic / 100, du / 252)
    assert d["modelo"] == "gk"
    assert d["valor_unitario"] == pytest.approx(gk_price(spot, 5.2, du / 252, r_dom, r_for, vol, "put"), rel=1e-12)
    assert d["taxa_dom"] == pytest.approx(r_dom) and d["taxa_for"] == pytest.approx(r_for)


# ── Fallback: nunca erro, sempre valor intrínseco com aviso ────────────────────

@pytest.mark.parametrize("kw, motivo", [
    ({"vol": None}, "volatilidade"),
    ({"fed": None}, "taxa"),
    ({"du": None}, "vencimento"),
    ({"du": 0}, "vencida"),
])
def test_acucar_sem_dado_cai_no_intrinseco_com_aviso(kw, motivo):
    args = {"sb": 19.0, "vol": 0.30, "fed": 4.0, "du": 126, **kw}
    d = opcao_acucar(_op(), **args)
    assert d["modelo"] == "intrinseco"
    assert d["valor_unitario"] == pytest.approx(max(18.0 - 19.0, 0.0))  # put fora do dinheiro
    assert motivo in d["aviso"].lower()
    assert d["vol_anual"] is None and d["taxa_dom"] is None and d["anos_ate_vencimento"] is None


def test_dolar_sem_selic_cai_no_intrinseco():
    p = {"instrumento": "opcao_dolar", "volume": 1.0, "preco_fixado": 5.2, "premio": 0.0, "tipo_opcao": None}
    d = opcao_dolar(p, 5.0, 0.15, None, 4.0, 126, 160)
    assert d["modelo"] == "intrinseco" and d["valor_unitario"] == pytest.approx(0.2) and d["aviso"]


def test_intrinseco_de_call_no_dolar():
    p = {"instrumento": "opcao_dolar", "volume": 1.0, "preco_fixado": 5.0, "premio": 0.0, "tipo_opcao": "call"}
    d = opcao_dolar(p, 5.3, None, 14.0, 4.0, 126, 160)
    assert d["valor_unitario"] == pytest.approx(0.3)


def test_mtm_intrinseco_de_call_no_acucar():
    p = {"instrumento": "opcao_acucar", "volume": 1000.0, "preco_fixado": 18.0, "premio": 0.5, "tipo_opcao": "call"}
    assert calcular_mtm(p, sb=19.0, fx=5.0) == pytest.approx((1.0 - 0.5) * FATOR * 5.0 * 1000)


# ── Volatilidade histórica ──────────────────────────────────────────────────────

def test_vol_historica_de_retornos_alternados():
    r = np.array([0.01 if i % 2 == 0 else -0.01 for i in range(252)])
    closes = 20 * np.exp(np.concatenate([[0.0], np.cumsum(r)]))
    esperado = 0.01 * math.sqrt(252 / 251) * math.sqrt(252)
    assert vol_historica(closes) == pytest.approx(esperado, rel=1e-9)


def test_vol_historica_sem_historico_suficiente_e_none():
    assert vol_historica(np.array([20.0] * 30)) is None



def test_vol_zero_ou_nan_cai_no_intrinseco_sem_erro():
    # série constante: vol 0 não pode levantar ValueError (era 500 no endpoint)
    for vol in (0.0, float("nan")):
        d = opcao_acucar(_op(), sb=19.0, vol=vol, fed=4.0, du=126)
        assert d["modelo"] == "intrinseco" and d["aviso"]
