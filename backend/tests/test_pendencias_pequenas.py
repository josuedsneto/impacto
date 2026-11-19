"""PEN-04 a PEN-07, PEN-11 e PEN-12: lote com erro por linha, MC mínimo de 100 e heatmap de Metas."""
from datetime import date, timedelta

import pytest

import main  # noqa: F401
import market_cache
from conftest import FakeYahoo

USINA = "11111111-1111-1111-1111-111111111111"


@pytest.fixture
def usinas(supa):
    supa.db["user_usinas"] = {("u1", USINA): {"user_id": "u1", "usina_id": USINA}}
    return supa


def _pos(**kw):
    return {"instrumento": "fixacao_acucar", "volume": 1000, "preco_fixado": 20, **kw}


# ── PEN-04 a PEN-06: erro por linha no lote ─────────────────────────────────────

def test_lote_invalido_diz_a_linha_e_o_campo_em_portugues(api, usinas):
    lote = {"usina_id": USINA, "safra": "2026/27", "posicoes": [
        _pos(), _pos(), _pos(volume=0), _pos()]}
    r = api.post("/api/posicoes/lote", json=lote)
    assert r.status_code == 422
    assert r.json()["detail"] == "Linha 3 (Volume): valor inválido."


def test_lote_com_campo_obrigatorio_ausente_aponta_a_linha(api, usinas):
    sem_instrumento = {"volume": 1000, "preco_fixado": 20}
    lote = {"usina_id": USINA, "safra": "2026/27", "posicoes": [_pos(), sem_instrumento]}
    r = api.post("/api/posicoes/lote", json=lote)
    assert r.status_code == 422
    assert r.json()["detail"] == "Linha 2 (Instrumento): campo obrigatório."


def test_lote_com_linha_que_nao_e_objeto_aponta_a_linha(api, usinas):
    lote = {"usina_id": USINA, "safra": "2026/27", "posicoes": [_pos(), 5]}
    r = api.post("/api/posicoes/lote", json=lote)
    assert r.status_code == 422
    assert r.json()["detail"] == "Linha 2: registro inválido."


def test_usuario_alheio_com_lote_invalido_recebe_403_antes_da_validacao(api, usinas):
    # Membership é checada antes da validação de linha: não-membro não ganha pista sobre as linhas.
    usinas.db["user_usinas"] = {}
    lote = {"usina_id": USINA, "safra": "2026/27", "posicoes": [_pos(volume=0)]}
    r = api.post("/api/posicoes/lote", json=lote)
    assert r.status_code == 403


def test_lote_com_erro_nao_grava_nenhuma_linha(api, usinas):
    lote = {"usina_id": USINA, "safra": "2026/27", "posicoes": [_pos(), _pos(preco_fixado=-1)]}
    assert api.post("/api/posicoes/lote", json=lote).status_code == 422
    assert "posicoes" not in usinas.db


# ── PEN-11 e PEN-12: mínimo de 100 cenários no MC Pricer ────────────────────────

MC = {"F": 20, "K": 21, "T": 1, "r": 0.10, "sigma": 0.30}


def test_mc_com_menos_de_100_cenarios_responde_422(api):
    for n in (1, 99):
        r = api.post("/api/options/mc-price", json={**MC, "num_simulacoes": n})
        assert r.status_code == 422, n


def test_mc_com_100_cenarios_responde_200(api):
    r = api.post("/api/options/mc-price", json={**MC, "num_simulacoes": 100})
    assert r.status_code == 200
    assert r.json()["price"] > 0


# ── PEN-07: heatmap de Metas centrado no último fechamento ─────────────────────

def _ultimo_pregao(ate: date) -> date:
    d = ate
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def test_metas_eixos_tem_o_ultimo_fechamento_no_centro(api, yahoo, monkeypatch):
    # Preço depende do dia: o último fechamento é distinto dos anteriores e dá para conferir.
    sb = FakeYahoo(preco=lambda d: 18.0 + d.day / 100)
    usd = FakeYahoo(preco=lambda d: 5.0 + d.day / 100)
    fakes = {"SB=F": sb, "USDBRL=X": usd}
    monkeypatch.setattr(market_cache, "_fetch_from_yfinance", lambda t, s, e: fakes[t](t, s, e))

    r = api.get("/api/metas", params={"meta": 2600})
    assert r.status_code == 200
    corpo = r.json()

    ultimo = _ultimo_pregao(date.today())
    assert len(corpo["acucares"]) == 11 and len(corpo["dolares"]) == 11
    assert corpo["acucares"][5] == pytest.approx(round(18.0 + ultimo.day / 100, 2))
    assert corpo["dolares"][5] == pytest.approx(round(5.0 + ultimo.day / 100, 2))
    assert corpo["acucares"] == sorted(corpo["acucares"], reverse=True)
    assert corpo["dolares"] == sorted(corpo["dolares"])
