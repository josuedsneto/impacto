"""Validação de entradas da API: ticker, faixas, período e paginação. Lança HTTPException em português."""
import re
from datetime import date

from fastapi import HTTPException


ALLOWED_TICKER_RE = re.compile(r"^[A-Z0-9=.]{1,20}$")


def validate_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not ALLOWED_TICKER_RE.match(t):
        raise HTTPException(status_code=400, detail="Código de ativo inválido. Use letras, números, '=' ou '.' (ex.: SB=F).")
    return t


def _num(valor: float) -> str:
    return f"{valor:g}".replace(".", ",")


def _faixa(nome: str, valor: float, minimo: float, maximo: float) -> None:
    """HARD-01/06: 422 com mensagem em português quando o valor sai da faixa."""
    if not (minimo <= valor <= maximo):
        raise HTTPException(status_code=422, detail=f"{nome} deve estar entre {_num(minimo)} e {_num(maximo)}.")


def _validar_periodo(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(status_code=400, detail="A data final precisa ser igual ou posterior à data inicial.")
    if (end - start).days > MAX_DIAS_PERIODO:
        raise HTTPException(status_code=422, detail="O período não pode passar de 25 anos.")


def _validar_paginacao(limit: int, offset: int) -> None:
    _faixa("O limite", limit, 1, 200)
    _faixa("O deslocamento (offset)", offset, 0, 100_000)


def _lista_periodos(nome: str, texto: str) -> list[int]:
    """Lista '20,50' → [20, 50]. Até 5 períodos, cada um de 2 a 250 (HARD-01)."""
    valores = []
    for parte in (p.strip() for p in texto.split(",")):
        if not parte:
            continue
        if not parte.isdigit() or len(parte) > 6:
            raise HTTPException(status_code=422, detail=f"Os períodos de {nome} devem ser números inteiros (ex.: 20,50).")
        valores.append(int(parte))
    if len(valores) > 5:
        raise HTTPException(status_code=422, detail=f"Use no máximo 5 médias {nome}.")
    for v in valores:
        _faixa(f"Cada média {nome}", v, 2, 250)
    return valores


MAX_DIAS_PERIODO = 25 * 365
