"""Situação de uma safra contra a política de hedge (posicoes-fixacoes R2–R4, R8). Função pura, sem I/O.

Usada por GET /api/posicoes/resumo e pelo alerta posicao_limite (alertas-v2, DEC-22).
"""
from typing import Optional

ACUCAR = ("fixacao_acucar", "futuro_acucar", "opcao_acucar")


def situacao(posicoes: list[dict], politica: Optional[dict]) -> dict:
    """% fixado da safra (volume de açúcar ÷ produção estimada) e status contra a faixa da política."""
    producao = politica.get("producao_estimada_t") if politica else None
    minimo = politica.get("minimo_pct") if politica else None
    maximo = politica.get("maximo_pct") if politica else None

    vol_acucar = sum(p["volume"] for p in posicoes if p["instrumento"] in ACUCAR)
    pct = round(vol_acucar / producao * 100, 2) if producao else None

    if politica is None:
        status = "sem_politica"
    elif not producao:
        status = "sem_producao"
    else:
        lo = minimo or 0
        hi = 100 if maximo is None else maximo
        status = "abaixo" if pct < lo else "acima" if pct > hi else "dentro"

    return {"pct_fixado": pct, "minimo_pct": minimo, "maximo_pct": maximo,
            "producao_estimada_t": producao, "status": status}
