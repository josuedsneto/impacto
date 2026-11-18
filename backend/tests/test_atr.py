"""ATR-calibração: calibrate_atr, predict_atr e histórico (atr-calibracao)."""
import math
import uuid

import numpy as np
import pytest
import statsmodels.api as sm

import atr
from atr import AVISO_COLINEAR, AVISO_SETOR, calibrate_atr, get_sector_defaults, predict_atr

B0, B_CHUVA, B_IMP = 130.0, 0.12, -1.5


def _linhas(n: int, seed: int = 42, ruido: float = 2.0) -> list[dict]:
    rng = np.random.default_rng(seed)
    chuva = rng.uniform(50, 250, n)
    imp = rng.uniform(8, 16, n)
    atr_real = B0 + B_CHUVA * chuva + B_IMP * imp + rng.normal(0, ruido, n)
    return [
        {"chuva_mm": float(c), "impureza_pct": float(i), "atr_real": float(a)}
        for c, i, a in zip(chuva, imp, atr_real)
    ]


def test_recupera_coeficientes_com_ruido_dentro_do_ic():
    """Com 24 meses, o valor verdadeiro cai dentro do IC 95% dos coeficientes."""
    p = calibrate_atr(_linhas(24))
    assert p["calibracao"] == "usina"
    assert p["meses_usados"] == 24
    assert p["gl"] == 21
    erro_padrao = np.sqrt(np.diag(p["cov"]))
    t = 2.08  # t(0,975; 21)
    for est, erro, verdadeiro in zip(
        [p["intercept"], p["coef_chuva"], p["coef_impureza"]], erro_padrao, [B0, B_CHUVA, B_IMP]
    ):
        assert abs(est - verdadeiro) <= t * erro


def test_coeficientes_exatos_sem_ruido():
    linhas = _linhas(24, ruido=0.0)
    p = calibrate_atr(linhas)
    assert p["intercept"] == pytest.approx(B0, abs=1e-6)
    assert p["coef_chuva"] == pytest.approx(B_CHUVA, abs=1e-9)
    assert p["coef_impureza"] == pytest.approx(B_IMP, abs=1e-9)
    assert p["sigma"] == pytest.approx(0.0, abs=1e-6)


def test_sigma_usa_ssr_sobre_n_menos_3():
    """ATR-01: sigma = sqrt(SSR/(n-3)), não np.std (ddof=0)."""
    linhas = _linhas(20)
    p = calibrate_atr(linhas)
    X = np.column_stack([[h["chuva_mm"] for h in linhas], [h["impureza_pct"] for h in linhas]])
    X = sm.add_constant(X)
    y = np.array([h["atr_real"] for h in linhas])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    ssr = float(np.sum((y - X @ beta) ** 2))
    assert p["sigma"] == pytest.approx(math.sqrt(ssr / 17), rel=1e-9)


def test_intervalo_de_previsao_bate_com_statsmodels():
    """ATR-04/05: intervalo de 90% igual ao obs_ci de get_prediction(alpha=0.10)."""
    linhas = _linhas(24)
    p = calibrate_atr(linhas)
    x0 = (180.0, 11.0)
    X = sm.add_constant(np.column_stack([[h["chuva_mm"] for h in linhas], [h["impureza_pct"] for h in linhas]]))
    y = np.array([h["atr_real"] for h in linhas])
    frame = sm.OLS(y, X).fit().get_prediction(np.array([[1.0, *x0]])).summary_frame(alpha=0.10)
    r = predict_atr(x0[0], x0[1], p)
    assert r["atr_min"] == pytest.approx(frame["obs_ci_lower"].iloc[0], abs=1e-3)
    assert r["atr_max"] == pytest.approx(frame["obs_ci_upper"].iloc[0], abs=1e-3)
    assert r["atr_esperado"] == pytest.approx(frame["mean"].iloc[0], abs=1e-3)


def test_com_11_meses_usa_coeficientes_do_setor():
    p = calibrate_atr(_linhas(11))
    assert p["calibracao"] == "setor"
    assert p["meses_usados"] == 11
    assert p["aviso"] == AVISO_SETOR
    assert p["intercept"] == get_sector_defaults()["intercept"]


def test_linhas_com_valor_faltando_nao_contam():
    linhas = _linhas(11) + [
        {"chuva_mm": None, "impureza_pct": 10.0, "atr_real": 120.0},
        {"chuva_mm": 100.0, "impureza_pct": None, "atr_real": 120.0},
        {"chuva_mm": 100.0, "impureza_pct": 10.0, "atr_real": None},
        {"chuva_mm": float("nan"), "impureza_pct": 10.0, "atr_real": 120.0},
    ]
    p = calibrate_atr(linhas)
    assert p["calibracao"] == "setor"
    assert p["meses_usados"] == 11


def test_chuva_constante_cai_no_setor_com_aviso():
    linhas = _linhas(24)
    for h in linhas:
        h["chuva_mm"] = 100.0
    p = calibrate_atr(linhas)
    assert p["calibracao"] == "setor"
    assert p["aviso"] == AVISO_COLINEAR


def _com_correlacao(rho: float, n: int = 200, seed: int = 7) -> list[dict]:
    """Chuva e impureza com correlação populacional rho (amostra próxima disso)."""
    rng = np.random.default_rng(seed)
    z = rng.standard_normal(n)
    w = rng.standard_normal(n)
    chuva = 150 + 40 * z
    imp = 12 + 1.5 * (rho * z + math.sqrt(1 - rho**2) * w)
    atr_real = B0 + B_CHUVA * chuva + B_IMP * imp + rng.normal(0, 2.0, n)
    return [
        {"chuva_mm": float(c), "impureza_pct": float(i), "atr_real": float(a)}
        for c, i, a in zip(chuva, imp, atr_real)
    ]


def test_correlacao_acima_do_limite_cai_no_setor():
    linhas = _com_correlacao(0.96)
    assert np.corrcoef([h["chuva_mm"] for h in linhas], [h["impureza_pct"] for h in linhas])[0, 1] >= 0.95
    p = calibrate_atr(linhas)
    assert p["calibracao"] == "setor"
    assert p["aviso"] == AVISO_COLINEAR


def test_correlacao_abaixo_do_limite_calibra():
    linhas = _com_correlacao(0.90)
    assert np.corrcoef([h["chuva_mm"] for h in linhas], [h["impureza_pct"] for h in linhas])[0, 1] < 0.95
    assert calibrate_atr(linhas)["calibracao"] == "usina"


def test_sem_cov_o_intervalo_usa_z_sobre_sigma():
    """ATR-06: coeficientes do setor mantêm ŷ ± 1,645·sigma."""
    d = get_sector_defaults()
    r = predict_atr(100.0, 12.0, d)
    esperado = r["atr_esperado"]
    assert r["atr_max"] - esperado == pytest.approx(1.645 * d["sigma"], abs=1e-3)


def test_producao_total_com_volume():
    d = get_sector_defaults()
    r = predict_atr(100.0, 12.0, d, volume_moagem=1_000_000)
    assert r["producao_total"] == pytest.approx(r["atr_esperado"] * 1000, rel=1e-6)


# ── Histórico: filtro na query e sem user_id de terceiros ─────────────────────

class _FakeQuery:
    def __init__(self, tabela, db):
        self.tabela, self.db = tabela, db
        self.filtros = []

    def select(self, *_):
        return self

    def eq(self, k, v):
        self.filtros.append(lambda r, k=k, v=v: r.get(k) == v)
        return self

    def or_(self, expr):
        self.db.chamadas.append(("or_", expr))
        partes = []
        for termo in expr.split(","):
            campo, op, valor = termo.split(".", 2)
            if op == "eq":
                partes.append(lambda r, c=campo, v=valor: r.get(c) == v)
            elif op == "is":
                partes.append(lambda r, c=campo: r.get(c) is True)
        self.filtros.append(lambda r: any(p(r) for p in partes))
        return self

    def order(self, *_, **__):
        return self

    def limit(self, n):
        self.db.chamadas.append(("limit", n))
        return self

    def execute(self):
        class _R:
            pass
        r = _R()
        if self.tabela == "user_usinas":
            r.data = [{"usina_id": "U1"}]
            return r
        rows = self.db.linhas
        for f in self.filtros:
            rows = [x for x in rows if f(x)]
        r.data = rows
        return r


class _FakeSupa:
    def __init__(self, linhas):
        self.linhas, self.chamadas = linhas, []

    def table(self, nome):
        return _FakeQuery(nome, self)


def test_historico_filtra_na_query_e_nao_expoe_user_id(monkeypatch):
    from fastapi.testclient import TestClient

    import main

    eu = str(uuid.uuid4())
    outro = str(uuid.uuid4())
    base = {"usina_id": "U1", "chuva_mm": 1, "impureza_pct": 1, "atr_min": 1,
            "atr_esperado": 1, "atr_max": 1, "producao_total": None, "created_at": "2026-01-01"}
    linhas = [
        {**base, "id": "a", "user_id": eu, "compartilhado": False},
        {**base, "id": "b", "user_id": outro, "compartilhado": True},
        {**base, "id": "c", "user_id": outro, "compartilhado": False},  # não deve aparecer
        {**base, "id": "d", "user_id": outro, "compartilhado": None},   # NULL não é compartilhado
    ]
    fake = _FakeSupa(linhas)
    monkeypatch.setattr(main, "supa_client", lambda: fake)
    monkeypatch.setattr(main.limiter, "enabled", False)
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": eu, "email": "a@x.com", "role": "user"}
    try:
        r = TestClient(main.app).get("/api/atr/historico", params={"usina_id": "U1"})
    finally:
        main.app.dependency_overrides.clear()

    assert r.status_code == 200
    ids = [i["id"] for i in r.json()["historico"]]
    assert ids == ["a", "b"]
    assert all("user_id" not in i for i in r.json()["historico"])
    assert {i["id"]: i["minha"] for i in r.json()["historico"]} == {"a": True, "b": False}
    # O or_ entra antes do limit (o filtro não depende de corte prévio)
    nomes = [c[0] for c in fake.chamadas]
    assert nomes.index("or_") < nomes.index("limit")
    assert fake.chamadas[0] == ("or_", f"user_id.eq.{eu},compartilhado.is.true")


# ── Endpoint de simulação: leitura de atr_medicoes ─────────────────────────────

class _SimQuery:
    def __init__(self, nome, db):
        self.nome, self.db = nome, db

    def select(self, *_):
        self.db.selects.append(self.nome)
        return self

    def eq(self, *_):
        return self

    def order(self, *_, **__):
        return self

    def limit(self, *_):
        return self

    def insert(self, payload):
        self.db.inserts.append((self.nome, payload))
        return self

    def execute(self):
        from types import SimpleNamespace

        if self.nome == "user_usinas":
            return SimpleNamespace(data=[{"usina_id": "U1"}])
        if self.nome == "atr_medicoes":
            if self.db.erro is not None:
                raise self.db.erro
            return SimpleNamespace(data=self.db.medicoes)
        return SimpleNamespace(data=[{"id": "x"}])


class _SimSupa:
    def __init__(self, medicoes=(), erro=None):
        self.medicoes, self.erro = list(medicoes), erro
        self.selects, self.inserts = [], []

    def table(self, nome):
        return _SimQuery(nome, self)


def _medicao(i: int, mineral=1.0) -> dict:
    return {
        "mes_ref": f"2024-{(i % 12) + 1:02d}-01",
        "atr_kg_t": B0 + B_CHUVA * (80 + 7 * i) + B_IMP * (11 + i % 5),
        "impureza_vegetal_pct": 10.0 + i % 5,
        "impureza_mineral_pct": mineral,
        "precipitacao_mm": 80.0 + 7 * i,
    }


def _simular(monkeypatch, fake):
    from fastapi.testclient import TestClient

    import main

    monkeypatch.setattr(main, "supa_client", lambda: fake)
    monkeypatch.setattr(main.limiter, "enabled", False)
    main.app.dependency_overrides[main.get_current_user] = lambda: {
        "id": str(uuid.uuid4()), "email": "a@x.com", "role": "user"}
    try:
        cliente = TestClient(main.app, raise_server_exceptions=False)
        return cliente.post("/api/atr/simulate", json={"usina_id": "U1", "chuva_mm": 100, "impureza_pct": 12})
    finally:
        main.app.dependency_overrides.clear()


def test_simulate_sem_tabela_usa_setor_e_nao_le_atr_simulacoes(monkeypatch):
    from postgrest.exceptions import APIError

    fake = _SimSupa(erro=APIError({"code": "PGRST205", "message": "no table", "details": None, "hint": None}))
    r = _simular(monkeypatch, fake)
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["calibracao"] == "setor"
    assert corpo["aviso"] == AVISO_SETOR
    assert corpo["meses_usados"] == 0
    assert "atr_simulacoes" not in fake.selects
    assert [n for n, _ in fake.inserts] == ["atr_simulacoes"]
    assert not {"cov", "gl", "sigma"} & set(fake.inserts[0][1])


def test_simulate_outro_erro_do_banco_vira_500(monkeypatch):
    from postgrest.exceptions import APIError

    fake = _SimSupa(erro=APIError({"code": "XX000", "message": "boom", "details": None, "hint": None}))
    assert _simular(monkeypatch, fake).status_code == 500


def test_simulate_conta_so_meses_validos(monkeypatch):
    medicoes = [_medicao(i) for i in range(12)] + [_medicao(12, mineral=None)]
    r = _simular(monkeypatch, _SimSupa(medicoes=medicoes))
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["calibracao"] == "usina"
    assert corpo["meses_usados"] == 12
    assert corpo["aviso"] is None
