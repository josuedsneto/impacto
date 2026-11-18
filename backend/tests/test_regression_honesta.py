"""REG-01..06: métricas do açúcar vêm de leave-one-out, não do treino. Dados sintéticos, sem rede."""
import numpy as np
import pandas as pd
import pytest

import regression

COLUNAS = regression._ACUCAR_FEATURES


def _df(X, y):
    anos = list(range(2014, 2014 + len(y)))
    df = pd.DataFrame(X, columns=COLUNAS, index=anos)
    df.insert(0, "sb_f", y)
    df.attrs["ultimo_dado"] = "2026-01-01"
    return df


def _entrada(linha):
    return dict(zip(COLUNAS, map(float, linha)))


@pytest.fixture
def ruido(monkeypatch):
    rng = np.random.default_rng(0)
    X = rng.normal(size=(12, len(COLUNAS)))
    y = rng.normal(size=12)
    monkeypatch.setattr(regression, "fetch_acucar_history", lambda: _df(X, y))
    return X, y


def test_ruido_puro_da_r2_loo_baixo_e_confianca_baixa(ruido):
    """REG-01: sem relação com o alvo, o R² fora da amostra não pode parecer bom."""
    X, _ = ruido
    r = regression.run_acucar_regression(_entrada(X[0]))
    assert r["r2_loo"] < 0.3
    assert r["confianca"] == "Baixa"
    assert r["r2_treino"] >= r["r2_loo"]


def test_relacao_linear_da_r2_loo_alto(monkeypatch):
    rng = np.random.default_rng(1)
    X = rng.normal(size=(12, len(COLUNAS)))
    y = 3 * X[:, 0] + rng.normal(scale=0.05, size=12)
    monkeypatch.setattr(regression, "fetch_acucar_history", lambda: _df(X, y))
    r = regression.run_acucar_regression(_entrada(X[0]))
    assert r["r2_loo"] > 0.9
    assert r["confianca"] == "Boa"


def test_faixa_e_de_1_645_vezes_rmse_loo(ruido):
    """REG-02: a faixa é previsão ∓ 1,645 × RMSE fora da amostra."""
    X, _ = ruido
    r = regression.run_acucar_regression(_entrada(X[3]))
    assert r["sb_f_max"] - r["sb_f_previsto"] == pytest.approx(1.645 * r["rmse_loo"], abs=2e-4)
    assert r["sb_f_previsto"] - r["sb_f_min"] == pytest.approx(1.645 * r["rmse_loo"], abs=2e-4)


def test_historico_traz_previsao_fora_da_amostra(ruido):
    X, y = ruido
    r = regression.run_acucar_regression(_entrada(X[0]))
    assert all("sb_f_previsto_fora_amostra" in h and "sb_f_previsto" not in h for h in r["historico"])
    assert "r2" not in r and "rmse" not in r


def test_baseline_ano_anterior_e_calculado(monkeypatch):
    # Preço que segue uma tendência suave: o chute do ano anterior erra pouco
    anos = np.arange(12)
    y = 20 + 0.5 * anos
    X = np.random.default_rng(2).normal(size=(12, len(COLUNAS)))
    monkeypatch.setattr(regression, "fetch_acucar_history", lambda: _df(X, y))
    r = regression.run_acucar_regression(_entrada(X[0]))
    assert r["rmse_ano_anterior"] == pytest.approx(0.5)


def test_escala_de_uma_variavel_nao_muda_a_previsao(monkeypatch):
    """REG-04: padronização. Multiplicar uma variável por 1000 (treino e entrada) não altera a previsão."""
    rng = np.random.default_rng(3)
    X = rng.normal(size=(12, len(COLUNAS)))
    y = X[:, 1] + rng.normal(scale=0.2, size=12)
    entrada = _entrada(X[5])

    monkeypatch.setattr(regression, "fetch_acucar_history", lambda: _df(X, y))
    base = regression.run_acucar_regression(entrada)["sb_f_previsto"]

    X2 = X.copy()
    X2[:, 0] *= 1000
    entrada2 = dict(entrada, **{COLUNAS[0]: entrada[COLUNAS[0]] * 1000})
    monkeypatch.setattr(regression, "fetch_acucar_history", lambda: _df(X2, y))
    escalado = regression.run_acucar_regression(entrada2)["sb_f_previsto"]

    assert escalado == pytest.approx(base, rel=1e-6)


def test_estoque_uso_pct_saiu_do_modelo():
    """REG-05: variável derivada removida."""
    assert "estoque_uso_pct" not in COLUNAS


def test_campo_ausente_da_erro_explicito(ruido):
    """REG-06: nada é zerado em silêncio."""
    entrada = _entrada(np.zeros(len(COLUNAS)))
    del entrada["producao"]
    with pytest.raises(ValueError, match="Campo obrigatório ausente: producao."):
        regression.run_acucar_regression(entrada)
