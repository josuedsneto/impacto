"""
analysis.py — Technical indicator computation and signal generation.

All functions accept a pandas DataFrame with columns:
  date (index, datetime), open, high, low, close, volume

Returns the same DataFrame with additional computed columns,
plus a list of signal dicts: {date, type, indicator, price}
"""

from __future__ import annotations
from dataclasses import dataclass, field
import pandas as pd
import pandas_ta as ta


@dataclass
class IndicatorConfig:
    indicators: list[str] = field(default_factory=list)   # "rsi" | "bollinger" | "macd" | "stoch" | "cci"
    rsi_period: int = 14
    bb_window: int = 20
    bb_std: float = 2.0
    macd_fast: int = 12
    macd_slow: int = 26
    macd_signal: int = 9
    stoch_k: int = 14
    stoch_d: int = 3
    cci_period: int = 20
    sma_periods: list[int] = field(default_factory=list)   # e.g. [20, 50, 200]
    ema_periods: list[int] = field(default_factory=list)   # e.g. [9, 21]


Signal = dict  # {date: str, type: "buy"|"sell", indicator: str, price: float}


def _crossover_up(series: pd.Series) -> pd.Series:
    """Returns True on the bar where series crosses from <= 0 to > 0."""
    return (series > 0) & (series.shift(1) <= 0)


def _crossover_down(series: pd.Series) -> pd.Series:
    """Returns True on the bar where series crosses from >= 0 to < 0."""
    return (series < 0) & (series.shift(1) >= 0)


def compute_analysis(df: pd.DataFrame, cfg: IndicatorConfig) -> tuple[pd.DataFrame, list[Signal]]:
    """
    Compute requested indicators and generate buy/sell signals.

    Args:
        df: DataFrame with columns [open, high, low, close, volume].
            Index must be datetime.
        cfg: IndicatorConfig with selected indicators and their parameters.

    Returns:
        (enriched_df, signals)
        enriched_df has all original columns plus computed indicator columns.
        signals is a list of dicts: {date, type, indicator, price}.
    """
    df = df.copy()
    signals: list[Signal] = []

    # ── Bollinger Bands ──────────────────────────────────────────────────────
    if "bollinger" in cfg.indicators:
        bbands = ta.bbands(df["close"], length=cfg.bb_window, std=cfg.bb_std)
        if bbands is not None and not bbands.empty:
            col_lower = [c for c in bbands.columns if c.startswith("BBL_")][0]
            col_mid   = [c for c in bbands.columns if c.startswith("BBM_")][0]
            col_upper = [c for c in bbands.columns if c.startswith("BBU_")][0]
            df["bb_upper"] = bbands[col_upper]
            df["bb_mid"]   = bbands[col_mid]
            df["bb_lower"] = bbands[col_lower]

            # Buy: close crosses above lower band
            above_lower = df["close"] - df["bb_lower"]
            for dt, row in df[_crossover_up(above_lower)].iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "bollinger", "price": float(row["close"])})

            # Sell: close crosses above upper band
            above_upper = df["close"] - df["bb_upper"]
            for dt, row in df[_crossover_up(above_upper)].iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "bollinger", "price": float(row["close"])})

    # ── RSI ──────────────────────────────────────────────────────────────────
    if "rsi" in cfg.indicators:
        rsi = ta.rsi(df["close"], length=cfg.rsi_period)
        if rsi is not None:
            df["rsi"] = rsi

            # Buy: RSI crosses above 30
            for dt, row in df[_crossover_up(df["rsi"] - 30)].dropna(subset=["rsi"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "rsi", "price": float(row["close"])})

            # Sell: RSI crosses below 70
            for dt, row in df[_crossover_down(df["rsi"] - 70)].dropna(subset=["rsi"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "rsi", "price": float(row["close"])})

    # ── MACD ─────────────────────────────────────────────────────────────────
    if "macd" in cfg.indicators:
        macd_df = ta.macd(df["close"], fast=cfg.macd_fast, slow=cfg.macd_slow, signal=cfg.macd_signal)
        if macd_df is not None and not macd_df.empty:
            col_macd   = [c for c in macd_df.columns if c.startswith("MACD_")][0]
            col_signal = [c for c in macd_df.columns if c.startswith("MACDs_")][0]
            col_hist   = [c for c in macd_df.columns if c.startswith("MACDh_")][0]
            df["macd"]        = macd_df[col_macd]
            df["macd_signal"] = macd_df[col_signal]
            df["macd_hist"]   = macd_df[col_hist]

            # Buy: MACD crosses above signal line
            for dt, row in df[_crossover_up(df["macd"] - df["macd_signal"])].dropna(subset=["macd"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "macd", "price": float(row["close"])})

            # Sell: MACD crosses below signal line
            for dt, row in df[_crossover_down(df["macd"] - df["macd_signal"])].dropna(subset=["macd"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "macd", "price": float(row["close"])})

    # ── Stochastic Slow ──────────────────────────────────────────────────────
    if "stoch" in cfg.indicators:
        stoch_df = ta.stoch(df["high"], df["low"], df["close"], k=cfg.stoch_k, d=cfg.stoch_d)
        if stoch_df is not None and not stoch_df.empty:
            col_k = [c for c in stoch_df.columns if c.startswith("STOCHk_")][0]
            col_d = [c for c in stoch_df.columns if c.startswith("STOCHd_")][0]
            df["stoch_k"] = stoch_df[col_k]
            df["stoch_d"] = stoch_df[col_d]

            # Buy: %K crosses above 20
            for dt, row in df[_crossover_up(df["stoch_k"] - 20)].dropna(subset=["stoch_k"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "stoch", "price": float(row["close"])})

            # Sell: %K crosses below 80
            for dt, row in df[_crossover_down(df["stoch_k"] - 80)].dropna(subset=["stoch_k"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "stoch", "price": float(row["close"])})

    # ── CCI ──────────────────────────────────────────────────────────────────
    if "cci" in cfg.indicators:
        cci = ta.cci(df["high"], df["low"], df["close"], length=cfg.cci_period)
        if cci is not None:
            df["cci"] = cci

            # Buy: CCI crosses above -100
            for dt, row in df[_crossover_up(df["cci"] + 100)].dropna(subset=["cci"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "cci", "price": float(row["close"])})

            # Sell: CCI crosses below +100
            for dt, row in df[_crossover_down(df["cci"] - 100)].dropna(subset=["cci"]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "cci", "price": float(row["close"])})

    # ── SMA ──────────────────────────────────────────────────────────────────
    sorted_sma = sorted(cfg.sma_periods)
    for period in sorted_sma:
        sma = ta.sma(df["close"], length=period)
        if sma is not None:
            df[f"sma_{period}"] = sma

    # SMA crossover signal: fastest two periods
    if len(sorted_sma) >= 2:
        fast_col = f"sma_{sorted_sma[0]}"
        slow_col = f"sma_{sorted_sma[1]}"
        if fast_col in df.columns and slow_col in df.columns:
            cross = df[fast_col] - df[slow_col]
            for dt, row in df[_crossover_up(cross)].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "sma", "price": float(row["close"])})
            for dt, row in df[_crossover_down(cross)].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "sma", "price": float(row["close"])})

    # ── EMA ──────────────────────────────────────────────────────────────────
    sorted_ema = sorted(cfg.ema_periods)
    for period in sorted_ema:
        ema = ta.ema(df["close"], length=period)
        if ema is not None:
            df[f"ema_{period}"] = ema

    # EMA crossover signal: fastest two periods
    if len(sorted_ema) >= 2:
        fast_col = f"ema_{sorted_ema[0]}"
        slow_col = f"ema_{sorted_ema[1]}"
        if fast_col in df.columns and slow_col in df.columns:
            cross = df[fast_col] - df[slow_col]
            for dt, row in df[_crossover_up(cross)].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "buy", "indicator": "ema", "price": float(row["close"])})
            for dt, row in df[_crossover_down(cross)].dropna(subset=[fast_col, slow_col]).iterrows():
                signals.append({"date": str(dt.date()), "type": "sell", "indicator": "ema", "price": float(row["close"])})

    return df, signals
