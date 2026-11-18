"""ANA-02: API de análises salvas — dono, limites de tamanho e paginação."""
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi.errors import RateLimitExceeded

import routers.analises as analises
from auth import get_current_user

EU = "user-eu"
OUTRO = "user-outro"


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db, op="select", payload=None):
        self.db, self.op, self.payload = db, op, payload
        self.filtros, self.ordem, self.faixa = [], None, None

    def select(self, *_):
        return self

    def eq(self, k, v):
        self.filtros.append((k, v))
        return self

    def order(self, k, desc=False):
        self.ordem = k
        return self

    def range(self, a, b):
        self.faixa = (a, b)
        return self

    def insert(self, linha):
        self.op, self.payload = "insert", linha
        return self

    def update(self, campos):
        self.op, self.payload = "update", campos
        return self

    def delete(self):
        self.op = "delete"
        return self

    def _casa(self, r):
        return all(r.get(k) == v for k, v in self.filtros)

    def execute(self):
        linhas = self.db.setdefault("analises", [])
        if self.op == "insert":
            nova = {"id": str(uuid.uuid4()), "created_at": "2026-11-18T00:00:00Z", **self.payload}
            linhas.append(nova)
            return _Resp([nova])
        alvo = [r for r in linhas if self._casa(r)]
        if self.op == "update":
            for r in alvo:
                r.update(self.payload)
            return _Resp(alvo)
        if self.op == "delete":
            for r in alvo:
                linhas.remove(r)
            return _Resp(alvo)
        return _Resp(alvo)


class _Supa:
    def __init__(self):
        self.db = {}

    def table(self, _nome):
        return _Query(self.db)


@pytest.fixture
def cliente(monkeypatch):
    supa = _Supa()
    monkeypatch.setattr(analises, "supa_client", lambda: supa)
    analises.limiter.reset()  # contadores de taxa não vazam entre testes
    app = FastAPI()
    app.state.limiter = analises.limiter
    app.include_router(analises.router)
    app.dependency_overrides[get_current_user] = lambda: {"id": EU}
    cli = TestClient(app)
    cli.supa = supa
    return cli


def _corpo(**extra):
    base = {
        "ferramenta": "var",
        "titulo": "VaR 95% jan",
        "parametros": {"confianca": 0.95},
        "resultado_resumo": {"perda": 1.2, "leitura": "Frase."},
        "data_referencia": "2026-11-17",
    }
    base.update(extra)
    return base


def test_criar_e_ler_a_propria_analise(cliente):
    r = cliente.post("/api/analises", json=_corpo())
    assert r.status_code == 201
    id_ = r.json()["id"]
    assert cliente.get(f"/api/analises/{id_}").json()["titulo"] == "VaR 95% jan"


def test_parametros_acima_de_4kb_viram_422(cliente):
    r = cliente.post("/api/analises", json=_corpo(parametros={"x": "a" * 5000}))
    assert r.status_code == 422


def test_resumo_acima_de_8kb_viram_422(cliente):
    r = cliente.post("/api/analises", json=_corpo(resultado_resumo={"x": "a" * 9000}))
    assert r.status_code == 422


def test_leitura_e_cortada_em_500_caracteres(cliente):
    r = cliente.post("/api/analises", json=_corpo(resultado_resumo={"leitura": "b" * 800}))
    assert r.status_code == 201
    assert len(r.json()["resultado_resumo"]["leitura"]) == 500


def test_titulo_so_com_espacos_e_recusado(cliente):
    assert cliente.post("/api/analises", json=_corpo(titulo="   ")).status_code == 422


def test_titulo_com_mais_de_120_caracteres_e_recusado(cliente):
    assert cliente.post("/api/analises", json=_corpo(titulo="x" * 121)).status_code == 422


def test_ferramenta_fora_da_lista_e_recusada(cliente):
    assert cliente.post("/api/analises", json=_corpo(ferramenta="arima")).status_code == 422


def test_id_invalido_vira_422_nao_500(cliente):
    assert cliente.get("/api/analises/nao-e-uuid").status_code == 422


def test_limit_acima_de_100_e_recusado(cliente):
    assert cliente.get("/api/analises?limit=101").status_code == 422


def test_listar_filtra_por_ferramenta(cliente):
    cliente.post("/api/analises", json=_corpo())
    cliente.post("/api/analises", json=_corpo(ferramenta="opcoes", titulo="Payoff"))
    r = cliente.get("/api/analises?ferramenta=opcoes").json()["analises"]
    assert [a["ferramenta"] for a in r] == ["opcoes"]


def test_outro_usuario_recebe_404_em_ler_renomear_e_excluir(cliente):
    id_ = cliente.post("/api/analises", json=_corpo()).json()["id"]
    cliente.app.dependency_overrides[get_current_user] = lambda: {"id": OUTRO}
    assert cliente.get(f"/api/analises/{id_}").status_code == 404
    assert cliente.patch(f"/api/analises/{id_}", json={"titulo": "Roubo"}).status_code == 404
    assert cliente.delete(f"/api/analises/{id_}").status_code == 404
    assert cliente.supa.db["analises"][0]["titulo"] == "VaR 95% jan"


def test_renomear_e_excluir_a_propria(cliente):
    id_ = cliente.post("/api/analises", json=_corpo()).json()["id"]
    assert cliente.patch(f"/api/analises/{id_}", json={"titulo": "Novo"}).json()["titulo"] == "Novo"
    assert cliente.delete(f"/api/analises/{id_}").json() == {"ok": True}
    assert cliente.get(f"/api/analises/{id_}").status_code == 404


def test_espacos_nas_pontas_nao_contam_no_limite_de_120(cliente):
    r = cliente.post("/api/analises", json=_corpo(titulo="  " + "x" * 120 + "  "))
    assert r.status_code == 201
    assert len(r.json()["titulo"]) == 120
