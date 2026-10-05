"""CACHE-01/03/04: cache de preços (dados-mercado-cache)."""
import logging
from datetime import date, timedelta

import market_cache
from conftest import dias_uteis

HOJE = date.today()


def test_pagina_alem_do_limite_do_postgrest(supa, yahoo):
    """Leitura longa (ex.: Metas desde 2013) devolve todas as linhas, não só as primeiras 1000."""
    ini, fim = date(2013, 1, 1), date(2022, 12, 31)
    dias = list(dias_uteis(ini, fim))
    supa.gravar_precos("SB=F", {d: 20.0 for d in dias})
    supa.cobertura("SB=F", ini, fim)
    linhas = market_cache.get_prices("SB=F", ini, fim)
    assert len(dias) > 2000
    assert len(linhas) == len(dias)
    assert linhas[-1]["date"] == dias[-1].isoformat()


def test_segunda_leitura_de_periodo_antigo_nao_chama_o_yahoo(supa, yahoo):
    """CACHE-01 AC3."""
    ini, fim = date(2020, 1, 1), date(2020, 3, 31)
    market_cache.get_prices("SB=F", ini, fim)
    chamadas = len(yahoo.chamadas)
    assert chamadas >= 1
    market_cache.get_prices("SB=F", ini, fim)
    assert len(yahoo.chamadas) == chamadas


def test_rebusca_sobrescreve_o_fechamento_recente(supa, yahoo):
    """CACHE-03 AC1 e AC3: o valor gravado durante o pregão é corrigido."""
    ontem = max(d for d in dias_uteis(HOJE - timedelta(days=4), HOJE - timedelta(days=1)))
    supa.gravar_precos("SB=F", {ontem: 1.0})
    supa.cobertura("SB=F", HOJE - timedelta(days=30), HOJE)
    yahoo.preco = lambda d: 2.0
    linhas = market_cache.get_prices("SB=F", HOJE - timedelta(days=10), HOJE)
    assert {r["date"]: r["close"] for r in linhas}[ontem.isoformat()] == 2.0


def test_rebusca_no_maximo_a_cada_30_minutos(supa, yahoo):
    """CACHE-03 AC2."""
    supa.cobertura("SB=F", HOJE - timedelta(days=30), HOJE)
    market_cache.get_prices("SB=F", HOJE - timedelta(days=10), HOJE)
    chamadas = len(yahoo.chamadas)
    assert chamadas == 1
    market_cache.get_prices("SB=F", HOJE - timedelta(days=10), HOJE)
    assert len(yahoo.chamadas) == chamadas
    # passado o intervalo, rebusca de novo
    market_cache._ultima_rebusca["SB=F"] -= market_cache.INTERVALO_REBUSCA + 1
    market_cache.get_prices("SB=F", HOJE - timedelta(days=10), HOJE)
    assert len(yahoo.chamadas) == chamadas + 1


def test_yahoo_fora_devolve_o_cache_e_avisa(supa, yahoo, caplog):
    """CACHE-04 AC1."""
    ini = HOJE - timedelta(days=40)
    gravados = {d: 20.0 for d in dias_uteis(ini, HOJE - timedelta(days=10))}
    supa.gravar_precos("SB=F", gravados)
    supa.cobertura("SB=F", ini, HOJE - timedelta(days=10))
    yahoo.falhar = True
    with caplog.at_level(logging.WARNING, logger="market_cache"):
        linhas = market_cache.get_prices("SB=F", ini, HOJE)
    assert len(linhas) == len(gravados)
    assert any("Yahoo falhou para SB=F" in m for m in caplog.messages)
    # a cobertura não avança sobre dias que não foram buscados
    assert supa.db["market_coverage"][("SB=F",)]["last_date"] == (HOJE - timedelta(days=10)).isoformat()


def test_falha_nao_bloqueia_a_proxima_tentativa(supa, yahoo):
    """Depois de uma falha, a rebusca não espera 30 minutos para tentar de novo."""
    supa.cobertura("SB=F", HOJE - timedelta(days=30), HOJE)
    yahoo.falhar = True
    market_cache.get_prices("SB=F", HOJE - timedelta(days=10), HOJE)
    yahoo.falhar = False
    antes = len(yahoo.chamadas)
    market_cache.get_prices("SB=F", HOJE - timedelta(days=10), HOJE)
    assert len(yahoo.chamadas) == antes + 1
