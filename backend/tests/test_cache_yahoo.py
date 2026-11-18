"""YAH-04, YAH-06, YAH-07, YAH-08: status do pregão, jobs, health profundo, timeouts."""
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import main

NY = ZoneInfo("America/New_York")


def test_estado_pregao_dentro_e_fora_do_horario():
    """YAH-04.1 e 04.2: segunda 10:00 NY abre; 14:00 e sábado fecham; 13:00 já é fechado (intervalo semiaberto)."""
    assert main.estado_pregao(datetime(2026, 11, 16, 10, 0, tzinfo=NY)) == "REGULAR"
    assert main.estado_pregao(datetime(2026, 11, 16, 3, 30, tzinfo=NY)) == "REGULAR"
    assert main.estado_pregao(datetime(2026, 11, 16, 13, 0, tzinfo=NY)) == "CLOSED"
    assert main.estado_pregao(datetime(2026, 11, 16, 14, 0, tzinfo=NY)) == "CLOSED"
    assert main.estado_pregao(datetime(2026, 11, 21, 10, 0, tzinfo=NY)) == "CLOSED"  # sábado


def test_estado_pregao_converte_utc():
    """Instante em UTC é convertido para Nova York antes de comparar."""
    # 15:00 UTC em novembro (EST, UTC-5) = 10:00 NY, segunda
    agora = datetime(2026, 11, 16, 15, 0, tzinfo=timezone.utc)
    assert main.estado_pregao(agora) == "REGULAR"


def test_market_status_nao_consulta_yahoo_e_responde_regular_ou_closed(api, yahoo):
    r = api.get("/api/market/status", params={"ticker": "SB=F"})
    assert r.status_code == 200
    assert r.json()["state"] in ("REGULAR", "CLOSED")
    assert yahoo.chamadas == []


def test_market_status_responde_unknown_quando_calculo_falha(api, monkeypatch):
    """YAH-04.3: exceção vira UNKNOWN, não CLOSED."""

    def quebrado(agora):
        raise RuntimeError("tzdata ausente")

    monkeypatch.setattr(main, "estado_pregao", quebrado)
    r = api.get("/api/market/status", params={"ticker": "SB=F"})
    assert r.json() == {"ticker": "SB=F", "state": "UNKNOWN", "open": False}


def test_job_sem_header_responde_401(api, supa, yahoo, monkeypatch):
    monkeypatch.setenv("JOBS_SECRET", "segredo-123")
    assert api.post("/api/jobs/aquecer-cache").status_code == 401
    assert api.post("/api/jobs/aquecer-cache", headers={"X-Job-Secret": "errado"}).status_code == 401
    assert yahoo.chamadas == []


def test_job_sem_segredo_configurado_responde_503(api, monkeypatch):
    """YAH-06.1: falha fechada (sem JOBS_SECRET, 503)."""
    monkeypatch.delenv("JOBS_SECRET", raising=False)
    assert api.post("/api/jobs/aquecer-cache", headers={"X-Job-Secret": ""}).status_code == 503


def test_job_aquece_os_ativos_com_segredo_certo(api, supa, yahoo, monkeypatch):
    """YAH-06.1 e 06.3: chama get_prices para cada ativo e responde o resumo."""
    monkeypatch.setenv("JOBS_SECRET", "segredo-123")
    r = api.post("/api/jobs/aquecer-cache", headers={"X-Job-Secret": "segredo-123"})
    assert r.status_code == 200
    corpo = r.json()
    assert [a["ticker"] for a in corpo["aquecidos"]] == main_jobs_tickers()
    assert len(yahoo.chamadas) >= len(main_jobs_tickers())


def test_job_continua_quando_um_ativo_falha_no_banco(api, supa, yahoo, monkeypatch):
    """YAH-06.4: falha de um ativo não derruba o job."""
    monkeypatch.setenv("JOBS_SECRET", "segredo-123")
    import routers.jobs as jobs

    original = jobs.get_prices

    def parcialmente_quebrado(ticker, ini, fim):
        if ticker == "SB=F":
            raise RuntimeError("banco fora")
        return original(ticker, ini, fim)

    monkeypatch.setattr(jobs, "get_prices", parcialmente_quebrado)
    r = api.post("/api/jobs/aquecer-cache", headers={"X-Job-Secret": "segredo-123"})
    assert r.status_code == 200
    assert r.json()["aquecidos"][0] == {"ticker": "SB=F", "linhas": 0, "ultimo_dado": None, "erro": True}


def test_health_simples_nao_consulta_banco(api, monkeypatch):
    monkeypatch.setattr(main, "supa_client", lambda: 1 / 0)
    assert api.get("/api/health").json() == {"status": "ok"}


def test_health_profundo_ok_e_degradado(api, supa, monkeypatch):
    """YAH-07.2 e 07.3."""
    monkeypatch.setattr(main, "supa_client", lambda: supa)
    assert api.get("/api/health", params={"deep": 1}).json() == {"status": "ok", "supabase": "ok"}

    def fora():
        raise ConnectionError("supabase fora")

    monkeypatch.setattr(main, "supa_client", fora)
    r = api.get("/api/health", params={"deep": 1})
    assert r.status_code == 503
    assert r.json() == {"status": "degradado", "supabase": "erro"}


def test_noticias_com_timeout_e_url_codificada(api, monkeypatch):
    """YAH-08.1: requests com timeout; ç, espaços e acentos vão codificados."""
    chamadas = {}

    class Resp:
        content = b""

        def raise_for_status(self):
            pass

    def falso_get(url, **kwargs):
        chamadas["url"], chamadas["kwargs"] = url, kwargs
        return Resp()

    monkeypatch.setattr(main.requests, "get", falso_get)
    main._news_cache.update({"ts": 0.0, "items": []})
    assert api.get("/api/news").status_code == 200
    assert chamadas["kwargs"]["timeout"] == 10
    assert " " not in chamadas["url"] and "ç" not in chamadas["url"]
    assert "a%C3%A7%C3%BAcar" in chamadas["url"]


def main_jobs_tickers():
    import routers.jobs as jobs

    return jobs.TICKERS_AQUECIMENTO
