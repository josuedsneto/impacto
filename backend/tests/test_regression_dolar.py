"""DOL-01..04: avaliação fora da amostra do modelo do dólar contra o random walk. Sem rede."""
import numpy as np
import pandas as pd
import pytest

import regression


def test_passeio_aleatorio_nao_e_superado():
    """Câmbio = passeio aleatório; features independentes: o modelo não pode 'supor' que supera."""
    rng = np.random.default_rng(10)
    n = 72
    X = rng.normal(size=(n, 3))
    y = 5 * np.exp(np.cumsum(rng.normal(scale=0.02, size=n)))
    r = regression.avaliar_walk_forward(X, y)
    assert r["r2_fora_amostra"] <= 0.05
    assert r["supera_random_walk"] is False
    assert r["n_previsoes"] == n - 36


def test_relacao_real_e_detectada():
    """Se o nível depende linearmente de X (sem ruído), o modelo supera o random walk."""
    rng = np.random.default_rng(11)
    n = 72
    X = rng.normal(size=(n, 2))
    y = 5 + 0.5 * X[:, 0] + 0.2 * X[:, 1]
    r = regression.avaliar_walk_forward(X, y)
    assert r["r2_fora_amostra"] > 0.5
    assert r["supera_random_walk"] is True


def test_poucas_previsoes_nao_declara_superacao():
    rng = np.random.default_rng(12)
    n = 50  # 14 previsões, abaixo de 24
    X = rng.normal(size=(n, 2))
    y = 5 + X[:, 0]
    r = regression.avaliar_walk_forward(X, y)
    assert r["n_previsoes"] == 14
    assert r["supera_random_walk"] is False


def test_campo_ausente_do_dolar_da_erro(monkeypatch):
    """DOL-04: nada é zerado em silêncio."""
    rng = np.random.default_rng(13)
    n = 72
    df = pd.DataFrame(
        {"taxa_dolar": 5 + rng.normal(size=n).cumsum() * 0.01,
         "selic": rng.normal(size=n), "fed_funds": rng.normal(size=n)},
        index=[f"2020-{(i % 12) + 1:02d}" for i in range(n)],
    )
    df.attrs["ultimo_dado"] = "2026-01-01"
    monkeypatch.setattr(regression, "fetch_dolar_history", lambda months=72: df)
    with pytest.raises(ValueError, match="Campo obrigatório ausente: fed_funds."):
        regression.run_dolar_regression({"selic": 10.0})


def test_mes_corrente_e_removido():
    """Mês parcial não entra: o último período é sempre anterior ao mês de hoje."""
    from datetime import date

    hoje = date(2026, 11, 18)
    s = pd.Series([1.0, 2.0, 3.0], index=pd.to_datetime(["2026-09-30", "2026-10-31", "2026-11-30"]))
    filtrado = regression._so_meses_fechados(s, hoje)
    assert list(filtrado.index.strftime("%Y-%m")) == ["2026-09", "2026-10"]
