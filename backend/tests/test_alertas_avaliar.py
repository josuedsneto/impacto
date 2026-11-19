"""ALE-02/03: avaliação pura, transição e paridade da volatilidade (sem rede)."""
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
import pytest
from pydantic import ValidationError

import alertas
from alertas import DadosInsuficientes

AGORA = datetime(2026, 11, 18, 21, 0, tzinfo=timezone.utc)


def _serie(fechs, fim="2026-11-17"):
    """Linhas no formato de get_prices: uma por dia útil, terminando em `fim`."""
    from datetime import date

    d_fim = date.fromisoformat(fim)
    dias = []
    d = d_fim
    while len(dias) < len(fechs):
        if d.weekday() < 5:
            dias.append(d)
        d -= timedelta(days=1)
    dias.reverse()
    return [{"date": d.isoformat(), "close": c} for d, c in zip(dias, fechs)]


def _regra(tipo, params, **extra):
    return {"id": "r1", "user_id": "u1", "tipo": tipo, "ticker": "SB=F", "params": params, **extra}


# ── avaliar ────────────────────────────────────────────────────────────────────

def test_preco_cruza_acima_usa_ultimo_fechamento():
    cond, valor, msg = alertas.avaliar(_regra("preco_cruza", {"nivel": 10.5, "direcao": "acima"}), _serie([10, 11]))
    assert cond is True and valor == 11
    assert "11,0000" in msg and "17/11/2026" in msg


def test_preco_cruza_abaixo_e_o_inverso():
    cond, _, _ = alertas.avaliar(_regra("preco_cruza", {"nivel": 10.5, "direcao": "abaixo"}), _serie([10, 11]))
    assert cond is False


def test_variacao_diaria_compara_os_dois_ultimos():
    cond, valor, _ = alertas.avaliar(_regra("variacao_diaria", {"pct": 2}), _serie([100, 103]))
    assert cond is True and round(valor, 6) == 3.0
    cond2, _, _ = alertas.avaliar(_regra("variacao_diaria", {"pct": 2}), _serie([100, 101]))
    assert cond2 is False


def test_variacao_diaria_queda_tambem_conta():
    cond, valor, _ = alertas.avaliar(_regra("variacao_diaria", {"pct": 2}), _serie([100, 97]))
    assert cond is True and round(valor, 6) == -3.0


def test_fechamento_none_e_descartado():
    serie = _serie([10, None, 11])
    cond, valor, _ = alertas.avaliar(_regra("preco_cruza", {"nivel": 10.5, "direcao": "acima"}), serie)
    assert valor == 11


def test_sem_dados_levanta_dados_insuficientes():
    with pytest.raises(DadosInsuficientes):
        alertas.avaliar(_regra("preco_cruza", {"nivel": 1, "direcao": "acima"}), [])
    with pytest.raises(DadosInsuficientes):
        alertas.avaliar(_regra("variacao_diaria", {"pct": 1}), _serie([10]))
    with pytest.raises(DadosInsuficientes):
        alertas.avaliar(_regra("vol_acima", {"pct": 1}), _serie([10 + i * 0.1 for i in range(30)]))


def test_vol_acima_bate_com_a_conta_de_volatility():
    """DEC-13 / ALE-02 AC6: mesma fórmula de main.py (pandas, ddof=1, √252), em %."""
    closes = [20 + np.sin(i / 3) + (i % 5) * 0.2 for i in range(60)]
    closes[10] = None  # fechamento nulo é descartado antes do log-retorno
    s = pd.Series([c for c in closes if c is not None], dtype=float)
    esperado = float(np.log(s / s.shift(1)).dropna().iloc[-30:].std(ddof=1) * np.sqrt(252) * 100)

    serie = _serie(closes, fim="2026-11-17")
    cond, valor, _ = alertas.avaliar(_regra("vol_acima", {"pct": 1}), serie)
    assert valor == pytest.approx(esperado, rel=1e-12)
    assert cond is True


def test_vol_acima_limite_acima_do_valor_nao_dispara():
    closes = [20 + np.sin(i / 3) for i in range(60)]
    cond, valor, _ = alertas.avaliar(_regra("vol_acima", {"pct": 500}), _serie(closes))
    assert cond is False and valor < 500


# ── transição e cooldown ───────────────────────────────────────────────────────

def test_estado_nulo_nao_dispara_na_primeira_avaliacao():
    assert alertas.deve_disparar({"ultimo_estado": None, "cooldown_horas": 24}, True, AGORA) is False


def test_falso_para_verdadeiro_dispara_uma_vez():
    regra = {"ultimo_estado": False, "ultimo_disparo": None, "cooldown_horas": 24}
    assert alertas.deve_disparar(regra, True, AGORA) is True


def test_verdadeiro_para_verdadeiro_nao_repete():
    regra = {"ultimo_estado": True, "ultimo_disparo": None, "cooldown_horas": 24}
    assert alertas.deve_disparar(regra, True, AGORA) is False


def test_condicao_falsa_nunca_dispara():
    regra = {"ultimo_estado": False, "ultimo_disparo": None, "cooldown_horas": 24}
    assert alertas.deve_disparar(regra, False, AGORA) is False


def test_cooldown_bloqueia_e_depois_libera():
    ultimo = (AGORA - timedelta(hours=10)).isoformat()
    regra = {"ultimo_estado": False, "ultimo_disparo": ultimo, "cooldown_horas": 24}
    assert alertas.deve_disparar(regra, True, AGORA) is False
    assert alertas.deve_disparar(regra, True, AGORA + timedelta(hours=15)) is True


# ── schemas ────────────────────────────────────────────────────────────────────

def test_params_por_tipo_rejeitam_valor_fora_do_schema():
    with pytest.raises(ValidationError):
        alertas.validar_params("preco_cruza", {"nivel": -1, "direcao": "acima"})
    with pytest.raises(ValidationError):
        alertas.validar_params("preco_cruza", {"nivel": 1, "direcao": "lateral"})
    with pytest.raises(ValidationError):
        alertas.validar_params("variacao_diaria", {"pct": 0})
    assert alertas.validar_params("vol_acima", {"pct": 30}) == {"pct": 30.0}


def test_prob_cruzar_e_posicao_limite_estao_disponiveis():
    assert "prob_cruzar" in alertas.TIPOS_DISPONIVEIS
    assert "posicao_limite" in alertas.TIPOS_DISPONIVEIS
    assert alertas.validar_params("prob_cruzar", {"nivel": 5.5, "direcao": "acima", "horizonte": 30, "prob": 0.6})
