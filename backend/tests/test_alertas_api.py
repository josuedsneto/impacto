"""ALE-01/03/04/06: CRUD, limite, job com segredo e transição de ponta a ponta (sem rede)."""
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

import alertas
from conftest import dias_uteis

ULTIMO = max(dias_uteis(date.today() - timedelta(days=10), date.today()))


@pytest.fixture
def cliente(api, supa, yahoo, monkeypatch):
    """API autenticada com o Supabase simulado, limiter de rotas desligado e e-mail de usuário fake."""
    from routers import alertas as rotas_alertas

    rotas_alertas.limiter.enabled = False
    yahoo.falhar = True  # sem rede: só o cache
    supa.auth = SimpleNamespace(admin=SimpleNamespace(
        get_user_by_id=lambda uid: SimpleNamespace(user=SimpleNamespace(email=f"{uid}@x.com"))
    ))
    monkeypatch.setenv("JOBS_SECRET", "segredo-de-teste")
    return api


def _precos(supa, fechamento, dias=40):
    """Preenche o cache com `fechamento` nos últimos `dias` dias úteis e cobre o intervalo."""
    dias_l = list(dias_uteis(date.today() - timedelta(days=dias * 2), date.today()))[-dias:]
    supa.gravar_precos("SB=F", {d: fechamento for d in dias_l})
    supa.cobertura("SB=F", dias_l[0], date.today())


def _regra_preco(api, nivel=11.0):
    return api.post("/api/alertas", json={
        "tipo": "preco_cruza", "ticker": "sb=f",
        "params": {"nivel": nivel, "direcao": "acima"}, "cooldown_horas": 24,
    })


# ── CRUD e validação ───────────────────────────────────────────────────────────

def test_cria_regra_normalizando_ticker_e_avaliando_estado(cliente, supa):
    _precos(supa, 10.0)
    r = _regra_preco(cliente, nivel=11.0)
    assert r.status_code == 201, r.text
    corpo = r.json()
    assert corpo["ticker"] == "SB=F" and corpo["ativo"] is True
    assert corpo["ultimo_estado"] is False  # DEC-04: avaliada na criação, sem disparar


def test_params_invalidos_retornam_422(cliente, supa):
    _precos(supa, 10.0)
    r = cliente.post("/api/alertas", json={"tipo": "preco_cruza", "ticker": "SB=F",
                                           "params": {"nivel": -3, "direcao": "acima"}})
    assert r.status_code == 422
    assert "Parâmetros inválidos" in r.json()["detail"]


def test_prob_cruzar_e_telegram_recusados(cliente, supa):
    _precos(supa, 10.0)
    r1 = cliente.post("/api/alertas", json={"tipo": "prob_cruzar", "ticker": "USDBRL=X", "params": {
        "strike": 5, "direcao": "acima", "horizonte_dias": 30, "prob_min": 60}})
    r2 = cliente.post("/api/alertas", json={"tipo": "vol_acima", "ticker": "SB=F",
                                            "params": {"pct": 30}, "canal": "telegram"})
    assert r1.status_code == 422 and r1.json()["detail"] == "Disponível em breve."
    assert r2.status_code == 422 and r2.json()["detail"] == "Disponível em breve."


def test_limite_de_20_regras(cliente, supa):
    _precos(supa, 10.0)
    for _ in range(20):
        assert _regra_preco(cliente).status_code == 201
    r = _regra_preco(cliente)
    assert r.status_code == 400
    assert r.json()["detail"].startswith("Limite de 20 alertas")


def test_pausar_e_listar(cliente, supa):
    _precos(supa, 10.0)
    rid = _regra_preco(cliente).json()["id"]
    r = cliente.patch(f"/api/alertas/{rid}", json={"ativo": False})
    assert r.status_code == 200 and r.json()["ativo"] is False
    assert [x["id"] for x in cliente.get("/api/alertas").json()] == [rid]


def test_regra_alheia_responde_404(cliente, supa):
    from main import app, get_current_user

    _precos(supa, 10.0)
    rid = _regra_preco(cliente).json()["id"]
    app.dependency_overrides[get_current_user] = lambda: {"id": "outro", "email": "o@x.com", "role": "user"}
    try:
        assert cliente.patch(f"/api/alertas/{rid}", json={"ativo": False}).status_code == 404
        assert cliente.delete(f"/api/alertas/{rid}").status_code == 404
        assert cliente.post(f"/api/alertas/{rid}/testar").status_code == 404
        assert cliente.get(f"/api/alertas/eventos?rule_id={rid}").status_code == 404
    finally:
        app.dependency_overrides[get_current_user] = lambda: {"id": "u1", "email": "u@x.com", "role": "user"}


def test_testar_nao_grava_nada(cliente, supa):
    _precos(supa, 10.0)
    rid = _regra_preco(cliente, nivel=9.0).json()["id"]  # 10 >= 9: estado True já na criação (DEC-04)
    antes = cliente.get("/api/alertas").json()[0]["ultimo_estado"]
    r = cliente.post(f"/api/alertas/{rid}/testar")
    assert r.status_code == 200
    assert r.json()["condicao"] is True
    assert supa.db.get("alert_events", {}) == {}
    assert cliente.get("/api/alertas").json()[0]["ultimo_estado"] == antes is True


# ── job: segredo ───────────────────────────────────────────────────────────────

def test_job_sem_segredo_responde_401(cliente):
    assert cliente.post("/api/jobs/alertas").status_code == 401
    assert cliente.post("/api/jobs/alertas", headers={"X-Job-Secret": "errado"}).status_code == 401


def test_job_sem_segredo_configurado_responde_503(cliente, monkeypatch):
    monkeypatch.delenv("JOBS_SECRET")
    assert cliente.post("/api/jobs/alertas", headers={"X-Job-Secret": "x"}).status_code == 503


# ── job: transição de ponta a ponta ────────────────────────────────────────────

def test_transicao_dispara_uma_vez_e_nao_repete(cliente, supa, monkeypatch):
    enviados = []
    monkeypatch.setattr(alertas, "enviar_email", lambda to, assunto, texto: enviados.append((to, texto)))
    _precos(supa, 10.0)
    rid = _regra_preco(cliente, nivel=11.0).json()["id"]  # estado False na criação

    supa.gravar_precos("SB=F", {ULTIMO: 12.0})  # fechamento cruza o nível
    h = {"X-Job-Secret": "segredo-de-teste"}
    r1 = cliente.post("/api/jobs/alertas", headers=h).json()
    assert r1["disparadas"] == 1 and len(enviados) == 1
    assert enviados[0][0] == "u1@x.com"
    assert "Avaliado às" in enviados[0][1] and "(Brasília)" in enviados[0][1]

    r2 = cliente.post("/api/jobs/alertas", headers=h).json()
    assert r2["disparadas"] == 0 and len(enviados) == 1  # continua verdadeiro: sem repetição

    evento = list(supa.db["alert_events"].values())[0]
    assert evento["rule_id"] == rid and evento["enviado"] is True and evento["erro"] is None


def test_sem_resend_registra_erro_e_nao_quebra_o_job(cliente, supa, monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("ALERTAS_FROM", raising=False)
    _precos(supa, 10.0)
    _regra_preco(cliente, nivel=11.0)
    supa.gravar_precos("SB=F", {ULTIMO: 12.0})

    r = cliente.post("/api/jobs/alertas", headers={"X-Job-Secret": "segredo-de-teste"})
    assert r.status_code == 200 and r.json()["disparadas"] == 1
    evento = list(supa.db["alert_events"].values())[0]
    assert evento["enviado"] is False
    assert "E-mail não configurado" in evento["erro"]


def test_ticker_com_dado_velho_e_pulado(cliente, supa, monkeypatch):
    enviados = []
    monkeypatch.setattr(alertas, "enviar_email", lambda *a: enviados.append(a))
    _precos(supa, 10.0)
    _regra_preco(cliente, nivel=11.0)
    # Apaga a cobertura recente: a última barra fica com mais de 4 dias corridos.
    for k in list(supa.db["market_prices"]):
        if k[1] > (date.today() - timedelta(days=10)).isoformat():
            del supa.db["market_prices"][k]
    r = cliente.post("/api/jobs/alertas", headers={"X-Job-Secret": "segredo-de-teste"}).json()
    assert r["disparadas"] == 0 and r["puladas"] == 1 and enviados == []


def test_eventos_listam_so_do_usuario(cliente, supa):
    supa.db["alert_events"] = {("e1",): {"id": "e1", "user_id": "outro", "rule_id": "x", "created_at": "2026-01-01"},
                              ("e2",): {"id": "e2", "user_id": "u1", "rule_id": "y", "created_at": "2026-01-02"}}
    ids = [e["id"] for e in cliente.get("/api/alertas/eventos").json()]
    assert ids == ["e2"]
