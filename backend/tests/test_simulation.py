"""Testes para simulation.py — engine de Monte Carlo (get_prices mockado)."""

import pytest

import simulation
from simulation import run_simulation


def _fake_rows(n=400, start=20.0, step=0.01):
    """Série sintética de fechamentos com leve tendência (>= 20 pontos)."""
    return [{"close": start + i * step} for i in range(n)]


@pytest.fixture
def mock_prices(monkeypatch):
    """Substitui simulation.get_prices por uma série sintética determinística."""
    def _install(rows):
        monkeypatch.setattr(simulation, "get_prices", lambda *a, **k: rows)
    return _install


def test_estrutura_e_chaves(mock_prices):
    mock_prices(_fake_rows())
    res = run_simulation("SB=F", preco_inicial=20.0, dias_simulados=30, num_simulacoes=500)
    for k in ("p5", "p20", "p25", "p50", "p75", "p80", "p95", "percentiles_series"):
        assert k in res
    assert res["ticker"] == "SB=F"
    assert res["dias_simulados"] == 30


def test_percentis_ordenados(mock_prices):
    mock_prices(_fake_rows())
    res = run_simulation("SB=F", preco_inicial=20.0, dias_simulados=30, num_simulacoes=2000)
    assert res["p5"] <= res["p20"] <= res["p25"] <= res["p50"] <= res["p75"] <= res["p80"] <= res["p95"]


def test_series_respeita_tamanho_e_bounds(mock_prices):
    mock_prices(_fake_rows())
    preco, dias, pct = 20.0, 40, 0.5
    res = run_simulation("SB=F", preco_inicial=preco, dias_simulados=dias, num_simulacoes=1000, pct_bound=pct)

    lower, upper = preco * (1 - pct), preco * (1 + pct)
    series = res["percentiles_series"]
    assert set(series) == {"p5", "p20", "p25", "p50", "p75", "p80", "p95"}
    for label, valores in series.items():
        assert len(valores) == dias, f"{label} deveria ter {dias} pontos"
        assert all(lower - 1e-9 <= v <= upper + 1e-9 for v in valores)

    # Escalares finais também dentro dos limites.
    assert lower <= res["p5"] <= res["p95"] <= upper


def test_volatilidade_custom_alta_satura_no_teto(mock_prices):
    """Sigma enorme faz os caminhos estourarem e grudarem no upper_bound."""
    mock_prices(_fake_rows())
    preco, pct = 20.0, 0.5
    upper = preco * (1 + pct)
    res = run_simulation(
        "SB=F", preco_inicial=preco, dias_simulados=60, num_simulacoes=1000,
        pct_bound=pct, volatilidade_custom=5.0,
    )
    assert res["p95"] == pytest.approx(upper, abs=1e-6)


def test_dados_insuficientes_levanta_erro(mock_prices):
    mock_prices(_fake_rows(n=10))  # < 20 ⇒ ValueError
    with pytest.raises(ValueError):
        run_simulation("SB=F", preco_inicial=20.0, dias_simulados=30, num_simulacoes=500)
