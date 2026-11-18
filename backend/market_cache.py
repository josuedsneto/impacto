"""
market_cache.py — Cache-aside price service using Supabase PostgreSQL.

Algorithm for get_prices(ticker, start, end):
  1. Query market_coverage WHERE ticker = ticker
  2. If row exists and first_date <= start AND last_date >= end:
       return rows from market_prices (fully cached)
  3. Else compute gap(s) — dates before first_date and/or after last_date
  4. Fetch gap(s) from yfinance using yf.download(ticker, start=gap_start, end=gap_end)
  5. Upsert rows into market_prices (ON CONFLICT (ticker, date) DO NOTHING)
  6. Update market_coverage: set first_date=min, last_date=max
  7. Rebusca os últimos JANELA_REBUSCA dias e sobrescreve (o "fechamento" gravado durante o
     pregão é provisório), no máximo a cada INTERVALO_REBUSCA segundos por ticker por processo
  8. Return all rows from market_prices for requested range (paginado: o PostgREST limita 1000 linhas)

Se o Yahoo falhar, registra um aviso e devolve o que já está no cache.
"""

import logging
import os
import time
from functools import lru_cache
from datetime import date, timedelta
from typing import Optional
import yfinance as yf
import pandas as pd
from supabase import create_client, Client

# Sem sessão explícita: yfinance 0.2.66 já usa curl_cffi com impersonate="chrome" por padrão,
# que é o que passa pelo bloqueio do Yahoo. Um requests.Session comum é rejeitado pela biblioteca.

logger = logging.getLogger(__name__)

JANELA_REBUSCA = 5          # dias corridos rebuscados a cada leitura recente
INTERVALO_REBUSCA = 30 * 60  # segundos entre rebuscas do mesmo ticker
TTL_NEGATIVO = 6 * 60 * 60   # segundos antes de buscar de novo um intervalo em que o Yahoo veio vazio
PAGINA = 1000               # limite de linhas por consulta do PostgREST
# ponytail: memória por processo (4 workers = até 4 rebuscas por janela); Redis se o Yahoo reclamar
_ultima_rebusca: dict[str, float] = {}
# ponytail: negativo por processo (N workers = N buscas por TTL); tabela no Supabase se isso incomodar
_negativos: dict[tuple, float] = {}  # (ticker, início da lacuna) -> instante da resposta vazia


@lru_cache(maxsize=1)
def supa_client() -> Client:
    """One service-role client per process (reuses its HTTP connection pool)."""
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _fetch_from_yfinance(ticker: str, start: date, end: date) -> pd.DataFrame:
    """
    Fetch OHLCV from yfinance for [start, end] inclusive.
    Returns DataFrame with columns: date, open, high, low, close, volume.
    Returns empty DataFrame if no data found (history shorter than requested start).
    end is made exclusive for yf.download by adding 1 day.
    """
    end_exclusive = end + timedelta(days=1)
    df = yf.download(
        ticker,
        start=start.isoformat(),
        end=end_exclusive.isoformat(),
        progress=False,
        auto_adjust=True,
    )
    if df.empty:
        return pd.DataFrame()
    df = df.reset_index()
    # yfinance returns MultiIndex columns when downloading a single ticker with auto_adjust
    # Flatten if needed
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0].lower() for col in df.columns]
    else:
        df.columns = [c.lower() for c in df.columns]
    df = df.rename(columns={"date": "date", "open": "open", "high": "high",
                             "low": "low", "close": "close", "volume": "volume"})
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["ticker"] = ticker
    return df[["ticker", "date", "open", "high", "low", "close", "volume"]]


def _buscar(ticker: str, start: date, end: date) -> Optional[pd.DataFrame]:
    """Busca no Yahoo; None quando a busca falha (exceção), DataFrame vazio quando não há pregão."""
    try:
        return _fetch_from_yfinance(ticker, start, end)
    except Exception as exc:
        logger.warning("Yahoo falhou para %s de %s a %s: %s", ticker, start, end, exc)
        return None


def _upsert_prices(client: Client, df: pd.DataFrame, sobrescrever: bool = False) -> None:
    """Grava em market_prices. Com sobrescrever=False, linhas existentes ficam como estão."""
    if df.empty:
        return
    rows = [
        {
            "ticker": row["ticker"],
            "date": row["date"].isoformat(),
            "open": float(row["open"]) if pd.notna(row["open"]) else None,
            "high": float(row["high"]) if pd.notna(row["high"]) else None,
            "low": float(row["low"]) if pd.notna(row["low"]) else None,
            "close": float(row["close"]) if pd.notna(row["close"]) else None,
            "volume": int(row["volume"]) if pd.notna(row["volume"]) else None,
        }
        for row in df.to_dict("records")
    ]
    # Upsert in batches of 500 to avoid request size limits
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        client.table("market_prices").upsert(
            rows[i:i + batch_size],
            on_conflict="ticker,date",
            ignore_duplicates=not sobrescrever,
        ).execute()


def _update_coverage(client: Client, ticker: str, first: date, last: date) -> None:
    """Upsert market_coverage row extending first/last dates."""
    existing = (
        client.table("market_coverage")
        .select("first_date,last_date")
        .eq("ticker", ticker)
        .execute()
    )
    if existing.data:
        cur_first = date.fromisoformat(existing.data[0]["first_date"])
        cur_last = date.fromisoformat(existing.data[0]["last_date"])
        new_first = min(cur_first, first)
        new_last = max(cur_last, last)
    else:
        new_first, new_last = first, last

    client.table("market_coverage").upsert(
        {"ticker": ticker, "first_date": new_first.isoformat(), "last_date": new_last.isoformat()},
        on_conflict="ticker",
    ).execute()


def get_prices(ticker: str, start: date, end: date) -> list[dict]:
    """
    Return OHLCV rows for ticker in [start, end].
    Fetches from yfinance only for uncached date gaps, refreshes the last JANELA_REBUSCA days,
    and always returns from market_prices (single source of truth).
    """
    client = supa_client()

    coverage = (
        client.table("market_coverage")
        .select("first_date,last_date")
        .eq("ticker", ticker)
        .execute()
    )

    fetch_ranges: list[tuple[date, date]] = []

    if not coverage.data:
        # Nothing cached — fetch entire range
        fetch_ranges.append((start, end))
    else:
        cached_first = date.fromisoformat(coverage.data[0]["first_date"])
        cached_last = date.fromisoformat(coverage.data[0]["last_date"])

        # Gap before cached window
        if start < cached_first:
            fetch_ranges.append((start, cached_first - timedelta(days=1)))
        # Gap after cached window
        if end > cached_last:
            fetch_ranges.append((cached_last + timedelta(days=1), end))

    # Dias recentes são rebuscados e sobrescritos; o trecho de lacuna que cai neles fica para a rebusca.
    inicio_recente = date.today() - timedelta(days=JANELA_REBUSCA)
    rebuscar = end >= inicio_recente and time.time() - _ultima_rebusca.get(ticker, 0) >= INTERVALO_REBUSCA
    if rebuscar:
        fetch_ranges = [(a, min(b, inicio_recente - timedelta(days=1))) for a, b in fetch_ranges if a < inicio_recente]

    # Fetch and persist gaps
    for gap_start, gap_end in fetch_ranges:
        # Chave sem gap_end: a rebusca recente corta o fim da lacuna, e isso não pode gerar outra chave.
        chave = (ticker, gap_start)
        if time.time() - _negativos.get(chave, 0) < TTL_NEGATIVO:
            continue  # Yahoo veio vazio para este intervalo há menos de TTL_NEGATIVO
        df = _buscar(ticker, gap_start, gap_end)
        if df is None:
            continue  # Yahoo fora: segue com o que há no cache, sem mexer na cobertura
        if not df.empty:
            _negativos.pop(chave, None)
            _upsert_prices(client, df)
            # Cobertura = intervalo consultado (fins de semana e feriados nas pontas incluídos),
            # para a próxima leitura do mesmo período não voltar ao Yahoo.
            _update_coverage(client, ticker, gap_start, gap_end)
        else:
            # Resposta vazia pode ser bloqueio do Yahoo: não marca cobertura; guarda o negativo por TTL_NEGATIVO.
            logger.warning("Yahoo sem dados para %s de %s a %s", ticker, gap_start, gap_end)
            _negativos[chave] = time.time()

    if rebuscar:
        df = _buscar(ticker, max(start, inicio_recente), end)
        if df is not None:
            _ultima_rebusca[ticker] = time.time()
            if not df.empty:
                _upsert_prices(client, df, sobrescrever=True)
                _update_coverage(client, ticker, max(start, inicio_recente), end)

    # Read from DB, page by page (PostgREST returns at most PAGINA rows per request)
    linhas: list[dict] = []
    while True:
        pagina = (
            client.table("market_prices")
            .select("date,open,high,low,close,volume")
            .eq("ticker", ticker)
            .gte("date", start.isoformat())
            .lte("date", end.isoformat())
            .order("date")
            .range(len(linhas), len(linhas) + PAGINA - 1)
            .execute()
        ).data
        linhas.extend(pagina)
        if len(pagina) < PAGINA:
            return linhas


def backfill_ticker(ticker: str, default_start: date = date(2013, 1, 1)) -> dict:
    """
    Backfill all available yfinance history for a ticker.
    MKT-04: if yfinance history starts after default_start, uses actual earliest available date.
    Returns summary: {ticker, rows_inserted, first_date, last_date}.
    """
    client = supa_client()
    today = date.today()

    # Try fetching from default_start; if empty, yfinance will return what it has
    df = _fetch_from_yfinance(ticker, default_start, today)

    if df.empty:
        return {"ticker": ticker, "rows_inserted": 0, "first_date": None, "last_date": None}

    _upsert_prices(client, df)
    actual_first = df["date"].min()
    actual_last = df["date"].max()
    _update_coverage(client, ticker, actual_first, actual_last)

    return {
        "ticker": ticker,
        "rows_inserted": len(df),
        "first_date": actual_first.isoformat(),
        "last_date": actual_last.isoformat(),
    }
