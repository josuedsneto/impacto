"""POS-01 a POS-05 e POS-09: posições, MTM, resumo e política de hedge."""
import pandas as pd
import pytest

import main  # noqa: F401  # routers.posicoes importa limiter de main: main tem de ser importado primeiro
import market_cache
from conftest import dias_uteis
from routers.posicoes import FATOR, calcular_mtm, resumo_safra

USINA = "11111111-1111-1111-1111-111111111111"
ALHEIA = "22222222-2222-2222-2222-222222222222"


def _pos(**kw):
    base = {"instrumento": "fixacao_acucar", "volume": 1000.0, "preco_fixado": 20.0,
            "cambio_fixado": 5.0, "premio": 0.0}
    return {**base, **kw}


# ── Cálculos puros ──────────────────────────────────────────────────────────────

def test_mtm_venda_acucar_bate_com_conta_a_mao():
    # (20 − 18) ¢/lb × 22,0462 × 1,04 × 5 × 1000 t
    assert calcular_mtm(_pos(), sb=18.0, fx=5.0) == pytest.approx(229280.48, abs=0.01)


def test_mtm_put_fora_do_dinheiro_e_so_o_premio():
    p = _pos(instrumento="opcao_acucar", preco_fixado=15.0, premio=0.5)
    assert calcular_mtm(p, sb=18.0, fx=5.0) == pytest.approx(-0.5 * FATOR * 5.0 * 1000)


def test_mtm_ndf_dolar_vendido():
    p = _pos(instrumento="ndf_dolar", volume=500000.0, preco_fixado=5.20)
    assert calcular_mtm(p, sb=18.0, fx=5.00) == pytest.approx(100000.0)


def test_pct_fixado_so_conta_acucar_e_status_abaixo():
    pos = [_pos(volume=1000.0), _pos(instrumento="ndf_dolar", volume=9e6)]
    pol = {"minimo_pct": 40, "maximo_pct": 60, "producao_estimada_t": 4000}
    r = resumo_safra(pos, pol, sb=18.0, fx=5.0)
    assert r["pct_fixado"] == 25.0
    assert r["status"] == "abaixo"


def test_status_dentro_e_acima():
    pol = {"minimo_pct": 40, "maximo_pct": 60, "producao_estimada_t": 1000}
    assert resumo_safra([_pos(volume=500)], pol, 18.0, 5.0)["status"] == "dentro"
    assert resumo_safra([_pos(volume=700)], pol, 18.0, 5.0)["status"] == "acima"


def test_sem_politica_ou_sem_producao():
    assert resumo_safra([_pos()], None, 18.0, 5.0)["status"] == "sem_politica"
    sem_prod = {"minimo_pct": 40, "maximo_pct": 60, "producao_estimada_t": None}
    r = resumo_safra([_pos()], sem_prod, 18.0, 5.0)
    assert r["status"] == "sem_producao" and r["pct_fixado"] is None


def test_preco_medio_ignora_opcao_e_posicao_sem_cambio():
    pos = [
        _pos(volume=1000.0, preco_fixado=20.0),
        _pos(instrumento="futuro_acucar", volume=1000.0, preco_fixado=22.0, cambio_fixado=None),
        _pos(instrumento="opcao_acucar", volume=1000.0, preco_fixado=10.0),  # strike: fora da média
    ]
    r = resumo_safra(pos, None, 18.0, 5.0)
    assert r["preco_medio_cents_lb"] == 21.0
    assert r["preco_medio_rs_t"] == pytest.approx(20.0 * FATOR * 5.0, abs=0.01)
    assert len(r["avisos"]) == 1


def test_sem_posicoes_preco_medio_nulo():
    r = resumo_safra([], None, None, None)
    assert r["preco_medio_cents_lb"] is None and r["mtm_total_rs"] == 0 and r["pct_fixado"] is None


# ── Endpoints ───────────────────────────────────────────────────────────────────

@pytest.fixture
def usinas(supa):
    supa.db["user_usinas"] = {
        ("u1", USINA): {"user_id": "u1", "usina_id": USINA},
        ("outro", ALHEIA): {"user_id": "outro", "usina_id": ALHEIA},
    }
    return supa


def _corpo(**kw):
    return {"usina_id": USINA, "safra": "2026/27", "instrumento": "fixacao_acucar",
            "volume": 1000, "preco_fixado": 20, "cambio_fixado": 5, **kw}


def test_criar_grava_criado_por_do_servidor(api, usinas):
    r = api.post("/api/posicoes", json=_corpo(criado_por="outro"))
    assert r.status_code == 201
    linha = list(usinas.db["posicoes"].values())[0]
    assert linha["criado_por"] == "u1"
    assert "unidade" not in linha


def test_criar_em_usina_alheia_responde_403(api, usinas):
    assert api.post("/api/posicoes", json=_corpo(usina_id=ALHEIA)).status_code == 403


@pytest.mark.parametrize("ajuste", [
    {"instrumento": "outro"},
    {"volume": 0},
    {"preco_fixado": -1},
    {"safra": "2026-27"},
])
def test_validacao_responde_422(api, usinas, ajuste):
    assert api.post("/api/posicoes", json=_corpo(**ajuste)).status_code == 422


def test_lote_acima_de_500_responde_422(api, usinas):
    lote = {"usina_id": USINA, "safra": "2026/27", "posicoes": [
        {"instrumento": "fixacao_acucar", "volume": 1, "preco_fixado": 20}] * 501}
    assert api.post("/api/posicoes/lote", json=lote).status_code == 422


def test_lote_insere_tudo_com_safra_do_topo(api, usinas):
    lote = {"usina_id": USINA, "safra": "2026/27", "posicoes": [
        {"instrumento": "fixacao_acucar", "volume": 1000, "preco_fixado": 20},
        {"instrumento": "ndf_dolar", "volume": 500000, "preco_fixado": 5.2}]}
    r = api.post("/api/posicoes/lote", json=lote)
    assert r.status_code == 201 and r.json() == {"inseridas": 2}
    assert {p["safra"] for p in usinas.db["posicoes"].values()} == {"2026/27"}


def test_editar_e_apagar_posicao_alheia_responde_404(api, usinas):
    usinas.db["posicoes"] = {"99999999-9999-9999-9999-999999999999": {"id": "99999999-9999-9999-9999-999999999999", "usina_id": ALHEIA, "safra": "2026/27",
                                     "instrumento": "fixacao_acucar", "volume": 1, "preco_fixado": 1}}
    assert api.put("/api/posicoes/99999999-9999-9999-9999-999999999999", json={**_corpo(), "usina_id": USINA}).status_code == 404
    assert api.delete("/api/posicoes/99999999-9999-9999-9999-999999999999").status_code == 404
    assert "99999999-9999-9999-9999-999999999999" in usinas.db["posicoes"]


def test_editar_e_apagar_posicao_propria(api, usinas):
    api.post("/api/posicoes", json=_corpo())
    pid = list(usinas.db["posicoes"].values())[0]["id"]
    assert api.put(f"/api/posicoes/{pid}", json=_corpo(volume=2000)).status_code == 200
    assert usinas.db["posicoes"][pid]["volume"] == 2000
    assert api.delete(f"/api/posicoes/{pid}").status_code == 200
    assert usinas.db["posicoes"] == {}


def test_resumo_sem_posicoes_nao_busca_preco(api, usinas, yahoo):
    r = api.get("/api/posicoes/resumo", params={"usina_id": USINA, "safra": "2026/27"})
    assert r.status_code == 200
    assert r.json()["preco_medio_cents_lb"] is None and r.json()["sb_fechamento"] is None
    assert yahoo.chamadas == []


def test_resumo_com_posicao_marca_contra_fechamento(api, usinas, yahoo, monkeypatch):
    precos = {"SB=F": 18.0, "USDBRL=X": 5.0}
    fakes = {}

    def por_ticker(ticker, start, end):
        fakes.setdefault(ticker, _por_preco(precos[ticker]))
        return fakes[ticker](ticker, start, end)

    monkeypatch.setattr(market_cache, "_fetch_from_yfinance", por_ticker)
    api.post("/api/posicoes", json=_corpo())
    api.put("/api/politica-hedge", json={"usina_id": USINA, "safra": "2026/27",
                                          "minimo_pct": 40, "maximo_pct": 60, "producao_estimada_t": 4000})
    r = api.get("/api/posicoes/resumo", params={"usina_id": USINA, "safra": "2026/27"})
    corpo = r.json()
    assert r.status_code == 200
    assert corpo["sb_fechamento"] == 18.0 and corpo["usdbrl_fechamento"] == 5.0
    assert corpo["mtm_total_rs"] == pytest.approx(229280.48, abs=0.01)
    assert corpo["pct_fixado"] == 25.0 and corpo["status"] == "abaixo"
    assert corpo["posicoes"][0]["unidade"] == "t"


def test_resumo_sem_preco_responde_503(api, usinas, yahoo):
    api.post("/api/posicoes", json=_corpo())
    yahoo.falhar = True
    r = api.get("/api/posicoes/resumo", params={"usina_id": USINA, "safra": "2026/27"})
    assert r.status_code == 503
    assert "SB=F" in r.json()["detail"]


def test_politica_upsert_substitui_e_valida_faixa(api, usinas):
    url = "/api/politica-hedge"
    base = {"usina_id": USINA, "safra": "2026/27", "producao_estimada_t": 4000}
    assert api.put(url, json={**base, "minimo_pct": 40, "maximo_pct": 60}).status_code == 200
    assert api.put(url, json={**base, "minimo_pct": 50, "maximo_pct": 70}).status_code == 200
    assert api.get(url, params={"usina_id": USINA, "safra": "2026/27"}).json()["minimo_pct"] == 50
    assert api.put(url, json={**base, "minimo_pct": 80, "maximo_pct": 20}).status_code == 422


def test_id_que_nao_e_uuid_responde_422_e_nao_500(api, usinas):
    assert api.get("/api/posicoes/resumo", params={"usina_id": "abc", "safra": "2026/27"}).status_code == 422
    assert api.delete("/api/posicoes/abc").status_code == 422


def test_volume_fora_do_limite_ou_infinito_responde_422(api, usinas):
    assert api.post("/api/posicoes", json=_corpo(volume=1e20)).status_code == 422
    assert api.post("/api/posicoes", content=b'{"usina_id":"usina-1"}', headers={"Content-Type": "application/json"}).status_code == 422


def _por_preco(valor):
    """Yahoo fake com preço constante, no formato de market_cache._fetch_from_yfinance."""
    def f(ticker, start, end):
        dias = list(dias_uteis(start, end))
        if not dias:
            return pd.DataFrame()
        return pd.DataFrame({"ticker": ticker, "date": dias, "open": [valor] * len(dias),
                             "high": [valor] * len(dias), "low": [valor] * len(dias),
                             "close": [valor] * len(dias), "volume": [0] * len(dias)})
    return f
