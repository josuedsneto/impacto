"""POS-V2-06 e POS-V2-07: exposicao_aberta (função pura) com carteira sintética, e os endpoints de posições v2."""
import pytest

import main  # noqa: F401  # routers.posicoes importa limiter de main
from exposicao import FATOR, exposicao_aberta
from routers import posicoes as rp

USINA = "11111111-1111-1111-1111-111111111111"
ALHEIA = "22222222-2222-2222-2222-222222222222"


def _p(instrumento, volume, preco=20.0, cambio=None, premio=0.0, tipo=None):
    return {"instrumento": instrumento, "volume": volume, "preco_fixado": preco,
            "cambio_fixado": cambio, "premio": premio, "tipo_opcao": tipo}


def _carteira():
    return [
        _p("fixacao_acucar", 1000.0, preco=20.0),                 # sem câmbio: entra na receita em US$
        _p("futuro_acucar", 500.0, preco=22.0, cambio=5.0),       # câmbio fixado: já está em R$, sai da receita
        _p("fixacao_acucar", 300.0, preco=21.0, cambio=5.5),
        _p("ndf_dolar", 200000.0, preco=5.2),
        _p("opcao_dolar", 100000.0, preco=5.0, tipo="put"),
        _p("opcao_dolar", 50000.0, preco=5.5, tipo="call"),       # call de dólar não protege
        _p("opcao_acucar", 400.0, preco=15.0, premio=0.5),
        _p("opcao_acucar", 999.0, preco=17.0, tipo="call"),       # call de açúcar não conta no %
    ]


def test_carteira_sintetica_bate_com_a_conta_a_mao():
    r = exposicao_aberta(_carteira(), producao_t=4000.0, sb_cents_lb=18.0)
    # açúcar que conta: 1000 + 500 + 300 + 400 = 2200 t (a call de 999 t fica de fora)
    assert r["pct_fixado"] == 55.0
    # travado (fixação + futuro): 1000 + 500 + 300 = 1800 t
    assert r["pct_travado"] == 45.0
    # só a fixação com câmbio (500 + 300 t) tem preço em R$/t
    assert r["pct_travado_rs"] == 20.0
    assert r["acucar_aberto_t"] == 1800.0
    # receita: só a fixação sem câmbio (1000 t a 20) + restante (4000 − 1800 = 2200 t a 18), × FATOR
    assert r["receita_usd_estimada"] == pytest.approx((1000 * 20 + 2200 * 18) * FATOR, abs=0.01)
    # dólar protegido: NDF 200 mil + put 100 mil; a call de 50 mil não entra
    assert r["usd_protegido"] == 300000.0
    assert r["usd_aberto"] == pytest.approx((1000 * 20 + 2200 * 18) * FATOR - 300000.0, abs=0.01)
    assert r["preco_medio_cents_lb"] == 20.72
    assert r["preco_medio_rs_t"] == pytest.approx(FATOR * (22 * 5 * 500 + 21 * 5.5 * 300) / 800, abs=0.01)
    assert any("sem câmbio fixado" in a for a in r["avisos"])


def test_sem_producao_nao_calcula_pct_nem_dolar_em_aberto():
    r = exposicao_aberta(_carteira(), producao_t=None, sb_cents_lb=18.0)
    assert r["pct_fixado"] is None and r["usd_aberto"] is None and r["receita_usd_estimada"] is None
    assert r["usd_protegido"] == 300000.0  # o protegido não depende de produção
    assert any("Sem produção" in a for a in r["avisos"])


def test_sem_posicoes_receita_e_producao_vezes_sb():
    r = exposicao_aberta([], producao_t=4000.0, sb_cents_lb=18.0)
    assert r["receita_usd_estimada"] == pytest.approx(4000 * 18 * FATOR, abs=0.01)
    assert r["usd_aberto"] == r["receita_usd_estimada"]
    assert r["pct_fixado"] == 0.0 and r["preco_medio_cents_lb"] is None


def test_dolar_protegido_maior_que_receita_zera_em_vez_de_negativar():
    r = exposicao_aberta([_p("ndf_dolar", 1e9, preco=5.0)], producao_t=1000.0, sb_cents_lb=18.0)
    assert r["usd_aberto"] == 0.0


def test_produção_menor_que_fixado_zera_o_aberto_em_toneladas():
    r = exposicao_aberta([_p("fixacao_acucar", 5000.0, preco=20.0)], producao_t=4000.0, sb_cents_lb=18.0)
    assert r["acucar_aberto_t"] == 0.0
    assert r["pct_fixado"] == 125.0
    assert r["receita_usd_estimada"] == pytest.approx(5000 * 20 * FATOR, abs=0.01)


def test_sem_sb_nao_ha_receita():
    r = exposicao_aberta([_p("fixacao_acucar", 1000.0)], producao_t=4000.0, sb_cents_lb=None)
    assert r["receita_usd_estimada"] is None and r["usd_aberto"] is None


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


def test_tipo_opcao_em_fixacao_responde_422(api, usinas):
    assert api.post("/api/posicoes", json=_corpo(tipo_opcao="put")).status_code == 422


def test_tipo_opcao_invalido_responde_422(api, usinas):
    body = _corpo(instrumento="opcao_dolar", tipo_opcao="straddle", cambio_fixado=None)
    assert api.post("/api/posicoes", json=body).status_code == 422


def test_opcao_com_tipo_call_e_gravada(api, usinas):
    body = _corpo(instrumento="opcao_dolar", tipo_opcao="call", cambio_fixado=None, premio=0.1)
    assert api.post("/api/posicoes", json=body).status_code == 201
    assert list(usinas.db["posicoes"].values())[0]["tipo_opcao"] == "call"


def test_exposicao_de_usina_alheia_responde_403(api, usinas):
    r = api.get("/api/posicoes/exposicao", params={"usina_id": ALHEIA, "safra": "2026/27"})
    assert r.status_code == 403


def test_exposicao_endpoint_usa_a_conta_unica(api, usinas):
    usinas.db["posicoes"] = {("x",): {**_corpo(), "id": "x", "criado_por": "u1", "created_at": "2026-11-01"}}
    usinas.db["politica_hedge"] = {(USINA, "2026/27"): {
        "usina_id": USINA, "safra": "2026/27", "producao_estimada_t": 4000, "minimo_pct": None, "maximo_pct": None}}
    r = api.get("/api/posicoes/exposicao", params={"usina_id": USINA, "safra": "2026/27"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["pct_fixado"] == 25.0
    assert corpo["sb_fechamento"] == 20.0  # FakeYahoo devolve 20 para todo ticker
    # cambio_fixado preenchido: a fixação sai da receita em US$; restante 3000 t a 20
    assert corpo["receita_usd_estimada"] == pytest.approx(3000 * 20 * FATOR, abs=0.01)


def test_resumo_com_opcao_sem_vencimento_cai_no_intrinseco_sem_500(api, usinas, monkeypatch):
    # Sem rede: histórico e juros indisponíveis. A resposta tem de ser 200 com aviso.
    def sem_historico(hoje):
        raise rp.HTTPException(status_code=503, detail="sem dados")

    monkeypatch.setattr(rp, "serie_fx", sem_historico)
    monkeypatch.setattr(rp, "juros_em", lambda ts: (None, None))
    usinas.db["posicoes"] = {("y",): {**_corpo(instrumento="opcao_dolar", cambio_fixado=None, premio=0.1,
                                              preco_fixado=5.5, tipo_opcao="put"), "id": "y", "criado_por": "u1", "created_at": "2026-11-01"}}
    r = api.get("/api/posicoes/resumo", params={"usina_id": USINA, "safra": "2026/27"})
    assert r.status_code == 200
    linha = r.json()["posicoes"][0]
    assert linha["modelo"] == "intrinseco" and linha["aviso"]
