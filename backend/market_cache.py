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
  7. Return all rows from market_prices for requested range
"""

import os
from datetime import date, timedelta
from typing import Optional
import requests
import yfinance as yf
import pandas as pd
from supabase import create_client, Client

# Oracle Cloud IPs are blocked by Yahoo Finance's bot detection.
# A browser User-Agent session bypasses it.
_yf_session = requests.Session()
_yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})


def _get_service_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


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
        session=_yf_session,
    )
    if df.empty:
        return pd.DataFrame()
    df = df.reset_index()
    # yfinance returns MultiIndex columns when downloading a single ticker with auto_adjust
    # Flatten if needed
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0].lower() if col[1] == "" else col[0].lower() for col in df.columns]
    else:
        df.columns = [c.lower() for c in df.columns]
    df = df.rename(columns={"date": "date", "open": "open", "high": "high",
                             "low": "low", "close": "close", "volume": "volume"})
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["ticker"] = ticker
    return df[["ticker", "date", "open", "high", "low", "close", "volume"]]


def _upsert_prices(client: Client, df: pd.DataFrame) -> None:
    """Upsert rows into market_prices. ON CONFLICT (ticker, date) DO NOTHING."""
    if df.empty:
        return
    rows = []
    for _, row in df.iterrows():
        rows.append({
            "ticker": row["ticker"],
            "date": row["date"].isoformat(),
            "open": float(row["open"]) if pd.notna(row["open"]) else None,
            "high": float(row["high"]) if pd.notna(row["high"]) else None,
            "low": float(row["low"]) if pd.notna(row["low"]) else None,
            "close": float(row["close"]) if pd.notna(row["close"]) else None,
            "volume": int(row["volume"]) if pd.notna(row["volume"]) else None,
        })
    # Upsert in batches of 500 to avoid request size limits
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        client.table("market_prices").upsert(
            rows[i:i + batch_size],
            on_conflict="ticker,date",
            ignore_duplicates=True,
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
    Fetches from yfinance only for uncached date gaps.
    Always returns from market_prices (single source of truth).
    """
    client = _get_service_client()

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

    # Fetch and persist gaps
    for gap_start, gap_end in fetch_ranges:
        df = _fetch_from_yfinance(ticker, gap_start, gap_end)
        if not df.empty:
            _upsert_prices(client, df)
            # Use actual dates from yfinance (may differ from requested if history is shorter)
            actual_first = df["date"].min()
            actual_last = df["date"].max()
            _update_coverage(client, ticker, actual_first, actual_last)
        else:
            # MKT-04: yfinance returned nothing for this gap (history starts later)
            # If we asked for data before the asset existed, skip — do not blow up.
            # For the trailing gap, update coverage to mark "checked up to end"
            # so we don't re-query yfinance for this same empty range repeatedly.
            # We record the gap_end as coverage boundary only if we already had some coverage.
            if coverage.data:
                existing_first = date.fromisoformat(coverage.data[0]["first_date"])
                existing_last = date.fromisoformat(coverage.data[0]["last_date"])
                new_first = min(existing_first, gap_start)
                new_last = max(existing_last, gap_end)
                client.table("market_coverage").upsert(
                    {"ticker": ticker, "first_date": new_first.isoformat(), "last_date": new_last.isoformat()},
                    on_conflict="ticker",
                ).execute()

    # Read from DB
    rows = (
        client.table("market_prices")
        .select("date,open,high,low,close,volume")
        .eq("ticker", ticker)
        .gte("date", start.isoformat())
        .lte("date", end.isoformat())
        .order("date")
        .execute()
    )
    return rows.data


def backfill_ticker(ticker: str, default_start: date = date(2013, 1, 1)) -> dict:
    """
    Backfill all available yfinance history for a ticker.
    MKT-04: if yfinance history starts after default_start, uses actual earliest available date.
    Returns summary: {ticker, rows_inserted, first_date, last_date}.
    """
    client = _get_service_client()
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
