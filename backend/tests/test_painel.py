"""painel-hoje (PNL-02, PNL-07, A-1, A-3): seções independentes, preço fora não zera o % fixado, datas."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi import HTTPException

import routers.painel as painel

BRT = ZoneInfo("America/Sao_Paulo")


@pytest.fixture
def secoes_ok(monkeypatch):
    monkeypatch.setattr(painel, "secao_faixa_dolar", lambda hoje: {"p50": 5.1})
    monkeypatch.setattr(painel, "secao_alertas", lambda user, agora: {"ativos": 0, "disparados": []})
    monkeypatch.setattr(painel, "secao_posicoes", lambda user, hoje: [])
    monkeypatch.setattr(painel, "secao_analises", lambda user: [])


def test_falha_de_uma_secao_devolve_as_outras(api, secoes_ok, monkeypatch):
    def quebra(hoje):
        raise HTTPException(status_code=503, detail="Sem dados do câmbio.")

    monkeypatch.setattr(painel, "secao_faixa_dolar", quebra)
    r = api.get("/api/painel/hoje")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["faixa_dolar"] == {"dados": None, "motivo": "Sem dados do câmbio."}
    assert corpo["alertas"] == {"dados": {"ativos": 0, "disparados": []}, "motivo": None}
    assert corpo["posicoes"] == {"dados": [], "motivo": None}
    assert corpo["analises"] == {"dados": [], "motivo": None}


def test_erro_inesperado_vira_motivo_generico(api, secoes_ok, monkeypatch):
    def explode(user, agora):
        raise RuntimeError("detalhe interno que não deve vazar")

    monkeypatch.setattr(painel, "secao_alertas", explode)
    corpo = api.get("/api/painel/hoje").json()
    assert corpo["alertas"] == {"dados": None, "motivo": painel.MSG_GENERICA}
    assert "detalhe interno" not in corpo["alertas"]["motivo"]


def _seed_usina_com_posicao(supa):
    supa.table("user_usinas").insert({"user_id": "u1", "usina_id": "u-a"}).execute()
    supa.table("posicoes").insert({
        "usina_id": "u-a", "safra": "2026/27", "instrumento": "fixacao_acucar",
        "volume": 1000, "preco_fixado": 15, "cambio_fixado": 5.0, "premio": 0,
    }).execute()
    supa.table("politica_hedge").insert({
        "usina_id": "u-a", "safra": "2026/27", "producao_estimada_t": 10000,
        "minimo_pct": 50, "maximo_pct": 80,
    }).execute()


def test_preco_fora_mantem_percentual_e_status_sem_mtm(supa, monkeypatch):
    _seed_usina_com_posicao(supa)

    def sem_preco(ticker):
        raise HTTPException(status_code=503, detail="Sem preço do açúcar.")

    monkeypatch.setattr(painel, "_ultimo_fechamento", sem_preco)
    (a,) = painel.secao_posicoes({"id": "u1"}, date(2026, 11, 19))
    assert a["status"] == "abaixo" and a["pct_fixado"] == 10.0
    assert a["mtm_total_rs"] is None
    assert a["aviso"] == painel.AVISO_PRECO
    assert a["motivo"] is None


def test_com_preco_traz_mtm_e_status(supa, monkeypatch):
    _seed_usina_com_posicao(supa)
    monkeypatch.setattr(painel, "_ultimo_fechamento", lambda ticker: (20.0, "2026-11-18"))
    (a,) = painel.secao_posicoes({"id": "u1"}, date(2026, 11, 19))
    assert a["status"] == "abaixo" and a["pct_fixado"] == 10.0
    assert a["mtm_total_rs"] is not None and a["aviso"] is None


def test_usuario_sem_usina_recebe_lista_vazia(supa):
    assert painel.secao_posicoes({"id": "u-sem-usina"}, date(2026, 11, 19)) == []


@pytest.mark.parametrize("hoje, esperado", [
    (date(2026, 11, 19), "2026/27"),
    (date(2027, 3, 31), "2026/27"),
    (date(2027, 4, 1), "2027/28"),
])
def test_safra_comeca_em_abril(hoje, esperado):
    assert painel._safra_atual(hoje) == esperado


@pytest.mark.parametrize("agora, esperado", [
    (datetime(2026, 11, 23, 9, tzinfo=BRT), date(2026, 11, 20)),  # segunda: sexta anterior
    (datetime(2026, 11, 21, 12, tzinfo=BRT), date(2026, 11, 20)),  # sábado
    (datetime(2026, 11, 19, 12, tzinfo=BRT), date(2026, 11, 18)),  # quinta: quarta
])
def test_ultimo_dia_util_pula_fim_de_semana(agora, esperado):
    assert painel._ultimo_dia_util(agora) == esperado


def test_falha_so_no_dolar_zera_o_mtm_e_nao_quebra_a_usina(supa, monkeypatch):
    """O açúcar sai e o dólar falha: sb não pode vazar sozinho para resumo_safra (fx None)."""
    _seed_usina_com_posicao(supa)

    def so_dolar_falha(ticker):
        if ticker == "USDBRL=X":
            raise HTTPException(status_code=503, detail="Sem preço do dólar.")
        return 20.0, "2026-11-18"

    monkeypatch.setattr(painel, "_ultimo_fechamento", so_dolar_falha)
    (a,) = painel.secao_posicoes({"id": "u1"}, date(2026, 11, 19))
    assert a["motivo"] is None
    assert a["status"] == "abaixo" and a["pct_fixado"] == 10.0
    assert a["mtm_total_rs"] is None
    assert a["aviso"] == painel.AVISO_PRECO
