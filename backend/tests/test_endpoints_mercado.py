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
