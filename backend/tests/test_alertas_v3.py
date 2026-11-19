"""alertas-v3: histerese (ALE-10), bloqueio de nível já cruzado (ALE-11) e sinal_tecnico (ALE-12). Sem rede."""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import numpy as np
import pytest
from pydantic import ValidationError

import alertas
from conftest import dias_uteis

AGORA = datetime(2026, 11, 18, 21, 0, tzinfo=timezone.utc)
RID = "11111111-1111-1111-1111-111111111111"


def _regra(tipo, params, estado=False, ticker="SB=F"):
    return {"id": RID, "user_id": "u", "tipo": tipo, "ticker": ticker, "params": params,
            "cooldown_horas": 24, "ativo": True, "ultimo_estado": estado, "ultimo_disparo": None}


def _rodar(regra, valores, passo=timedelta(days=2)):
    """Simula rodadas do job (mesma decisão de rodar_avaliacoes). Devolve quantos disparos houve."""
    disparos = 0
    agora = AGORA
    for v in valores:
        agora = agora + passo
        cond = _condicao(regra, v)
        disparar, estado = alertas.decidir(regra, cond, v, agora)
        if disparar:
            disparos += 1
            regra["ultimo_disparo"] = agora.isoformat()
        regra["ultimo_estado"] = estado
    return disparos


def _condicao(regra, v):
    p = regra["params"]
    if regra["tipo"] == "prob_cruzar":
        return v >= float(p["prob"])
    nivel = float(p["nivel"])
    return v >= nivel if p["direcao"] == "acima" else v <= nivel


# ── Histerese (ALE-10, DEC-28/29) ──────────────────────────────────────────────

def test_oscilacao_dispara_uma_vez():
    """Série oscila em torno do limiar 0,30 (margem 0,05): só o primeiro cruzamento dispara."""
    regra = _regra("prob_cruzar", {"nivel": 11.0, "direcao": "acima", "horizonte": 20, "prob": 0.30, "margem": 0.05}, estado=False)
    oscila = [0.31, 0.29, 0.31, 0.29, 0.32, 0.27, 0.28, 0.31, 0.26, 0.29]
    assert _rodar(regra, oscila) == 1


def test_rearme_abaixo_da_margem_permite_novo_disparo():
    regra = _regra("prob_cruzar", {"nivel": 11.0, "direcao": "acima", "horizonte": 20, "prob": 0.30, "margem": 0.05}, estado=False)
    # 0,31 dispara; 0,24 cai abaixo de 0,25 e rearma; 0,31 dispara de novo (já passou do cooldown)
    assert _rodar(regra, [0.31, 0.27, 0.24, 0.31]) == 2


def test_armada_que_sobe_ate_o_limiar_dispara():
    """Regressão: valor na faixa de margem com estado False não pode ligar a regra sem disparar."""
    regra = _regra("prob_cruzar", {"nivel": 11.0, "direcao": "acima", "horizonte": 20, "prob": 0.30, "margem": 0.05}, estado=False)
    assert _rodar(regra, [0.27, 0.31]) == 1


def test_preco_armado_na_faixa_de_margem_dispara_ao_cruzar():
    regra = _regra("preco_cruza", {"nivel": 10.0, "direcao": "acima", "margem_pct": 2}, estado=False)
    assert _rodar(regra, [9.9, 10.1]) == 1


def test_proximo_estado_sem_chave_margem_nao_trava():
    regra = _regra("prob_cruzar", {"nivel": 11.0, "direcao": "acima", "horizonte": 20, "prob": 0.04}, estado=True)
    assert alertas.proximo_estado(regra, False, 0.001) is False  # abaixo de prob − 0,02 rearma


def test_regra_antiga_sem_margem_usa_padrao_limitado_ao_limiar():
    assert alertas._margem_prob({"prob": 0.30}) == pytest.approx(0.05)
    assert alertas._margem_prob({"prob": 0.04}) == pytest.approx(0.02)  # metade do limiar: não trava


def test_preco_margem_zero_mantem_comportamento_atual():
    regra = _regra("preco_cruza", {"nivel": 10.0, "direcao": "acima", "margem_pct": 0}, estado=False)
    assert _rodar(regra, [10.1, 9.95, 10.1]) == 2


def test_preco_com_margem_so_rearma_alem_da_margem():
    regra = _regra("preco_cruza", {"nivel": 10.0, "direcao": "acima", "margem_pct": 2}, estado=False)
    # 9,95 não passa de 9,80 (10 − 2%), então não rearma e 10,1 não dispara de novo
    assert _rodar(regra, [10.1, 9.95, 10.1]) == 1


def test_margem_igual_ou_maior_que_limiar_e_recusada():
    with pytest.raises(ValidationError):
        alertas.validar_params("prob_cruzar", {"nivel": 11, "direcao": "acima", "horizonte": 5, "prob": 0.05, "margem": 0.05})


def test_margem_omitida_vira_padrao_na_validacao():
    p = alertas.validar_params("prob_cruzar", {"nivel": 11, "direcao": "acima", "horizonte": 5, "prob": 0.04})
    assert p["margem"] == pytest.approx(0.02)


def test_margem_fora_do_intervalo_e_recusada():
    with pytest.raises(ValidationError):
        alertas.validar_params("prob_cruzar", {"nivel": 11, "direcao": "acima", "horizonte": 5, "prob": 0.5, "margem": 0.3})
    with pytest.raises(ValidationError):
        alertas.validar_params("preco_cruza", {"nivel": 11, "direcao": "acima", "margem_pct": 25})


# ── Bloqueio de nível já cruzado (ALE-11, DEC-30) ──────────────────────────────

def _fechamentos_fake(monkeypatch, ticker, ultimo, data):
    linhas = [{"date": (data - timedelta(days=i)).isoformat(), "close": ultimo} for i in range(10, -1, -1)]
    monkeypatch.setattr(alertas.market_cache, "get_prices", lambda t, ini, fim: linhas if t == ticker else [])


def test_ja_cruzado_acima_recusa_com_mensagem_exata(monkeypatch):
    data = date(2026, 11, 18)
    _fechamentos_fake(monkeypatch, "USDBRL=X", 5.60, data)
    msg = alertas.ja_cruzado("USDBRL=X", "acima", 5.00, data)
    assert msg == "O dólar já está acima de 5,00 (5,60 em 18/11). Escolha um nível acima do preço atual."


def test_ja_cruzado_abaixo_recusa_quando_preco_esta_abaixo_do_nivel(monkeypatch):
    data = date(2026, 11, 18)
    _fechamentos_fake(monkeypatch, "USDBRL=X", 5.60, data)
    assert alertas.ja_cruzado("USDBRL=X", "abaixo", 6.00, data).startswith("O dólar já está abaixo de 6,00")
    assert alertas.ja_cruzado("USDBRL=X", "abaixo", 5.00, data) is None


def test_ja_cruzado_do_lado_certo_passa(monkeypatch):
    data = date(2026, 11, 18)
    _fechamentos_fake(monkeypatch, "USDBRL=X", 5.60, data)
    assert alertas.ja_cruzado("USDBRL=X", "acima", 6.00, data) is None


def test_sem_preco_aceita_e_registra_aviso(monkeypatch, caplog):
    def falha(*_):
        raise RuntimeError("yahoo fora")
    monkeypatch.setattr(alertas.market_cache, "get_prices", falha)
    assert alertas.ja_cruzado("USDBRL=X", "acima", 5.00, date(2026, 11, 18)) is None
    assert "regra aceita" in caplog.text


# ── sinal_tecnico (ALE-12, DEC-31) ─────────────────────────────────────────────

def _serie_rsi(caindo=80, ultimo_fator=1.2, penultimo_fator=1.0):
    """Queda constante (RSI ≈ 0) e, no fim, um salto que faz o RSI cruzar 30 para cima."""
    closes = [10.0 * (0.995 ** i) for i in range(caindo)]
    closes += [closes[-1] * penultimo_fator, closes[-1] * ultimo_fator]
    ini = date(2026, 1, 1)
    return [{"date": (ini + timedelta(days=i)).isoformat(), "open": c, "high": c * 1.01, "low": c * 0.99,
             "close": c, "volume": 1000} for i, c in enumerate(closes)]


def _regra_sinal(indicador="rsi", sentido="compra"):
    return _regra("sinal_tecnico", {"indicador": indicador, "sentido": sentido})


def test_sinal_na_ultima_barra_dispara_condicao():
    serie = _serie_rsi()
    cond, valor, msg = alertas.avaliar(_regra_sinal(), serie)
    assert cond is True
    assert valor == pytest.approx(serie[-1]["close"])
    assert "sinal técnico de RSI de compra" in msg and "não uma recomendação" in msg


def test_sinal_so_em_barra_anterior_nao_conta():
    serie = _serie_rsi(penultimo_fator=1.2, ultimo_fator=0.9)  # cruzou na penúltima, na última o RSI voltou a cair
    cond, _, _ = alertas.avaliar(_regra_sinal(), serie)
    assert cond is False


def test_sinal_de_venda_nao_aparece_na_serie_de_queda():
    cond, _, _ = alertas.avaliar(_regra_sinal(sentido="venda"), _serie_rsi())
    assert cond is False


def test_poucas_barras_levantam_dados_insuficientes():
    with pytest.raises(alertas.DadosInsuficientes):
        alertas.avaliar(_regra_sinal(), _serie_rsi(caindo=20))


def test_linhas_sem_high_low_sao_descartadas():
    serie = _serie_rsi()
    for r in serie[:5]:
        r["high"] = None
    cond, _, _ = alertas.avaliar(_regra_sinal(), serie)
    assert cond is True


def test_indicador_fora_da_lista_e_recusado():
    with pytest.raises(ValidationError):
        alertas.validar_params("sinal_tecnico", {"indicador": "adx", "sentido": "compra"})
    assert "sinal_tecnico" in alertas.TIPOS_DISPONIVEIS


# ── API (ALE-10/11/12) ─────────────────────────────────────────────────────────

HOJE = datetime.now(alertas.BRT).date()


@pytest.fixture
def cliente(api, supa, yahoo, monkeypatch):
    from routers import alertas as rotas_alertas

    rotas_alertas.limiter.enabled = False
    yahoo.falhar = True
    supa.auth = SimpleNamespace(admin=SimpleNamespace(
        get_user_by_id=lambda uid: SimpleNamespace(user=SimpleNamespace(email="x@x.com"))
    ))
    monkeypatch.setattr(alertas, "FERIADOS_ICE", frozenset())
    monkeypatch.setenv("JOBS_SECRET", "segredo-de-teste")
    return api


def _precos_dolar(supa, fechamento, dias=40):
    dias_l = list(dias_uteis(HOJE - timedelta(days=dias * 2), HOJE))[-dias:]
    supa.gravar_precos("USDBRL=X", {d: fechamento for d in dias_l})
    supa.cobertura("USDBRL=X", dias_l[0], HOJE)


def test_criar_prob_ja_cruzada_responde_422(cliente, supa):
    _precos_dolar(supa, 5.60)
    r = cliente.post("/api/alertas", json={
        "tipo": "prob_cruzar", "ticker": "usdbrl=x", "cooldown_horas": 24,
        "params": {"nivel": 5.00, "direcao": "acima", "horizonte": 5, "prob": 0.3},
    })
    assert r.status_code == 422
    assert r.json()["detail"].startswith("O dólar já está acima de 5,00 (5,60 em ")


def test_criar_prob_do_lado_certo_responde_201(cliente, supa):
    _precos_dolar(supa, 5.60)
    r = cliente.post("/api/alertas", json={
        "tipo": "prob_cruzar", "ticker": "usdbrl=x", "cooldown_horas": 24,
        "params": {"nivel": 6.00, "direcao": "acima", "horizonte": 5, "prob": 0.3},
    })
    assert r.status_code == 201


def test_editar_params_ja_cruzado_responde_422(cliente, supa):
    _precos_dolar(supa, 5.60)
    criada = cliente.post("/api/alertas", json={
        "tipo": "prob_cruzar", "ticker": "usdbrl=x", "cooldown_horas": 24,
        "params": {"nivel": 6.00, "direcao": "acima", "horizonte": 5, "prob": 0.3},
    }).json()
    r = cliente.patch(f"/api/alertas/{criada['id']}", json={
        "params": {"nivel": 5.00, "direcao": "acima", "horizonte": 5, "prob": 0.3}})
    assert r.status_code == 422


def test_editar_params_de_outro_tipo_responde_422(cliente, supa):
    _precos(supa, 11.0)
    criada = cliente.post("/api/alertas", json={
        "tipo": "preco_cruza", "ticker": "sb=f", "cooldown_horas": 24,
        "params": {"nivel": 11.0, "direcao": "acima"}}).json()
    r = cliente.patch(f"/api/alertas/{criada['id']}", json={"params": {"nivel": 12.0, "direcao": "acima"}})
    assert r.status_code == 422


def test_criar_sinal_tecnico_responde_201_e_indicador_invalido_422(cliente, supa):
    _precos(supa, 11.0)
    ok = cliente.post("/api/alertas", json={
        "tipo": "sinal_tecnico", "ticker": "sb=f", "cooldown_horas": 24,
        "params": {"indicador": "rsi", "sentido": "compra"}})
    assert ok.status_code == 201
    ruim = cliente.post("/api/alertas", json={
        "tipo": "sinal_tecnico", "ticker": "sb=f", "cooldown_horas": 24,
        "params": {"indicador": "adx", "sentido": "compra"}})
    assert ruim.status_code == 422


def _precos(supa, fechamento, dias=40):
    dias_l = list(dias_uteis(HOJE - timedelta(days=dias * 2), HOJE))[-dias:]
    supa.gravar_precos("SB=F", {d: fechamento for d in dias_l})
    supa.cobertura("SB=F", dias_l[0], HOJE)
