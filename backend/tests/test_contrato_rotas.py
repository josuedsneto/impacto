"""MR-01 (main-routers): contrato HTTP das rotas.

A lista abaixo é a foto de (método, path, nomes dos parâmetros, status_code, limite de rate)
tirada de main.app.routes ANTES da divisão do main.py em routers. Não pode mudar durante a
refatoração: se o teste quebrar, uma rota mudou de contrato.

Incluídas depois da integração da rodada 2 (alertas v2 e telegram): /api/alertas, /api/jobs, /api/telegram.
As rotas de antes da divisão não mudaram: a lista antiga (67) é subconjunto da atual.
"""
import inspect

from fastapi.routing import APIRoute

import main
from limiter import limiter

CONTRATO = [
    ('GET', '/api/admin/config', ('request', 'user'), ('require_admin',), None, '20 per 1 minute'),
    ('PUT', '/api/admin/config/{key}', ('request', 'key', 'body', 'user'), ('require_admin',), None, '20 per 1 minute'),
    ('POST', '/api/admin/market/backfill/{ticker}', ('request', 'ticker', 'user'), ('require_admin',), None, '5 per 1 minute'),
    ('GET', '/api/admin/suggestions', ('request', 'user', 'status', 'limit', 'offset'), ('require_admin',), None, '20 per 1 minute'),
    ('PATCH', '/api/admin/suggestions/{suggestion_id}', ('request', 'suggestion_id', 'body', 'user'), ('require_admin',), None, '20 per 1 minute'),
    ('GET', '/api/admin/usinas', ('request', '_'), ('require_admin',), None, '20 per 1 minute'),
    ('POST', '/api/admin/usinas', ('request', 'body', '_'), ('require_admin',), None, '10 per 1 minute'),
    ('DELETE', '/api/admin/usinas/{usina_id}', ('request', 'usina_id', '_'), ('require_admin',), None, '10 per 1 minute'),
    ('GET', '/api/admin/usinas/{usina_id}/usuarios', ('request', 'usina_id', '_'), ('require_admin',), None, '20 per 1 minute'),
    ('DELETE', '/api/admin/usinas/{usina_id}/usuarios/{user_id_target}', ('request', 'usina_id', 'user_id_target', '_'), ('require_admin',), None, '10 per 1 minute'),
    ('POST', '/api/admin/usinas/{usina_id}/usuarios/{user_id_target}', ('request', 'usina_id', 'user_id_target', '_'), ('require_admin',), None, '10 per 1 minute'),
    ('GET', '/api/admin/usuarios', ('request', '_'), ('require_admin',), None, '10 per 1 minute'),
    ('GET', '/api/alertas', ('user',), ('get_current_user',), None, None),
    ('POST', '/api/alertas', ('request', 'body', 'user'), ('get_current_user',), 201, '30 per 1 minute'),
    ('GET', '/api/alertas/eventos', ('user', 'rule_id'), ('get_current_user',), None, None),
    ('DELETE', '/api/alertas/{rule_id}', ('rule_id', 'user'), ('get_current_user',), 204, None),
    ('PATCH', '/api/alertas/{rule_id}', ('rule_id', 'body', 'user'), ('get_current_user',), None, None),
    ('POST', '/api/alertas/{rule_id}/testar', ('request', 'rule_id', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('GET', '/api/analises', ('request', 'user', 'ferramenta', 'limit', 'offset'), ('get_current_user',), None, '60 per 1 minute'),
    ('POST', '/api/analises', ('request', 'body', 'user'), ('get_current_user',), 201, '30 per 1 minute'),
    ('DELETE', '/api/analises/{analise_id}', ('request', 'analise_id', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/analises/{analise_id}', ('request', 'analise_id', 'user'), ('get_current_user',), None, '60 per 1 minute'),
    ('PATCH', '/api/analises/{analise_id}', ('request', 'analise_id', 'body', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/painel/hoje', ('request', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/arima/{ticker}', ('request', 'ticker', 'steps', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('GET', '/api/atr/historico', ('request', 'usina_id', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('PATCH', '/api/atr/simulacoes/{sim_id}/compartilhar', ('request', 'sim_id', 'body', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('POST', '/api/atr/simulate', ('request', 'body', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('GET', '/api/atr/usinas', ('request', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/breakeven', ('request', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/breakeven/history', ('request', 'user', 'limit', 'offset'), ('get_current_user',), None, '60 per 1 minute'),
    ('POST', '/api/breakeven/save', ('request', 'body', 'user'), ('get_current_user',), 201, '30 per 1 minute'),
    ('GET', '/api/cambio/previsao', ('request', 'horizonte', 'niveis', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('POST', '/api/cenarios', ('request', 'body', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('GET', '/api/cenarios/history', ('request', 'user', 'limit'), ('get_current_user',), None, '60 per 1 minute'),
    ('POST', '/api/cenarios/save', ('request', 'body', 'user'), ('get_current_user',), 201, '30 per 1 minute'),
    ('GET', '/api/focus', ('request', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('GET', '/api/health', ('request', 'deep'), (), None, '30 per 1 minute'),
    ('POST', '/api/hedge-cambial', ('request', 'body', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('POST', '/api/jobs/alertas', ('tipos',), ('require_job_secret',), None, None),
    ('POST', '/api/jobs/aquecer-cache', (), ('require_job_secret',), None, None),
    ('POST', '/api/jobs/briefing', (), ('require_job_secret',), None, None),
    ('POST', '/api/jump-diffusion', ('request', 'body', 'user'), ('get_current_user',), None, '15 per 1 minute'),
    ('GET', '/api/market/analysis', ('request', 'ticker', 'start', 'end', 'user', 'indicators', 'rsi_period', 'bb_window', 'bb_std', 'macd_fast', 'macd_slow', 'macd_signal', 'stoch_k', 'stoch_d', 'cci_period', 'sma_periods', 'ema_periods'), ('get_current_user',), None, '20 per 1 minute'),
    ('GET', '/api/market/prices', ('request', 'ticker', 'start', 'end', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/market/status', ('request', 'ticker', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('POST', '/api/market/suggest', ('request', 'body', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('GET', '/api/me', ('request', 'user'), ('get_current_user',), None, '60 per 1 minute'),
    ('GET', '/api/metas', ('request', 'meta', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('GET', '/api/news', ('request', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('POST', '/api/options/bs-price', ('request', 'body', 'user'), ('get_current_user',), None, '60 per 1 minute'),
    ('POST', '/api/options/mc-price', ('request', 'body', 'user'), ('get_current_user',), None, '60 per 1 minute'),
    ('POST', '/api/options/payoff', ('request', 'body', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/params/{ticker}', ('request', 'ticker', 'user'), ('get_current_user',), None, '60 per 1 minute'),
    ('PUT', '/api/params/{ticker}', ('request', 'ticker', 'body', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('GET', '/api/politica-hedge', ('request', 'usina_id', 'safra', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('PUT', '/api/politica-hedge', ('request', 'body', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('POST', '/api/posicoes', ('request', 'body', 'user'), ('get_current_user',), 201, '20 per 1 minute'),
    ('POST', '/api/posicoes/lote', ('request', 'body', 'user'), ('get_current_user',), 201, '5 per 1 minute'),
    ('GET', '/api/posicoes/resumo', ('request', 'usina_id', 'safra', 'user'), ('get_current_user',), None, '30 per 1 minute'),
    ('DELETE', '/api/posicoes/{pos_id}', ('request', 'pos_id', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('PUT', '/api/posicoes/{pos_id}', ('request', 'pos_id', 'body', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('GET', '/api/regression/acucar/defaults', ('request', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('POST', '/api/regression/acucar/run', ('request', 'body', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('GET', '/api/regression/dolar/defaults', ('request', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('POST', '/api/regression/dolar/run', ('request', 'body', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('GET', '/api/regression/runs', ('request', 'tipo', 'user'), ('get_current_user',), None, '20 per 1 minute'),
    ('POST', '/api/risco', ('request', 'body', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('POST', '/api/risco-conjunto', ('request', 'body', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('GET', '/api/risco/history', ('request', 'user', 'limit'), ('get_current_user',), None, '60 per 1 minute'),
    ('POST', '/api/risco/save', ('request', 'body', 'user'), ('get_current_user',), 201, '30 per 1 minute'),
    ('GET', '/api/simulations', ('request', 'user', 'limit', 'offset'), ('get_current_user',), None, '60 per 1 minute'),
    ('POST', '/api/simulations', ('request', 'body', 'user'), ('get_current_user',), 201, '10 per 1 minute'),
    ('GET', '/api/simulations/{sim_id}', ('request', 'sim_id', 'user'), ('get_current_user',), None, '60 per 1 minute'),
    ('GET', '/api/stress', ('request', 'ticker', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('POST', '/api/telegram/codigo', ('request', 'user'), ('get_current_user',), None, '5 per 1 minute'),
    ('GET', '/api/telegram/status', ('user',), ('get_current_user',), None, None),
    ('DELETE', '/api/telegram/vinculo', ('user',), ('get_current_user',), 204, None),
    ('POST', '/api/telegram/webhook', ('update', 'x_telegram_bot_api_secret_token'), (), None, None),
    ('GET', '/api/var', ('request', 'ticker', 'confidence', 'horizon', 'user'), ('get_current_user',), None, '10 per 1 minute'),
    ('GET', '/api/volatility', ('request', 'ticker', 'user'), ('get_current_user',), None, '10 per 1 minute'),
]


def _dependencias(rota):
    return tuple(d.call.__name__ for d in rota.dependant.dependencies)


def _limite(endpoint):
    lims = limiter._route_limits.get(f"{endpoint.__module__}.{endpoint.__name__}", [])
    return " + ".join(sorted(str(lim.limit) for lim in lims)) or None


def _foto_atual():
    fotos = []
    for rota in main.app.routes:
        if not isinstance(rota, APIRoute):
            continue
        params = tuple(inspect.signature(rota.endpoint).parameters)
        deps = _dependencias(rota)
        for metodo in sorted(rota.methods):
            fotos.append((metodo, rota.path, params, deps, rota.status_code, _limite(rota.endpoint)))
    return sorted(fotos, key=lambda t: (t[1], t[0]))


def test_contrato_das_rotas_nao_muda():
    assert _foto_atual() == sorted(CONTRATO, key=lambda t: (t[1], t[0]))
