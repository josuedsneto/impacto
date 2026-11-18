"""Endpoint /api/cambio/previsao: validação, formato da resposta e degradação sem Selic, FRED ou Focus."""
from datetime import date, timedelta

import pandas as pd
import pytest

import routers.cambio as rota
import taxas
from conftest import dias_uteis

ULTIMO_DIA_UTIL = max(dias_uteis(date.today() - timedelta(days=7), date.today())).isoformat()


def _cambio_variando(d: date) -> float:
    return 5.0 + (d.toordinal() % 7) * 0.02


@pytest.fixture
def taxas_ok(monkeypatch):
    """Selic 13,75% e Fed 4,00% disponíveis; Focus com um valor fixo."""
    def selic(ini, fim):
        return pd.Series([13.75], index=[pd.Timestamp(fim)])

    def fed(ini, fim):
        return pd.Series([4.0], index=[pd.Timestamp(fim)])

    monkeypatch.setattr(taxas, "selic_serie", selic)
    monkeypatch.setattr(taxas, "fed_funds_serie", fed)
    monkeypatch.setattr(rota, "fetch_indicator", lambda nome, ano: {"value": 5.4321, "delta": None})


def test_responde_bandas_forward_focus_e_ultimo_dado(api, yahoo, taxas_ok):
    yahoo.preco = _cambio_variando
    r = api.get("/api/cambio/previsao", params={"horizonte": 63})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ultimo_dado"] == ULTIMO_DIA_UTIL
    assert corpo["horizonte"] == 63
    assert len(corpo["bandas"]) == 63
    assert all(b["p5"] < b["p50"] < b["p95"] for b in corpo["bandas"])
    assert corpo["forward"]["valor"] is not None
    assert corpo["forward"]["aproximacao"].startswith("Usa a Selic meta")
    assert corpo["focus"]["cambio_ano_corrente"] == 5.4321
    assert corpo["aviso"].startswith("Faixa de possibilidades, não previsão")


def test_niveis_padrao_sao_spot_menos_e_mais_5_por_cento(api, yahoo, taxas_ok):
    yahoo.preco = _cambio_variando
    corpo = api.get("/api/cambio/previsao", params={"horizonte": 21}).json()
    niveis = [n["nivel"] for n in corpo["niveis"]]
    assert niveis == [round(corpo["spot"] * 0.95, 4), round(corpo["spot"] * 1.05, 4)]


def test_toque_e_maior_ou_igual_a_acima_no_vencimento(api, yahoo, taxas_ok):
    yahoo.preco = _cambio_variando
    corpo = api.get("/api/cambio/previsao", params={"horizonte": 21, "niveis": "5.20,5.60,4.90"}).json()
    spot = corpo["spot"]
    assert any(n["nivel"] < spot for n in corpo["niveis"]), "precisa de um nível abaixo do spot"
    for n in corpo["niveis"]:
        assert 0 <= n["p_acima_vencimento"] <= 1 and 0 <= n["p_abaixo_vencimento"] <= 1
        assert 0 <= n["p_tocar_antes"] <= 1
        if n["nivel"] > spot:
            assert n["p_acima_vencimento"] <= n["p_tocar_antes"]
        else:
            assert n["p_abaixo_vencimento"] <= n["p_tocar_antes"]


@pytest.mark.parametrize("horizonte", [0, 263])
def test_horizonte_fora_do_intervalo_responde_400_em_portugues(api, yahoo, taxas_ok, horizonte):
    yahoo.preco = _cambio_variando
    r = api.get("/api/cambio/previsao", params={"horizonte": horizonte})
    assert r.status_code == 400
    assert "entre 1 e 262" in r.json()["detail"]


@pytest.mark.parametrize("niveis", ["nan", "inf", "", "1e400", "0.1", "x"] + [",".join(["5"] * 11)])
def test_niveis_invalidos_respondem_400(api, yahoo, taxas_ok, niveis):
    yahoo.preco = _cambio_variando
    r = api.get("/api/cambio/previsao", params={"horizonte": 21, "niveis": niveis})
    assert r.status_code == 400


def test_sem_precos_responde_503(api, yahoo, taxas_ok):
    yahoo.falhar = True
    r = api.get("/api/cambio/previsao", params={"horizonte": 21})
    assert r.status_code == 503
    assert r.json()["detail"].startswith("Dados insuficientes para o câmbio")


def test_sem_selic_ou_fed_o_forward_fica_nulo_e_as_bandas_continuam(api, yahoo, monkeypatch):
    yahoo.preco = _cambio_variando
    monkeypatch.setattr(taxas, "selic_serie", lambda i, f: pd.Series(dtype=float))
    monkeypatch.setattr(taxas, "fed_funds_serie", lambda i, f: pd.Series(dtype=float))
    monkeypatch.setattr(rota, "fetch_indicator", lambda nome, ano: {"value": None, "delta": None})
    r = api.get("/api/cambio/previsao", params={"horizonte": 21})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["forward"]["valor"] is None
    assert corpo["focus"]["cambio_ano_corrente"] is None
    assert len(corpo["bandas"]) == 21
