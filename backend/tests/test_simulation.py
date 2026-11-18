"""MC-01..MC-09: simulação sem truncamento, em blocos, com entradas validadas."""
import numpy as np
import pytest

import simulation
from simulation import DadosInsuficientesError, run_simulation


def _precos(n_validos: int, nones: int = 0, nans: int = 0, seed: int = 0):
    rng = np.random.default_rng(seed)
    closes = 20 * np.exp(np.cumsum(rng.normal(0, 0.02, n_validos)))
    rows = [{"close": float(c)} for c in closes]
    for i in range(nones):
        rows.insert(3 * i + 1, {"close": None})
    for i in range(nans):
        rows.insert(5 * i + 2, {"close": float("nan")})
    return rows


def test_blocos_dao_mesma_serie_que_bloco_unico(monkeypatch):
    monkeypatch.setattr(simulation, "get_prices", lambda *a: _precos(300))
    unico = run_simulation("SB=F", 20.0, dias_simulados=50, num_simulacoes=500, seed=7)
    monkeypatch.setattr(simulation, "LIMITE_CELULAS", 500)  # 1 dia por bloco
    blocos = run_simulation("SB=F", 20.0, dias_simulados=50, num_simulacoes=500, seed=7)
    assert blocos["percentiles_series"] == unico["percentiles_series"]
    assert blocos["pct_passou_limite"] == unico["pct_passou_limite"]


def test_close_none_e_nan_sao_descartados(monkeypatch):
    monkeypatch.setattr(simulation, "get_prices", lambda *a: _precos(40, nones=3, nans=3))
    r = run_simulation("SB=F", 20.0, dias_simulados=10, num_simulacoes=200, seed=1)
    assert all(np.isfinite(v) for v in r["percentiles_series"]["p50"])


def test_historico_com_poucos_validos_levanta_dados_insuficientes(monkeypatch):
    monkeypatch.setattr(simulation, "get_prices", lambda *a: _precos(15, nones=20))
    with pytest.raises(DadosInsuficientesError):
        run_simulation("SB=F", 20.0, dias_simulados=10, num_simulacoes=200, seed=1)


def test_pct_bound_maior_que_um_nao_gera_nan(monkeypatch):
    monkeypatch.setattr(simulation, "get_prices", lambda *a: _precos(200))
    r = run_simulation("SB=F", 20.0, dias_simulados=30, num_simulacoes=300, pct_bound=1.5, seed=3)
    assert 0.0 <= r["pct_passou_limite"] <= 1.0


def test_mesma_seed_mesmo_resultado(monkeypatch):
    monkeypatch.setattr(simulation, "get_prices", lambda *a: _precos(200))
    a = run_simulation("SB=F", 20.0, dias_simulados=30, num_simulacoes=300, seed=5)
    b = run_simulation("SB=F", 20.0, dias_simulados=30, num_simulacoes=300, seed=5)
    assert a["percentiles_series"] == b["percentiles_series"]


# ── Rota ──────────────────────────────────────────────────────────────────────

CORPO = {"ticker": "SB=F", "preco_inicial": 20.0, "dias_simulados": 10, "num_simulacoes": 200}


def _sem_supabase(monkeypatch):
    import main

    def falha():
        raise AssertionError("Supabase não deveria ser chamado")

    monkeypatch.setattr(main, "supa_client", falha)


def test_ticker_invalido_na_simulacao_responde_400_sem_consultar_banco(api, monkeypatch):
    _sem_supabase(monkeypatch)
    r = api.post("/api/simulations", json={**CORPO, "ticker": "DROP TABLE;"})
    assert r.status_code == 400


def test_ticker_invalido_no_params_responde_400_sem_gravar(api, monkeypatch):
    _sem_supabase(monkeypatch)
    r = api.put("/api/params/AB%20CD", json={"volatilidade_custom": 0.3})
    assert r.status_code == 400


@pytest.mark.parametrize("preco", [0, -1])
def test_preco_inicial_nao_positivo_responde_422(api, monkeypatch, preco):
    _sem_supabase(monkeypatch)
    r = api.post("/api/simulations", json={**CORPO, "preco_inicial": preco})
    assert r.status_code == 422


def test_dados_insuficientes_responde_422_em_portugues(api, supa, monkeypatch):
    import main

    def sem_dados(*a, **k):
        raise DadosInsuficientesError("Não há dados históricos suficientes para SB=F (retornos válidos: 0, mínimo: 20).")

    monkeypatch.setattr(main, "run_simulation", sem_dados)
    r = api.post("/api/simulations", json=CORPO)
    assert r.status_code == 422
    assert "Não há dados históricos suficientes" in r.json()["detail"]
