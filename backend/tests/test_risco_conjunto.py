"""RC-01 a RC-14: risco conjunto da receita (açúcar × dólar), com oráculo analítico lognormal."""
import math
from datetime import date, timedelta

import numpy as np
import pytest
from scipy.stats import norm

import risco_conjunto as rc
from conftest import dias_uteis

N_GRANDE = 200_000


def _est(vol_a=0.30, vol_d=0.12, rho=0.6, s0=18.0, x0=5.2):
    return {"vol_acucar": vol_a, "vol_dolar": vol_d, "correlacao": rho, "s0": s0, "x0": x0}


def prob_analitica(est, meta, T, pct=0.0, pf=None):
    """P(receita < meta) fechada: ln R ~ N(ln R0, V), V = (σs²+σf²+2ρσsσf)·T/252."""
    r0 = rc.FATOR_RS_POR_T * est["s0"] * est["x0"]
    v = (est["vol_acucar"] ** 2 + est["vol_dolar"] ** 2 + 2 * est["correlacao"] * est["vol_acucar"] * est["vol_dolar"]) * T / 252
    m = meta
    if pct > 0:
        f = pct / 100
        m = (meta - f * pf) / (1 - f)  # R_mix < meta ⇔ R < m
    if m <= 0:
        return 0.0
    if v == 0:
        return float(r0 < m)
    return float(norm.cdf((math.log(m) - math.log(r0)) / math.sqrt(v)))


# ── RC-05: estimação da correlação ──────────────────────────────────────────────

def test_estimar_recupera_correlacao_conhecida():
    rng = np.random.default_rng(1)
    z = rng.multivariate_normal([0, 0], [[1, 0.6], [0.6, 1]], size=10_000)
    r = z * np.array([0.02, 0.01])
    closes_a = 20 * np.exp(np.cumsum(r[:, 0]))
    closes_d = 5 * np.exp(np.cumsum(r[:, 1]))
    est = rc.estimar(np.r_[20, closes_a], np.r_[5, closes_d])
    assert abs(est["correlacao"] - 0.6) < 0.03
    assert est["vol_acucar"] == pytest.approx(0.02 * math.sqrt(252), rel=0.05)


def test_estimar_sem_variacao_nao_gera_nan():
    est = rc.estimar(np.full(100, 20.0), np.linspace(5, 6, 100))
    assert est["correlacao"] == 0.0


def test_estimar_historico_curto_levanta_valueerror():
    with pytest.raises(ValueError):
        rc.estimar(np.ones(59) * 20, np.ones(59) * 5)


# ── RC-07/RC-06: correlação simulada ≈ estimada ─────────────────────────────────

def test_correlacao_simulada_bate_com_a_estimada():
    x_s, x_f = rc._choques(0.30, 0.12, 0.6, 252, N_GRANDE, seed=7)
    assert abs(np.corrcoef(x_s, x_f)[0, 1] - 0.6) < 0.01


# ── RC-09: contra o oráculo analítico ───────────────────────────────────────────

def test_sem_vol_do_dolar_bate_com_univariado():
    est = _est(vol_d=0.0)
    r0 = rc.FATOR_RS_POR_T * est["s0"] * est["x0"]
    meta = r0 * 1.02
    res = rc.calcular(est, meta, horizonte=63, n=N_GRANDE, seed=3)
    analitico = norm.cdf(math.log(meta / r0) / (est["vol_acucar"] / math.sqrt(252) * math.sqrt(63)))
    assert abs(res["prob_abaixo_meta"] - analitico) < 0.005
    assert abs(res["contribuicao"]["prob_so_acucar"] - analitico) < 0.005


def test_caso_bivariado_bate_com_formula_fechada():
    est = _est()
    meta = 2100.0
    res = rc.calcular(est, meta, horizonte=63, n=N_GRANDE, seed=5)
    assert abs(res["prob_abaixo_meta"] - prob_analitica(est, meta, 63)) < 0.005
    assert abs(res["contribuicao"]["prob_sem_correlacao"] - prob_analitica(_est(rho=0.0), meta, 63)) < 0.005


# ── RC-11/RC-12: parte fixada ───────────────────────────────────────────────────

def test_mistura_bate_com_formula_fechada():
    est = _est()
    res = rc.calcular(est, 2100.0, horizonte=63, n=N_GRANDE, percentual_fixado=40, preco_fixado=2050.0, seed=9)
    assert abs(res["prob_abaixo_meta"] - prob_analitica(est, 2100.0, 63, pct=40, pf=2050.0)) < 0.005


def test_fixado_100_por_cento_e_constante():
    est = _est()
    abaixo = rc.calcular(est, 2100.0, n=1000, percentual_fixado=100, preco_fixado=2050.0, seed=1)
    acima = rc.calcular(est, 2000.0, n=1000, percentual_fixado=100, preco_fixado=2050.0, seed=1)
    assert abaixo["prob_abaixo_meta"] == 1.0
    assert acima["prob_abaixo_meta"] == 0.0
    assert abaixo["p5"] == pytest.approx(2050.0, rel=1e-6)


# ── RC-03: reprodutibilidade ────────────────────────────────────────────────────

def test_mesma_seed_mesmo_resultado():
    a = rc.calcular(_est(), 2100.0, n=5000, seed=42)
    b = rc.calcular(_est(), 2100.0, n=5000, seed=42)
    assert a["prob_abaixo_meta"] == b["prob_abaixo_meta"]
    assert a["p50"] == b["p50"]


# ── RC-02: só get_prices, janela e alinhamento ─────────────────────────────────

def test_alinhar_usa_so_datas_em_comum_e_janela():
    a = [{"date": f"2024-01-{d:02d}", "close": 20.0 + d} for d in range(1, 31)]
    d = [{"date": f"2024-01-{x:02d}", "close": 5.0} for x in range(2, 31, 2)]
    ca, cd = rc._alinhar(a, d, janela=10)
    assert len(ca) == 10 and len(cd) == 10


# ── RC-13/RC-14: endpoint ──────────────────────────────────────────────────────

def test_endpoint_responde_com_contrato(api, yahoo):
    r = api.post("/api/risco-conjunto", json={"meta": 2100, "n_simulacoes": 5000, "seed": 1})
    assert r.status_code == 200, r.text
    corpo = r.json()
    for chave in ("prob_abaixo_meta", "p5", "p50", "p95", "histograma", "correlacao", "contribuicao", "ultimo_dado"):
        assert chave in corpo
    assert 0 <= corpo["prob_abaixo_meta"] <= 1


def test_endpoint_exige_preco_fixado_quando_ha_percentual(api, yahoo):
    r = api.post("/api/risco-conjunto", json={"meta": 2100, "percentual_fixado": 30})
    assert r.status_code == 422


def test_endpoint_valida_faixas(api, yahoo):
    assert api.post("/api/risco-conjunto", json={"meta": 0}).status_code == 422
    assert api.post("/api/risco-conjunto", json={"meta": 2100, "horizonte": 300}).status_code == 422


def test_endpoint_sem_precos_responde_503(api, yahoo):
    yahoo.falhar = True
    r = api.post("/api/risco-conjunto", json={"meta": 2100, "n_simulacoes": 1000})
    assert r.status_code == 503
    assert r.json()["detail"].startswith("Não foi possível obter os preços atuais")


def test_endpoint_historico_curto_responde_503(api, yahoo, supa):
    hoje = date.today()
    dias = list(dias_uteis(hoje - timedelta(days=30), hoje))[:20]
    supa.gravar_precos("SB=F", {d: 20.0 for d in dias})
    supa.gravar_precos("USDBRL=X", {d: 5.0 for d in dias})
    supa.cobertura("SB=F", dias[0], dias[-1])
    supa.cobertura("USDBRL=X", dias[0], dias[-1])
    yahoo.falhar = True
    r = api.post("/api/risco-conjunto", json={"meta": 2100, "n_simulacoes": 1000})
    assert r.status_code == 503
    assert "Histórico insuficiente" in r.json()["detail"]


def test_fixado_100_com_meta_igual_ao_preco_fixado_da_zero():
    """RC-12 de borda: em float32, PF = meta podia dar P = 1. Com float64 a comparação é exata."""
    res = rc.calcular(_est(), 2100.7, n=1000, percentual_fixado=100, preco_fixado=2100.7, seed=1)
    assert res["prob_abaixo_meta"] == 0.0
