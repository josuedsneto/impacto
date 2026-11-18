"""
taxas.py — séries de juros usadas no forward do câmbio.

Selic meta: BCB SGS 432 (% a.a., base 252), via API pública.
Fed funds: FRED DFF pelo CSV público (sem chave de API).
Sem I/O em import; cada função faz uma chamada HTTP com timeout.
"""

from __future__ import annotations

import io
from datetime import date

import pandas as pd
import requests

TIMEOUT = 30
_SGS_SELIC = 432
_FRED_DFF_CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF"


def _selic_bloco(inicio: date, fim: date) -> list[dict]:
    url = (
        f"https://api.bcb.gov.br/dados/serie/bcdata.sgs.{_SGS_SELIC}/dados"
        f"?formato=json&dataInicial={inicio:%d/%m/%Y}&dataFinal={fim:%d/%m/%Y}"
    )
    try:
        dados = requests.get(url, timeout=TIMEOUT).json()
    except (requests.RequestException, ValueError):
        return []
    return dados if isinstance(dados, list) else []  # erro da API vem como objeto, não lista


def selic_serie(inicio: date, fim: date) -> pd.Series:
    """Selic meta diária em % a.a. (índice de datas). Vazia se a API falhar.
    A API do BCB recusa séries diárias de mais de 10 anos: busca em blocos de 9 anos."""
    dados: list[dict] = []
    cursor = inicio
    while cursor <= fim:
        bloco_fim = min(fim, date(cursor.year + 9, 12, 31))
        dados.extend(_selic_bloco(cursor, bloco_fim))
        cursor = date(bloco_fim.year + 1, 1, 1)
    if not dados:
        return pd.Series(dtype=float)
    datas = pd.to_datetime([d["data"] for d in dados], dayfirst=True)
    valores = [float(str(d["valor"]).replace(",", ".")) for d in dados]
    return pd.Series(valores, index=datas).sort_index()


def fed_funds_serie(inicio: date, fim: date) -> pd.Series:
    """Fed funds efetiva diária em % a.a. (índice de datas). Vazia se o FRED falhar."""
    try:
        resp = requests.get(_FRED_DFF_CSV, timeout=TIMEOUT)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), na_values=["."])
    except (requests.RequestException, ValueError):
        return pd.Series(dtype=float)
    df.columns = ["data", "valor"]
    df["data"] = pd.to_datetime(df["data"])
    df = df.dropna().set_index("data")["valor"].astype(float)
    return df[(df.index >= pd.Timestamp(inicio)) & (df.index <= pd.Timestamp(fim))]


def ultimo_valor(serie: pd.Series) -> float | None:
    """Último valor não nulo da série, ou None."""
    serie = serie.dropna()
    return float(serie.iloc[-1]) if len(serie) else None
