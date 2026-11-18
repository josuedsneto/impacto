"""CACHE-01/02/04/05: endpoints de mercado leem preços pelo cache."""
from datetime import date, timedelta

from conftest import dias_uteis

ULTIMO_DIA_UTIL = max(dias_uteis(date.today() - timedelta(days=7), date.today())).isoformat()

MSG_503 = "Não foi possível obter os preços de SB=F agora. Tente novamente em alguns minutos."


def _variando(d: date) -> float:
    return 20 + (d.toordinal() % 7) * 0.3


def test_var_responde_com_ultimo_dado(api, yahoo):
    yahoo.preco = _variando
    r = api.get("/api/var", params={"ticker": "SB=F", "confidence": 0.95})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ultimo_dado"] == ULTIMO_DIA_UTIL
    assert corpo["n_observations"] > 200
    assert corpo["var_historico_abs"] < 0


def test_var_sem_dados_responde_503(api, yahoo):
    yahoo.falhar = True
    r = api.get("/api/var", params={"ticker": "SB=F"})
    assert r.status_code == 503
    assert r.json()["detail"] == MSG_503


def test_volatilidade_responde_com_ultimo_dado(api, yahoo):
    yahoo.preco = _variando
    r = api.get("/api/volatility", params={"ticker": "SB=F"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ultimo_dado"] == corpo["rolling_30d"][-1]["date"]
    assert corpo["vol_1y"] > 0


def test_volatilidade_sem_dados_responde_503(api, yahoo):
    yahoo.falhar = True
    r = api.get("/api/volatility", params={"ticker": "SB=F"})
    assert r.status_code == 503
    assert r.json()["detail"] == MSG_503


def test_segunda_chamada_nao_vai_ao_yahoo(api, yahoo):
    """CACHE-01 AC3: com o cache coberto e rebusca recente, nada é buscado de novo."""
    yahoo.preco = _variando
    api.get("/api/var", params={"ticker": "SB=F"})
    chamadas = len(yahoo.chamadas)
    api.get("/api/var", params={"ticker": "SB=F"})
    api.get("/api/volatility", params={"ticker": "SB=F"})
    assert len(yahoo.chamadas) == chamadas


def _com_crise(d: date) -> float:
    """Preço estável com queda de 40% entre set/2008 e dez/2008 e de 20% em mar/2020."""
    if date(2008, 9, 1) <= d <= date(2008, 12, 31):
        return 30 - 12 * (d - date(2008, 9, 1)).days / 121
    if date(2020, 3, 1) <= d <= date(2020, 3, 31):
        return 30 - 6 * (d - date(2020, 3, 1)).days / 30
    return 30 + (d.toordinal() % 5) * 0.1


def test_stress_le_desde_2007_e_traz_a_crise_de_2008(api, yahoo):
    """CACHE-02: com o histórico desde 2007, 'Crise 2008' tem período preenchido."""
    yahoo.preco = _com_crise
    r = api.get("/api/stress", params={"ticker": "SB=F"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ultimo_dado"] == ULTIMO_DIA_UTIL
    crise = next(c for c in corpo["cenarios"] if c["cenario"] == "Crise 2008")
    assert crise["periodo_inicio"].startswith("2008-")
    assert crise["periodo_fim"].startswith("2008-12")
    assert crise["drawdown_pct"] < -0.35
    assert min(c[1] for c in yahoo.chamadas) <= date(2007, 1, 2)


def test_stress_sem_dados_responde_503(api, yahoo):
    yahoo.falhar = True
    r = api.get("/api/stress", params={"ticker": "SB=F"})
    assert r.status_code == 503
    assert r.json()["detail"] == MSG_503


def test_arima_responde_com_ultimo_dado(api, yahoo):
    yahoo.preco = _variando
    r = api.get("/api/arima/SB=F", params={"steps": 10})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["ultimo_dado"] == ULTIMO_DIA_UTIL
    assert sum(1 for p in corpo["series"] if "forecast" in p) == 10


def test_sugestao_de_ativo_sem_dados_responde_400(api, yahoo):
    """A sonda de /api/market/suggest consulta o Yahoo pelo módulo de cache."""
    yahoo.vazio = True
    r = api.post("/api/market/suggest", json={"ticker": "XXXX"})
    assert r.status_code == 400
    assert r.json()["detail"] == "Ativo 'XXXX' não encontrado ou sem dados recentes. Confira o código e tente de novo."
    assert yahoo.chamadas and yahoo.chamadas[0][0] == "XXXX"
