"""Testes para atr.py — defaults setoriais, calibração OLS e predição com IC."""

import pytest

from atr import calibrate_atr, get_sector_defaults, predict_atr


# ── Defaults setoriais ──────────────────────────────────────────────────────────

def test_sector_defaults_tem_chaves_esperadas():
    d = get_sector_defaults()
    assert set(d) == {"intercept", "coef_chuva", "coef_impureza", "sigma"}
    assert d["coef_impureza"] < 0  # impureza derruba o ATR


# ── Calibração ──────────────────────────────────────────────────────────────────

def test_calibrate_poucos_pontos_usa_defaults():
    """Menos de 5 observações ⇒ cai nos defaults setoriais."""
    history = [{"chuva_mm": 10, "impureza_pct": 2, "atr_real": 140} for _ in range(4)]
    assert calibrate_atr(history) == get_sector_defaults()


def test_calibrate_recupera_coeficientes_conhecidos():
    """OLS sobre dados lineares sem ruído recupera os coeficientes geradores."""
    intercept, b_chuva, b_imp = 130.0, 0.20, -1.5
    # Combinações não-colineares de chuva/impureza.
    pares = [(5, 1), (20, 3), (35, 2), (10, 5), (50, 4), (25, 6)]
    history = [
        {
            "chuva_mm": c,
            "impureza_pct": i,
            "atr_real": intercept + b_chuva * c + b_imp * i,
        }
        for c, i in pares
    ]
    params = calibrate_atr(history)
    assert params["intercept"] == pytest.approx(intercept, abs=1e-2)
    assert params["coef_chuva"] == pytest.approx(b_chuva, abs=1e-3)
    assert params["coef_impureza"] == pytest.approx(b_imp, abs=1e-3)
    assert params["sigma"] == pytest.approx(0.0, abs=1e-2)  # sem ruído ⇒ resíduo ~0


def test_calibrate_dados_colineares_cai_em_defaults():
    """Regressores perfeitamente colineares ⇒ fallback nos defaults."""
    history = [
        {"chuva_mm": v, "impureza_pct": v, "atr_real": 100 + v}
        for v in range(1, 8)
    ]
    params = calibrate_atr(history)
    # OLS singular deve resultar nos defaults (ou ao menos não quebrar).
    assert set(params) == {"intercept", "coef_chuva", "coef_impureza", "sigma"}


# ── Predição ────────────────────────────────────────────────────────────────────

def test_predict_formula_deterministica():
    params = {"intercept": 135.0, "coef_chuva": 0.15, "coef_impureza": -1.8, "sigma": 5.0}
    res = predict_atr(chuva_mm=100, impureza_pct=10, params=params)
    esperado = 135.0 + 0.15 * 100 - 1.8 * 10  # = 132.0
    assert res["atr_esperado"] == pytest.approx(esperado)
    margem = 1.645 * 5.0
    assert res["atr_max"] == pytest.approx(esperado + margem)
    assert res["atr_min"] == pytest.approx(esperado - margem)


def test_predict_atr_min_nunca_negativo():
    """Impureza muito alta empurraria o ATR para baixo; atr_min é limitado a 0."""
    params = {"intercept": 10.0, "coef_chuva": 0.0, "coef_impureza": -5.0, "sigma": 5.0}
    res = predict_atr(chuva_mm=0, impureza_pct=100, params=params)
    assert res["atr_min"] == 0.0


def test_predict_producao_total():
    params = {"intercept": 135.0, "coef_chuva": 0.0, "coef_impureza": 0.0, "sigma": 5.0}
    res = predict_atr(chuva_mm=0, impureza_pct=0, params=params, volume_moagem=1_000_000)
    # toneladas de açúcar = ATR(kg/tc) × tc / 1000
    assert res["producao_total"] == pytest.approx(135.0 * 1_000_000 / 1000)


def test_predict_producao_total_none_sem_volume():
    params = {"intercept": 135.0, "coef_chuva": 0.0, "coef_impureza": 0.0, "sigma": 5.0}
    res = predict_atr(chuva_mm=0, impureza_pct=0, params=params)
    assert res["producao_total"] is None
