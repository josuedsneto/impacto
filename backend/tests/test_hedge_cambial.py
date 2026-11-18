"""hedge_cambial: prêmio GK contra referências, identidades do forward/collar e sinais das estratégias."""
import math

import numpy as np

import hedge_cambial as hc
from options import gk_price

S0, F, SELIC, T, SIGMA = 5.0, 5.25, 0.14, 0.25, 0.12
V = 1_000_000.0


def _put_fechada(S, K, T, rd, rf, sigma):
    """Put GK pela fórmula fechada, escrita à parte (com erf, sem scipy)."""
    cdf = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))
    d1 = (math.log(S / K) + (rd - rf + 0.5 * sigma**2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return K * math.exp(-rd * T) * cdf(-d2) - S * math.exp(-rf * T) * cdf(-d1)


def test_taxas_gk_reproduzem_o_forward():
    rd, rf = hc.taxas_gk(F, S0, SELIC, T)
    assert math.isclose(S0 * math.exp((rd - rf) * T), F, rel_tol=1e-12)


def test_premio_put_bate_formula_fechada():
    rd, rf = hc.taxas_gk(F, S0, SELIC, T)
    for K in (4.8, 5.0, 5.25, 5.6):
        assert math.isclose(gk_price(S0, K, T, rd, rf, SIGMA, "put"), _put_fechada(S0, K, T, rd, rf, SIGMA), rel_tol=1e-9)


def test_premio_put_bate_monte_carlo_risco_neutro():
    # E_Q[(K - S_T)+] · e^{-rd T} com S_T lognormal de drift rd - rf (risco neutro), 2 milhões de caminhos.
    rd, rf = hc.taxas_gk(F, S0, SELIC, T)
    K = 5.0
    z = np.random.default_rng(7).standard_normal(2_000_000)
    ST = S0 * np.exp((rd - rf - 0.5 * SIGMA**2) * T + SIGMA * math.sqrt(T) * z)
    mc = math.exp(-rd * T) * np.mean(np.maximum(K - ST, 0.0))
    assert math.isclose(gk_price(S0, K, T, rd, rf, SIGMA, "put"), mc, rel_tol=0.005)


def test_vol_zero_travar_100_no_forward_da_V_vezes_F():
    caminhos = np.full(10, S0)
    r = hc.simular_estrategias(caminhos, V, S0, F, SELIC, T, 0.0, 4.0, 0.5, 5.0, 4.8, 5.6)
    fwd = next(e for e in r["estrategias"] if e["id"] == "forward_total")
    assert math.isclose(fwd["receita_rs"]["p5"], V * F, rel_tol=1e-12)
    assert math.isclose(fwd["receita_rs"]["p95"], V * F, rel_tol=1e-12)


def test_vol_zero_put_e_collar_com_strike_no_forward_dao_V_vezes_F():
    caminhos = np.full(10, S0)
    r = hc.simular_estrategias(caminhos, V, S0, F, SELIC, T, 0.0, 4.0, 0.0, F, F, F)
    por_id = {e["id"]: e for e in r["estrategias"]}
    assert math.isclose(por_id["put"]["receita_rs"]["media"], V * F, rel_tol=1e-9)
    assert math.isclose(por_id["collar"]["receita_rs"]["media"], V * F, rel_tol=1e-9)
    assert por_id["put"]["premio_rs"] == 0.0


def test_collar_com_k1_igual_k2_da_V_vezes_F_em_todo_caminho():
    ST = np.random.default_rng(3).lognormal(math.log(S0), 0.15, 5_000)
    for K in (4.8, 5.25, 5.7):
        r = hc.simular_estrategias(ST, V, S0, F, SELIC, T, SIGMA, 4.0, 0.0, 5.0, K, K)
        collar = next(e for e in r["estrategias"] if e["id"] == "collar")
        assert math.isclose(collar["receita_rs"]["p5"], V * F, rel_tol=1e-9)
        assert math.isclose(collar["receita_rs"]["p95"], V * F, rel_tol=1e-9)


def test_sinais_media_das_cinco_estrategias_igual_V_vezes_F_sob_risco_neutro():
    # Caminhos lognormais com E_Q[S_T] = F. Pelo prêmio capitalizado, a média líquida de cada estratégia é V·F.
    rd, rf = hc.taxas_gk(F, S0, SELIC, T)
    n = 1_000_000
    z = np.random.default_rng(11).standard_normal(n)
    ST = S0 * np.exp((rd - rf - 0.5 * SIGMA**2) * T + SIGMA * math.sqrt(T) * z)
    r = hc.simular_estrategias(ST, V, S0, F, SELIC, T, SIGMA, 4.0, 0.5, 5.0, 4.8, 5.6)
    for e in r["estrategias"]:
        media = e["receita_rs"]["media"]
        # Tolerância de 0,03% de V·F (~R$ 1,6 mil), cerca de 5 erros-padrão do MC (~R$ 300 no aberto, seed fixa).
        assert abs(media - V * F) < 0.0003 * V * F, (e["id"], media, V * F)


def test_put_capitaliza_o_premio_pelo_selic():
    # Identidade exata: a média da put é média(ST) + média((K-ST)+) − prêmio·(1+Selic)^T, em R$ por US$ × V.
    rd, rf = hc.taxas_gk(F, S0, SELIC, T)
    ST = np.random.default_rng(5).lognormal(math.log(S0), 0.2, 10_000)
    K = 5.0
    r = hc.simular_estrategias(ST, V, S0, F, SELIC, T, SIGMA, 4.0, 0.0, K, 4.8, 5.6)
    put = next(e for e in r["estrategias"] if e["id"] == "put")
    p = gk_price(S0, K, T, rd, rf, SIGMA, "put")
    esperado = V * (np.mean(ST) + np.mean(np.maximum(K - ST, 0.0)) - p * (1 + SELIC) ** T)
    assert math.isclose(put["receita_rs"]["media"], esperado, rel_tol=1e-12)


def test_arrependimento_e_probabilidade_abaixo_em_caminhos_conhecidos():
    ST = np.array([F - 0.1, F + 0.1])  # metade abaixo do forward, metade acima
    r = hc.simular_estrategias(ST, V, S0, F, SELIC, T, SIGMA, F, 0.5, 5.0, 4.8, 5.6)
    por_id = {e["id"]: e for e in r["estrategias"]}
    # Forward total arrepende-se só onde o câmbio sobe acima do forward: metade dos caminhos.
    assert por_id["forward_total"]["p_arrepender"] == 0.5
    assert por_id["aberto"]["p_arrepender"] == 0.0
    # Com orçamento = F, o forward nunca fica abaixo (F < F é falso).
    assert por_id["forward_total"]["p_abaixo_orcamento"] == 0.0
    # Aberto fica abaixo do orçamento F na metade em que o câmbio cai.
    assert por_id["aberto"]["p_abaixo_orcamento"] == 0.5


def test_carrego_e_V_vezes_forward_menos_spot():
    r = hc.simular_estrategias(np.full(3, S0), V, S0, F, SELIC, T, SIGMA, 4.0, 0.5, 5.0, 4.8, 5.6)
    assert math.isclose(r["carrego_rs"], V * (F - S0))
