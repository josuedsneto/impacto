"""HARD-01 a HARD-12: validações, erro 500 controlado, constantes, heatmap e jump-diffusion."""
import importlib
import math
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

import constantes
import main
from routers import simulacoes

ADMIN = {"id": "adm", "email": "a@x.com", "role": "admin"}


DOMINIOS = ["conta", "opcoes", "regressao", "simulacoes", "atr_usinas", "admin", "mercado", "risco"]


def _modulos_com_supa():
    """Cada módulo que importa supa_client por nome precisa do fake (main e constantes incluídos)."""
    mods = [main, constantes]
    for dominio in DOMINIOS:
        try:
            mods.append(importlib.import_module(f"routers.{dominio}"))
        except ModuleNotFoundError:
            pass  # domínio ainda não migrado
    return [m for m in mods if hasattr(m, "supa_client")]


@pytest.fixture(autouse=True)
def _supa_do_main(supa, monkeypatch):
    """Módulos importam supa_client por nome: troca em cada um, além do market_cache."""
    for mod in _modulos_com_supa():
        monkeypatch.setattr(mod, "supa_client", lambda: supa)


@pytest.fixture
def admin(api):
    main.app.dependency_overrides[main.require_admin] = lambda: ADMIN
    yield api
    main.app.dependency_overrides.pop(main.require_admin, None)


def _precos_recentes(valor_acucar: float, valor_dolar: float):
    hoje = date.today()
    dias = [hoje - timedelta(days=i) for i in range(14)]
    sb = [{"date": d.isoformat(), "close": valor_acucar} for d in sorted(dias)]
    usd = [{"date": d.isoformat(), "close": valor_dolar} for d in sorted(dias)]
    return {"SB=F": sb, "USDBRL=X": usd}


# ── HARD-01 / HARD-06: validação de entradas ────────────────────────────────────

def test_indicador_fora_da_faixa_responde_422(api, yahoo):
    yahoo.preco = lambda d: 20.0
    ini, fim = date.today() - timedelta(days=400), date.today()
    r = api.get("/api/market/analysis", params={"ticker": "SB=F", "start": ini, "end": fim, "sma_periods": "0"})
    assert r.status_code == 422
    assert r.json()["detail"] == "Cada média SMA deve estar entre 2 e 250."


def test_macd_rapido_maior_responde_422(api, yahoo):
    ini, fim = date.today() - timedelta(days=400), date.today()
    r = api.get("/api/market/analysis", params={"ticker": "SB=F", "start": ini, "end": fim, "macd_fast": 30, "macd_slow": 26})
    assert r.status_code == 422
    assert r.json()["detail"] == "O MACD rápido deve ser menor que o lento."


def test_mais_de_cinco_medias_responde_422(api, yahoo):
    ini, fim = date.today() - timedelta(days=400), date.today()
    r = api.get("/api/market/analysis", params={"ticker": "SB=F", "start": ini, "end": fim, "ema_periods": "2,3,4,5,6,7"})
    assert r.status_code == 422


def test_periodo_acima_de_25_anos_responde_422(api, yahoo):
    r = api.get("/api/market/prices", params={"ticker": "SB=F", "start": "1900-01-01", "end": "2026-01-01"})
    assert r.status_code == 422


def test_limit_zero_responde_422(api):
    r = api.get("/api/simulations", params={"limit": 0})
    assert r.status_code == 422
    assert r.json()["detail"] == "O limite deve estar entre 1 e 200."


def test_confianca_do_var_fora_da_faixa_responde_422(api, yahoo):
    r = api.get("/api/var", params={"ticker": "SB=F", "confidence": 0.9999})
    assert r.status_code == 422


def test_opcao_de_cenario_invalida_responde_422(api):
    r = api.post("/api/cenarios/save", json={"opcao": "Inventada", "breakeven": 1, "probabilidade_abaixo": 0.5, "media": 1, "std": 1})
    assert r.status_code == 422


def test_payoff_sem_pernas_responde_422(api):
    r = api.post("/api/options/payoff", json={"legs": []})
    assert r.status_code == 422


# ── HARD-02: handler global e entradas que antes davam 500 ─────────────────────

def test_excecao_nao_tratada_vira_500_em_portugues_com_cors(supa, monkeypatch):
    def quebra(*_a, **_k):
        raise RuntimeError("segredo interno")

    monkeypatch.setattr(main, "get_prices", quebra)
    main.limiter.enabled = False
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": "u1", "email": "u@x.com", "role": "user"}
    cliente = TestClient(main.app, raise_server_exceptions=False)
    try:
        r = cliente.get("/api/breakeven", headers={"Origin": "http://localhost:3000"})
    finally:
        main.app.dependency_overrides.clear()
    assert r.status_code == 500
    corpo = r.json()["detail"]
    assert corpo.startswith("Erro inesperado. Se persistir, informe o código ")
    assert "segredo interno" not in r.text
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert r.headers["x-request-id"] in corpo


def test_breakeven_ignora_fechamento_nulo(supa, monkeypatch):
    dados = _precos_recentes(20.0, 5.0)
    dados["SB=F"].append({"date": date.today().isoformat(), "close": None})
    monkeypatch.setattr(main, "get_prices", lambda t, s, e: dados[t])
    main.limiter.enabled = False
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": "u1", "email": "u@x.com", "role": "user"}
    try:
        r = TestClient(main.app).get("/api/breakeven")
    finally:
        main.app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.json()["preco_acucar_cents_lb"] == 20.0


def test_risco_com_p15_maior_que_p85_responde_422(api):
    corpo = {"moagem": {"media": 1300000, "p15": 1600000, "p85": 1500000}}
    r = api.post("/api/risco", json=corpo)
    assert r.status_code == 422
    assert r.json()["detail"] == "Moagem: é preciso P15 < média < P85."


def test_risco_responde_valores_finitos(api):
    r = api.post("/api/risco", json={"num_simulacoes": 1000})
    assert r.status_code == 200
    assert all(v == v for v in [r.json()["ebitda"]["media"]])  # sem NaN


def test_health_devolve_request_id(api):
    r = api.get("/api/health")
    assert r.status_code == 200
    assert len(r.headers["x-request-id"]) >= 8


# ── HARD-03: lista completa de usuários ────────────────────────────────────────

class _Usuario:
    def __init__(self, n):
        self.id = f"id{n}"
        self.email = f"u{n:04d}@x.com"


class _AuthAdmin:
    def __init__(self, total):
        self.total, self.pedidos = total, []

    def list_users(self, page=None, per_page=None):
        self.pedidos.append(page)
        inicio = (page - 1) * per_page
        return [_Usuario(n) for n in range(inicio, min(self.total, inicio + per_page))]


class _Supa:
    def __init__(self, total):
        self.auth = type("A", (), {"admin": _AuthAdmin(total)})()


def test_todos_usuarios_percorre_todas_as_paginas():
    supa = _Supa(2005)
    usuarios = main._todos_usuarios(supa)
    assert len(usuarios) == 2005
    assert supa.auth.admin.pedidos == [1, 2, 3, 4]  # para na página vazia
    emails = [u.email for u in usuarios]
    assert emails == sorted(emails)


# ── HARD-04: constantes de negócio ─────────────────────────────────────────────

def test_constante_ausente_ou_invalida_usa_valor_do_codigo(supa):
    supa.db["admin_config"] = {("fator_conversao_mtm",): {"key": "fator_conversao_mtm", "value": "1.000.000"}}
    valores = main._ler_constantes("fator_conversao_mtm", "risco_custo_fixo_1")
    assert valores["fator_conversao_mtm"] == main.CONSTANTES_NEGOCIO["fator_conversao_mtm"][0]
    assert valores["risco_custo_fixo_1"] == main.CONSTANTES_NEGOCIO["risco_custo_fixo_1"][0]


def test_constante_lida_do_banco_aceita_virgula(supa):
    supa.db["admin_config"] = {("breakeven_fator_conversao",): {"key": "breakeven_fator_conversao", "value": "1,2"}}
    assert main._ler_constantes("breakeven_fator_conversao")["breakeven_fator_conversao"] == 1.2


def test_put_constante_nao_numerica_responde_422(admin):
    r = admin.put("/api/admin/config/risco_custo_fixo_1", json={"value": "abc"})
    assert r.status_code == 422
    assert r.json()["detail"] == "O valor de risco_custo_fixo_1 precisa ser numérico."


def test_put_constante_com_dois_separadores_responde_422(admin):
    r = admin.put("/api/admin/config/risco_custo_fixo_1", json={"value": "109.212,811"})
    assert r.status_code == 422


def test_put_constante_numerica_grava_com_ponto(admin):
    r = admin.put("/api/admin/config/risco_custo_fixo_1", json={"value": "1,5"})
    assert r.status_code == 200
    assert r.json()["value"] == "1.5"


# ── HARD-05: heatmap centrado no preço atual ───────────────────────────────────

def test_heatmap_centrado_no_ultimo_fechamento(api, monkeypatch):
    dados = _precos_recentes(18.0, 5.6)
    monkeypatch.setattr(main, "get_prices", lambda t, s, e: dados[t])
    r = api.get("/api/metas", params={"meta": 2600})
    assert r.status_code == 200
    corpo = r.json()
    assert len(corpo["acucares"]) == 11 and len(corpo["dolares"]) == 11
    assert corpo["acucares"][5] == 18.0
    assert corpo["dolares"][5] == 5.6
    assert corpo["acucares"] == sorted(corpo["acucares"], reverse=True)
    assert corpo["dolares"] == sorted(corpo["dolares"])
    assert corpo["heatmap"][5][5] == round(main.CONSTANTES_NEGOCIO["fator_conversao_mtm"][0] * 18.0 * 5.6 - 2600, 2)


def test_metas_sem_precos_recentes_responde_503(api, monkeypatch):
    dados = _precos_recentes(18.0, 5.6)
    antigos = [{**r, "date": "2020-01-0" + str(i % 9 + 1)} for i, r in enumerate(dados["SB=F"])]
    dados["SB=F"] = antigos
    monkeypatch.setattr(main, "get_prices", lambda t, s, e: dados[t])
    r = api.get("/api/metas")
    assert r.status_code == 503
    assert r.json()["detail"] == "Sem preços recentes para montar o mapa de metas."


# ── HARD-08/09: rate limit e 409 restrito ──────────────────────────────────────

def test_409_so_para_conflito_de_unicidade(admin, monkeypatch):
    class _Insere:
        def __init__(self, codigo):
            self.codigo = codigo

        def table(self, _):
            return self

        def insert(self, _):
            raise APIError({"message": "falha", "code": self.codigo, "hint": None, "details": None})

        def execute(self):
            return self

    monkeypatch.setattr(main, "supa_client", lambda: _Insere("23505"))
    assert admin.post("/api/admin/usinas", json={"nome": "Usina A"}).status_code == 409

    monkeypatch.setattr(main, "supa_client", lambda: _Insere("42501"))
    cliente = TestClient(main.app, raise_server_exceptions=False)
    assert cliente.post("/api/admin/usinas", json={"nome": "Usina B"}).status_code == 500


# ── HARD-12: jump-diffusion sem dupla contagem do drift ────────────────────────

def test_jump_diffusion_sem_saltos_segue_o_drift_em_log(api, monkeypatch):
    # Série com log-retorno médio pequeno e positivo; sem saltos, a média de log(P_T/P_0)
    # deve ser T·mu. Com a dupla contagem antiga (−σ²/2 extra) a média cairia ~ T·σ²/2.
    closes = [100.0 + (i % 2) for i in range(30)]
    linhas = [{"date": (date.today() - timedelta(days=i)).isoformat(), "close": c} for i, c in enumerate(closes)]
    monkeypatch.setattr(simulacoes, "get_prices", lambda t, s, e: linhas)
    T, rep = 252, 300
    somas, mu = [], None
    for _ in range(rep):
        r = api.post("/api/jump-diffusion", json={"ticker": "SB=F", "sigma": 0.02, "lambda_jumps": 0, "steps": T})
        assert r.status_code == 200
        corpo = r.json()
        mu = corpo["mu"]
        precos = [p["price"] for p in corpo["prices"]]
        assert len(precos) == T + 1
        somas.append(math.log(precos[-1] / precos[0]))
    media = sum(somas) / rep
    assert abs(media - T * mu) < 3 * (0.02 * T ** 0.5) / rep ** 0.5
