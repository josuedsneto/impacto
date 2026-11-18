"""POST /api/hedge-cambial: formato da resposta, limites de entrada e degradação sem juros."""
from datetime import date, timedelta

import pandas as pd
import pytest

import routers.hedge_cambial as rota
import taxas
from conftest import dias_uteis

ULTIMO_DIA_UTIL = max(dias_uteis(date.today() - timedelta(days=7), date.today())).isoformat()
CORPO = {"volume_usd": 1_000_000, "horizonte_du": 63}


def _cambio_variando(d: date) -> float:
    return 5.0 + (d.toordinal() % 7) * 0.02


@pytest.fixture
def taxas_ok(monkeypatch):
    monkeypatch.setattr(taxas, "selic_serie", lambda ini, fim: pd.Series([13.75], index=[pd.Timestamp(fim)]))
    monkeypatch.setattr(taxas, "fed_funds_serie", lambda ini, fim: pd.Series([4.0], index=[pd.Timestamp(fim)]))


@pytest.fixture
def mercado(api, yahoo, taxas_ok):
    yahoo.preco = _cambio_variando
    return api


def test_responde_cinco_estrategias_com_premissas(mercado):
    r = mercado.post("/api/hedge-cambial", json=CORPO)
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert [e["id"] for e in corpo["estrategias"]] == ["aberto", "forward_total", "forward_parcial", "put", "collar"]
    for e in corpo["estrategias"]:
        assert set(e["receita_rs"]) == {"p5", "p50", "p95", "media"}
        assert e["receita_rs"]["p5"] <= e["receita_rs"]["p50"] <= e["receita_rs"]["p95"]
        assert 0 <= e["p_abaixo_orcamento"] <= 1 and 0 <= e["p_arrepender"] <= 1
    assert corpo["aviso"] == "Comparação de cenários, não recomendação."
    assert "drift zero" in corpo["premissas"]
    assert corpo["vencimento"] > corpo["ultimo_dado"]
    assert corpo["ultimo_dado"] == ULTIMO_DIA_UTIL


def test_travar_100_no_forward_e_deterministico_e_nao_arrepende_o_forward(mercado):
    corpo = mercado.post("/api/hedge-cambial", json=CORPO).json()
    fwd = next(e for e in corpo["estrategias"] if e["id"] == "forward_total")
    assert fwd["receita_rs"]["p5"] == fwd["receita_rs"]["p95"]
    # forward vem arredondado a 4 casas: erro de até R$ 50 em V = 1 milhão.
    assert abs(fwd["receita_rs"]["p50"] - CORPO["volume_usd"] * corpo["forward"]) < 60
    assert fwd["premio_rs"] == 0


def test_forward_acima_do_spot_aparece_no_carrego(mercado):
    corpo = mercado.post("/api/hedge-cambial", json=CORPO).json()
    assert corpo["forward"] > corpo["spot"]
    assert corpo["carrego_rs"] > 0


def test_orcamento_padrao_e_o_forward_e_strikes_padrao_saem_do_spot(mercado):
    corpo = mercado.post("/api/hedge-cambial", json=CORPO).json()
    assert corpo["orcamento"] == corpo["forward"]
    assert corpo["strikes"]["put"] == round(corpo["spot"] * 0.95, 4)
    assert corpo["strikes"]["collar_k2"] == round(corpo["spot"] * 1.05, 4)


@pytest.mark.parametrize(
    "extra",
    [
        {"volume_usd": 0},
        {"volume_usd": 2e9},
        {"horizonte_du": 0},
        {"horizonte_du": 263},
        {"orcamento": 25},
        {"pct_forward": 101},
    ],
)
def test_entrada_fora_dos_limites_responde_422(mercado, extra):
    assert mercado.post("/api/hedge-cambial", json={**CORPO, **extra}).status_code == 422


def test_collar_com_k1_maior_que_k2_responde_400_em_portugues(mercado):
    r = mercado.post("/api/hedge-cambial", json={**CORPO, "collar_k1": 5.5, "collar_k2": 5.0})
    assert r.status_code == 400
    assert "K1" in r.json()["detail"]


def test_sem_juros_responde_503(api, yahoo, monkeypatch):
    yahoo.preco = _cambio_variando
    monkeypatch.setattr(taxas, "selic_serie", lambda ini, fim: pd.Series(dtype=float))
    monkeypatch.setattr(taxas, "fed_funds_serie", lambda ini, fim: pd.Series([4.0], index=[pd.Timestamp(fim)]))
    r = api.post("/api/hedge-cambial", json=CORPO)
    assert r.status_code == 503
    assert "juros" in r.json()["detail"]


def test_historico_curto_responde_503(api, yahoo, taxas_ok):
    yahoo.preco = _cambio_variando
    yahoo.vazio = True
    r = api.post("/api/hedge-cambial", json=CORPO)
    assert r.status_code == 503


def test_modelo_rejeita_nan_e_inf():
    # NaN no corpo JSON não chega ao endpoint: o erro de validação ecoaria o NaN e o JSON não o serializa.
    # O modelo, que é a regra, rejeita direto.
    import pydantic
    for valor in (float("nan"), float("inf")):
        with pytest.raises(pydantic.ValidationError):
            rota.HedgeIn(volume_usd=1e6, horizonte_du=63, strike_put=valor)
