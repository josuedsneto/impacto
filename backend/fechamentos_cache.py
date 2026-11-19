"""Série de fechamentos lida pelo cache de preços, usada por VaR, ARIMA, stress e volatilidade."""
from datetime import date

from fastapi import HTTPException

from market_cache import serie_fechamentos


INICIO_ESTRESSE = date(2007, 1, 1)


def fechamentos(ticker: str, inicio: date, fim: date | None = None):
    """
    Série de fechamentos (pandas, índice de datas) e a data do último dado, lidas pelo cache.
    503 com mensagem em português quando não há nenhum preço (Yahoo fora e cache vazio).
    """
    serie = serie_fechamentos(ticker, inicio, fim)
    if serie.empty:
        raise HTTPException(
            status_code=503,
            detail=f"Não foi possível obter os preços de {ticker} agora. Tente novamente em alguns minutos.",
        )
    return serie, serie.index[-1].strftime("%Y-%m-%d")
