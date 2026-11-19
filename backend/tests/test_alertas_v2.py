"""alertas-v2: prob_cruzar (ALE-07), posicao_limite (ALE-08), Telegram (ALE-09) e briefing (BRF-01 a BRF-03).

Séries sintéticas e Supabase/Resend/Telegram simulados. Sem rede.
"""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import numpy as np
import pytest
from pydantic import ValidationError

import alertas
import briefing
import market_cache
import politica_hedge
import telegram_bot

RID = "11111111-1111-1111-1111-111111111111"
USINA = "22222222-2222-2222-2222-222222222222"


def _serie_sintetica(n=300, s0=10.0, seed=7):
    """Passeio aleatório sintético com volatilidade diária de 0,5%: datas consecutivas, fechamentos positivos."""
    rng = np.random.default_rng(seed)
    closes = s0 * np.exp(np.cumsum(0.005 * rng.standard_normal(n)))
    ini = date(2025, 1, 1)
    return [{"date": (ini + timedelta(days=i)).isoformat(), "close": float(c)} for i, c in enumerate(closes)]


def _regra_prob(direcao="acima", nivel=11.0, horizonte=20, prob=0.5):
    return {"id": RID, "tipo": "prob_cruzar", "ticker": "USDBRL=X",
            "params": {"nivel": nivel, "direcao": direcao, "horizonte": horizonte, "prob": prob}}


# ── prob_cruzar (ALE-07, DEC-20/21) ────────────────────────────────────────────

def test_prob_em_intervalo_e_cresce_quando_o_nivel_cai_para_acima():
    serie = _serie_sintetica()
    s0 = serie[-1]["close"]
    probs = [alertas.avaliar(_regra_prob(nivel=s0 * f), serie, date(2026, 11, 18))[1] for f in (1.02, 1.05, 1.10)]
    assert all(0.0 <= p <= 1.0 for p in probs)
    assert probs[0] >= probs[1] >= probs[2]  # nível mais longe, menor chance de tocar


def test_direcao_abaixo_espelha_a_acima():
    serie = _serie_sintetica()
    s0 = serie[-1]["close"]
    p_baixo_perto = alertas.avaliar(_regra_prob("abaixo", s0 * 0.98), serie, date(2026, 11, 18))[1]
    p_baixo_longe = alertas.avaliar(_regra_prob("abaixo", s0 * 0.90), serie, date(2026, 11, 18))[1]
    assert p_baixo_perto >= p_baixo_longe


def test_condicao_compara_com_o_limiar():
    serie = _serie_sintetica()
    s0 = serie[-1]["close"]
    cond_baixa, valor, _ = alertas.avaliar(_regra_prob(nivel=s0 * 1.03, prob=0.0001), serie, date(2026, 11, 18))
    assert cond_baixa == (valor >= 0.0001)
    cond_alta, _, _ = alertas.avaliar(_regra_prob(nivel=s0 * 1.03, prob=1.0), serie, date(2026, 11, 18))
    assert cond_alta is False  # probabilidade exata de 1 não ocorre com passeio aleatório


def test_mesma_regra_mesmo_dia_mesmo_valor():
    serie = _serie_sintetica()
    dia = date(2026, 11, 18)
    a = alertas.avaliar(_regra_prob(), serie, dia)[1]
    b = alertas.avaliar(_regra_prob(), serie, dia)[1]
    assert a == b


def test_semente_depende_de_regra_e_dia_e_nao_do_processo():
    d = date(2026, 11, 18)
    assert alertas.semente_prob(RID, d) == alertas.semente_prob(RID, d)
    assert alertas.semente_prob(RID, d) != alertas.semente_prob(RID, d + timedelta(days=1))
    assert 0 <= alertas.semente_prob(RID, d) < 2**32


def test_poucos_fechamentos_levantam_dados_insuficientes():
    with pytest.raises(alertas.DadosInsuficientes):
        alertas.avaliar(_regra_prob(), _serie_sintetica(n=30))


def test_schema_prob_cruzar_aceita_e_recusa_limites():
    ok = alertas.validar_params("prob_cruzar", {"nivel": 5.5, "direcao": "acima", "horizonte": 30, "prob": 0.6})
    assert ok["prob"] == 0.6
    with pytest.raises(ValidationError):
        alertas.validar_params("prob_cruzar", {"nivel": 5.5, "direcao": "acima", "horizonte": 300, "prob": 0.6})
    with pytest.raises(ValidationError):
        alertas.validar_params("prob_cruzar", {"nivel": 5.5, "direcao": "acima", "horizonte": 30, "prob": 1.5})


# ── posicao_limite (ALE-08, DEC-22) ────────────────────────────────────────────

POLITICA = {"producao_estimada_t": 1000.0, "minimo_pct": 40.0, "maximo_pct": 80.0}
REGRA_POS = {"id": RID, "tipo": "posicao_limite", "ticker": "POSICAO",
             "params": {"usina_id": USINA, "safra": "2026/27"}}


def _pos(volume, instrumento="fixacao_acucar"):
    return {"volume": volume, "instrumento": instrumento}


def test_posicao_abaixo_dentro_e_acima_da_faixa():
    cond, pct, msg = alertas.avaliar_posicao(REGRA_POS, [_pos(300)], POLITICA)
    assert cond is True and pct == 30.0 and "abaixo" in msg
    cond, _, msg = alertas.avaliar_posicao(REGRA_POS, [_pos(500)], POLITICA)
    assert cond is False and "dentro" in msg
    cond, _, msg = alertas.avaliar_posicao(REGRA_POS, [_pos(900)], POLITICA)
    assert cond is True and "acima" in msg


def test_posicao_sem_politica_ou_producao_e_pulada():
    with pytest.raises(alertas.DadosInsuficientes):
        alertas.avaliar_posicao(REGRA_POS, [_pos(300)], None)
    with pytest.raises(alertas.DadosInsuficientes):
        alertas.avaliar_posicao(REGRA_POS, [_pos(300)], {"producao_estimada_t": None, "minimo_pct": 40, "maximo_pct": 80})


def test_situacao_ignora_ndf_e_conta_opcao_de_acucar():
    sit = politica_hedge.situacao([_pos(100, "ndf_dolar"), _pos(200, "opcao_acucar")], POLITICA)
    assert sit["pct_fixado"] == 20.0 and sit["status"] == "abaixo"


def test_job_posicao_nao_busca_preco_e_pula_quem_saiu_da_usina(supa, monkeypatch):
    monkeypatch.setattr(market_cache, "get_prices", lambda *a, **k: (_ for _ in ()).throw(AssertionError("não deve buscar preço")))
    enviados = []
    monkeypatch.setattr(alertas, "enviar_email", lambda *a, **k: enviados.append(a))
    supa.auth = SimpleNamespace(admin=SimpleNamespace(
        get_user_by_id=lambda uid: SimpleNamespace(user=SimpleNamespace(email="x@x.com"))))
    supa.table("alert_rules").insert({**REGRA_POS, "user_id": "u1", "ativo": True, "ultimo_estado": False,
                                      "cooldown_horas": 24, "canal": "email"}).execute()
    supa.table("posicoes").insert({"usina_id": USINA, "safra": "2026/27", **_pos(300)}).execute()
    supa.table("politica_hedge").insert({"usina_id": USINA, "safra": "2026/27", **POLITICA}).execute()
    supa.table("user_usinas").insert({"user_id": "u1", "usina_id": USINA}).execute()

    agora = datetime(2026, 11, 18, 21, tzinfo=timezone.utc)
    resumo = alertas.rodar_avaliacoes(agora=agora)
    assert resumo["disparadas"] == 1 and len(enviados) == 1

    supa.table("user_usinas").delete().eq("user_id", "u1").execute()
    resumo = alertas.rodar_avaliacoes(agora=agora + timedelta(days=3))
    assert resumo["puladas"] == 1 and resumo["disparadas"] == 0


# ── Telegram (ALE-09, DEC-23) ──────────────────────────────────────────────────

@pytest.fixture
def tg(api, monkeypatch):
    from routers import telegram as rotas_tg
    rotas_tg.limiter.enabled = False
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123:TOKEN")
    monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "webhook-secreto")
    enviadas = []
    monkeypatch.setattr(telegram_bot, "enviar_mensagem", lambda chat, texto: enviadas.append((chat, texto)))
    return SimpleNamespace(api=api, enviadas=enviadas)


def _update(texto, chat_id=555, tipo="private"):
    return {"message": {"text": texto, "chat": {"id": chat_id, "type": tipo}}}


def test_codigo_sem_token_responde_503(api, monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    assert api.post("/api/telegram/codigo").status_code == 503


def test_webhook_sem_secret_ou_com_header_errado_nao_grava(tg, supa, monkeypatch):
    r = tg.api.post("/api/telegram/webhook", json=_update("/start ABCDEFGH"))
    assert r.status_code == 401
    monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET")
    r = tg.api.post("/api/telegram/webhook", json=_update("/start ABCDEFGH"),
                    headers={"X-Telegram-Bot-Api-Secret-Token": "x"})
    assert r.status_code == 503


def test_vinculo_completo_grava_chat_e_consome_codigo(tg, supa):
    codigo = tg.api.post("/api/telegram/codigo").json()["codigo"]
    assert len(codigo) == 8
    h = {"X-Telegram-Bot-Api-Secret-Token": "webhook-secreto"}
    r = tg.api.post("/api/telegram/webhook", json=_update(f"/start {codigo}"), headers=h)
    assert r.status_code == 200
    assert tg.enviadas[-1] == (555, "Pronto. Alertas por Telegram ativados.")
    linha = supa.table("telegram_vinculos").select("*").eq("user_id", "u1").execute().data[0]
    assert linha["chat_id"] == 555 and linha["codigo"] is None
    assert tg.api.get("/api/telegram/status").json()["vinculado"] is True
    # uso único: o mesmo código não serve de novo
    tg.api.post("/api/telegram/webhook", json=_update(f"/start {codigo}"), headers=h)
    assert tg.enviadas[-1][1].startswith("Código inválido")


def test_codigo_expirado_e_grupo_nao_vinculam(tg, supa):
    codigo = tg.api.post("/api/telegram/codigo").json()["codigo"]
    supa.table("telegram_vinculos").update({"codigo_expira": "2020-01-01T00:00:00+00:00"}).eq("user_id", "u1").execute()
    h = {"X-Telegram-Bot-Api-Secret-Token": "webhook-secreto"}
    r = tg.api.post("/api/telegram/webhook", json=_update(f"/start {codigo}"), headers=h)
    assert r.status_code == 200 and tg.enviadas[-1][1].startswith("Código inválido")
    assert supa.table("telegram_vinculos").select("chat_id").eq("user_id", "u1").execute().data[0].get("chat_id") is None

    novo = tg.api.post("/api/telegram/codigo").json()["codigo"]
    tg.api.post("/api/telegram/webhook", json=_update(f"/start {novo}", tipo="group"), headers=h)
    assert tg.enviadas[-1][1].startswith("Use o bot em conversa privada")


def test_canal_telegram_com_vinculo_passa_a_ser_aceito(tg, supa):
    supa.table("telegram_vinculos").insert({"user_id": "u1", "chat_id": 555}).execute()
    r = tg.api.post("/api/alertas", json={"tipo": "vol_acima", "ticker": "SB=F", "params": {"pct": 30},
                                          "canal": "telegram"})
    assert r.status_code == 201, r.text


def test_envio_telegram_sem_vinculo_grava_erro_fixo(supa, monkeypatch):
    monkeypatch.setattr(telegram_bot, "enviar_mensagem", lambda *a: (_ for _ in ()).throw(RuntimeError("bot123:TOKEN na url")))
    regra = {"id": RID, "user_id": "u1", "canal": "telegram", "ticker": "SB=F"}
    supa.table("telegram_vinculos").insert({"user_id": "u1", "chat_id": 555}).execute()
    with pytest.raises(RuntimeError) as e:
        alertas._enviar(supa, regra, "texto", {})
    assert str(e.value) == "Falha no envio pelo Telegram"  # sem o texto da exceção (token)


# ── Briefing (BRF-01 a BRF-03) ─────────────────────────────────────────────────

def test_ultimo_dia_util_anterior_pula_fim_de_semana():
    assert briefing.ultimo_dia_util_anterior(date(2026, 11, 23)) == date(2026, 11, 20)  # segunda → sexta
    assert briefing.ultimo_dia_util_anterior(date(2026, 11, 19)) == date(2026, 11, 18)


def test_briefing_so_vai_para_quem_optou(supa, monkeypatch):
    supa.table("preferencias_usuario").insert({"user_id": "ana", "briefing_email": True}).execute()
    supa.table("preferencias_usuario").insert({"user_id": "bia", "briefing_email": False}).execute()
    supa.auth = SimpleNamespace(admin=SimpleNamespace(
        get_user_by_id=lambda uid: SimpleNamespace(user=SimpleNamespace(email=f"{uid}@x.com"))))
    supa.table("alert_events").insert({"rule_id": RID, "user_id": "ana", "dia": "2026-11-17",
                                       "mensagem": "SB=F fechou acima do nível", "enviado": True}).execute()
    comum = {"acucar": {"spot": 19.5, "var": 1.2, "data": "2026-11-18"}, "dolar": None,
             "focus": {"Câmbio": 5.6, "Selic": 14.25}, "manchetes": [{"title": "<b>Açúcar sobe</b>", "source": "F", "link": ""}]}
    monkeypatch.setattr(briefing, "conteudo_comum", lambda hoje: comum)
    enviados = []
    monkeypatch.setattr(alertas, "enviar_email", lambda destino, assunto, texto, html=None: enviados.append((destino, texto, html)))

    resumo = briefing.enviar_briefings(agora=datetime(2026, 11, 18, 10, 30, tzinfo=timezone.utc), pausa=0)
    assert resumo == {"destinatarios": 1, "enviados": 1, "sem_email": 0, "erros": 0}
    destino, texto, html = enviados[0]
    assert destino == "ana@x.com"
    assert "SB=F fechou acima do nível" in texto and "indisponível" in texto  # dólar sem dado
    assert "&lt;b&gt;Açúcar sobe" in html  # manchete escapada
