"""MR-01 (main-routers): contrato HTTP das rotas.

A lista abaixo é a foto de (método, path, nomes dos parâmetros, status_code, limite de rate)
tirada de main.app.routes ANTES da divisão do main.py em routers. Não pode mudar durante a
refatoração: se o teste quebrar, uma rota mudou de contrato.

Excluídas: /api/alertas e /api/jobs (routers em evolução em outra frente; ficam de fora desta foto).
"""
import inspect

from fastapi.routing import APIRoute

import main
from limiter import limiter

CONTRATO = [
    ('GET', '/api/admin/config', ('request', 'user'), None, '20 per 1 minute'),
    ('PUT', '/api/admin/config/{key}', ('request', 'key', 'body', 'user'), None, '20 per 1 minute'),
    ('POST', '/api/admin/market/backfill/{ticker}', ('request', 'ticker', 'user'), None, '5 per 1 minute'),
    ('GET', '/api/admin/suggestions', ('request', 'user', 'status', 'limit', 'offset'), None, '20 per 1 minute'),
    ('PATCH', '/api/admin/suggestions/{suggestion_id}', ('request', 'suggestion_id', 'body', 'user'), None, '20 per 1 minute'),
    ('GET', '/api/admin/usinas', ('request', '_'), None, '20 per 1 minute'),
    ('POST', '/api/admin/usinas', ('request', 'body', '_'), None, '10 per 1 minute'),
    ('DELETE', '/api/admin/usinas/{usina_id}', ('request', 'usina_id', '_'), None, '10 per 1 minute'),
    ('GET', '/api/admin/usinas/{usina_id}/usuarios', ('request', 'usina_id', '_'), None, '20 per 1 minute'),
    ('DELETE', '/api/admin/usinas/{usina_id}/usuarios/{user_id_target}', ('request', 'usina_id', 'user_id_target', '_'), None, '10 per 1 minute'),
    ('POST', '/api/admin/usinas/{usina_id}/usuarios/{user_id_target}', ('request', 'usina_id', 'user_id_target', '_'), None, '10 per 1 minute'),
    ('GET', '/api/admin/usuarios', ('request', '_'), None, '10 per 1 minute'),
    ('GET', '/api/analises', ('request', 'user', 'ferramenta', 'limit', 'offset'), None, '60 per 1 minute'),
    ('POST', '/api/analises', ('request', 'body', 'user'), 201, '30 per 1 minute'),
    ('DELETE', '/api/analises/{analise_id}', ('request', 'analise_id', 'user'), None, '30 per 1 minute'),
    ('GET', '/api/analises/{analise_id}', ('request', 'analise_id', 'user'), None, '60 per 1 minute'),
    ('PATCH', '/api/analises/{analise_id}', ('request', 'analise_id', 'body', 'user'), None, '30 per 1 minute'),
    ('GET', '/api/arima/{ticker}', ('request', 'ticker', 'steps', 'user'), None, '10 per 1 minute'),
    ('GET', '/api/atr/historico', ('request', 'usina_id', 'user'), None, '30 per 1 minute'),
    ('PATCH', '/api/atr/simulacoes/{sim_id}/compartilhar', ('request', 'sim_id', 'body', 'user'), None, '20 per 1 minute'),
    ('POST', '/api/atr/simulate', ('request', 'body', 'user'), None, '20 per 1 minute'),
    ('GET', '/api/atr/usinas', ('request', 'user'), None, '30 per 1 minute'),
    ('GET', '/api/breakeven', ('request', 'user'), None, '30 per 1 minute'),
    ('GET', '/api/breakeven/history', ('request', 'user', 'limit', 'offset'), None, '60 per 1 minute'),
    ('POST', '/api/breakeven/save', ('request', 'body', 'user'), 201, '30 per 1 minute'),
    ('GET', '/api/cambio/previsao', ('request', 'horizonte', 'niveis', 'user'), None, '10 per 1 minute'),
    ('POST', '/api/cenarios', ('request', 'body', 'user'), None, '20 per 1 minute'),
    ('GET', '/api/cenarios/history', ('request', 'user', 'limit'), None, '60 per 1 minute'),
    ('POST', '/api/cenarios/save', ('request', 'body', 'user'), 201, '30 per 1 minute'),
    ('GET', '/api/focus', ('request', 'user'), None, '20 per 1 minute'),
    ('GET', '/api/health', ('request', 'deep'), None, '30 per 1 minute'),
    ('POST', '/api/hedge-cambial', ('request', 'body', 'user'), None, '10 per 1 minute'),
    ('POST', '/api/jump-diffusion', ('request', 'body', 'user'), None, '15 per 1 minute'),
    ('GET', '/api/market/analysis', ('request', 'ticker', 'start', 'end', 'user', 'indicators', 'rsi_period', 'bb_window', 'bb_std', 'macd_fast', 'macd_slow', 'macd_signal', 'stoch_k', 'stoch_d', 'cci_period', 'sma_periods', 'ema_periods'), None, '20 per 1 minute'),
    ('GET', '/api/market/prices', ('request', 'ticker', 'start', 'end', 'user'), None, '30 per 1 minute'),
    ('GET', '/api/market/status', ('request', 'ticker', 'user'), None, '30 per 1 minute'),
    ('POST', '/api/market/suggest', ('request', 'body', 'user'), None, '10 per 1 minute'),
    ('GET', '/api/me', ('request', 'user'), None, '60 per 1 minute'),
    ('GET', '/api/metas', ('request', 'meta', 'user'), None, '20 per 1 minute'),
    ('GET', '/api/news', ('request', 'user'), None, '20 per 1 minute'),
    ('POST', '/api/options/bs-price', ('request', 'body', 'user'), None, '60 per 1 minute'),
    ('POST', '/api/options/mc-price', ('request', 'body', 'user'), None, '60 per 1 minute'),
    ('POST', '/api/options/payoff', ('request', 'body', 'user'), None, '30 per 1 minute'),
    ('GET', '/api/params/{ticker}', ('request', 'ticker', 'user'), None, '60 per 1 minute'),
    ('PUT', '/api/params/{ticker}', ('request', 'ticker', 'body', 'user'), None, '30 per 1 minute'),
    ('GET', '/api/politica-hedge', ('request', 'usina_id', 'safra', 'user'), None, '30 per 1 minute'),
    ('PUT', '/api/politica-hedge', ('request', 'body', 'user'), None, '20 per 1 minute'),
    ('POST', '/api/posicoes', ('request', 'body', 'user'), 201, '20 per 1 minute'),
    ('POST', '/api/posicoes/lote', ('request', 'body', 'user'), 201, '5 per 1 minute'),
    ('GET', '/api/posicoes/resumo', ('request', 'usina_id', 'safra', 'user'), None, '30 per 1 minute'),
    ('DELETE', '/api/posicoes/{pos_id}', ('request', 'pos_id', 'user'), None, '20 per 1 minute'),
    ('PUT', '/api/posicoes/{pos_id}', ('request', 'pos_id', 'body', 'user'), None, '20 per 1 minute'),
    ('GET', '/api/regression/acucar/defaults', ('request', 'user'), None, '20 per 1 minute'),
    ('POST', '/api/regression/acucar/run', ('request', 'body', 'user'), None, '10 per 1 minute'),
    ('GET', '/api/regression/dolar/defaults', ('request', 'user'), None, '20 per 1 minute'),
    ('POST', '/api/regression/dolar/run', ('request', 'body', 'user'), None, '10 per 1 minute'),
    ('GET', '/api/regression/runs', ('request', 'tipo', 'user'), None, '20 per 1 minute'),
    ('POST', '/api/risco', ('request', 'body', 'user'), None, '10 per 1 minute'),
    ('POST', '/api/risco-conjunto', ('request', 'body', 'user'), None, '10 per 1 minute'),
    ('GET', '/api/risco/history', ('request', 'user', 'limit'), None, '60 per 1 minute'),
    ('POST', '/api/risco/save', ('request', 'body', 'user'), 201, '30 per 1 minute'),
    ('GET', '/api/simulations', ('request', 'user', 'limit', 'offset'), None, '60 per 1 minute'),
    ('POST', '/api/simulations', ('request', 'body', 'user'), 201, '10 per 1 minute'),
    ('GET', '/api/simulations/{sim_id}', ('request', 'sim_id', 'user'), None, '60 per 1 minute'),
    ('GET', '/api/stress', ('request', 'ticker', 'user'), None, '10 per 1 minute'),
    ('GET', '/api/var', ('request', 'ticker', 'confidence', 'horizon', 'user'), None, '10 per 1 minute'),
    ('GET', '/api/volatility', ('request', 'ticker', 'user'), None, '10 per 1 minute'),
]


def _limite(endpoint):
    lims = limiter._route_limits.get(f"{endpoint.__module__}.{endpoint.__name__}", [])
    return " + ".join(sorted(str(lim.limit) for lim in lims)) or None


def _foto_atual():
    fotos = []
    for rota in main.app.routes:
        if not isinstance(rota, APIRoute):
            continue
        if rota.path.startswith(("/api/alertas", "/api/jobs")):
            continue
        params = tuple(inspect.signature(rota.endpoint).parameters)
        for metodo in sorted(rota.methods):
            fotos.append((metodo, rota.path, params, rota.status_code, _limite(rota.endpoint)))
    return sorted(fotos, key=lambda t: (t[1], t[0]))


def test_contrato_das_rotas_nao_muda():
    assert _foto_atual() == sorted(CONTRATO, key=lambda t: (t[1], t[0]))
