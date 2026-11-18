"""Nenhuma rota pode receber o usuário como query param: isso significa que Depends(get_current_user) não foi aplicado.

Acontece, por exemplo, com `from __future__ import annotations` num router que usa Annotated[..., Depends(...)].
"""
from fastapi.routing import APIRoute

import main


def test_nenhuma_rota_recebe_user_como_query_param():
    sem_auth = [
        r.path
        for r in main.app.routes
        if isinstance(r, APIRoute) and any(p.name == "user" for p in r.dependant.query_params)
    ]
    assert sem_auth == []
