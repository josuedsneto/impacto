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
import ta.momentum
import ta.trend
import ta.volatility


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
        bb = ta.volatility.BollingerBands(close=df["close"], window=cfg.bb_window, window_dev=cfg.bb_std)
        df["bb_upper"] = bb.bollinger_hband()
        df["bb_mid"]   = bb.bollinger_mavg()
        df["bb_lower"] = bb.bollinger_lband()

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
        df["rsi"] = ta.momentum.RSIIndicator(close=df["close"], window=cfg.rsi_period).rsi()

        # Buy: RSI crosses above 30
        for dt, row in df[_crossover_up(df["rsi"] - 30)].dropna(subset=["rsi"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "buy", "indicator": "rsi", "price": float(row["close"])})

        # Sell: RSI crosses below 70
        for dt, row in df[_crossover_down(df["rsi"] - 70)].dropna(subset=["rsi"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "sell", "indicator": "rsi", "price": float(row["close"])})

    # ── MACD ─────────────────────────────────────────────────────────────────
    if "macd" in cfg.indicators:
        macd = ta.trend.MACD(close=df["close"], window_fast=cfg.macd_fast, window_slow=cfg.macd_slow, window_sign=cfg.macd_signal)
        df["macd"]        = macd.macd()
        df["macd_signal"] = macd.macd_signal()
        df["macd_hist"]   = macd.macd_diff()

        # Buy: MACD crosses above signal line
        for dt, row in df[_crossover_up(df["macd"] - df["macd_signal"])].dropna(subset=["macd"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "buy", "indicator": "macd", "price": float(row["close"])})

        # Sell: MACD crosses below signal line
        for dt, row in df[_crossover_down(df["macd"] - df["macd_signal"])].dropna(subset=["macd"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "sell", "indicator": "macd", "price": float(row["close"])})

    # ── Stochastic Slow ──────────────────────────────────────────────────────
    if "stoch" in cfg.indicators:
        stoch = ta.momentum.StochasticOscillator(high=df["high"], low=df["low"], close=df["close"], window=cfg.stoch_k, smooth_window=cfg.stoch_d)
        df["stoch_k"] = stoch.stoch()
        df["stoch_d"] = stoch.stoch_signal()

        # Buy: %K crosses above 20
        for dt, row in df[_crossover_up(df["stoch_k"] - 20)].dropna(subset=["stoch_k"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "buy", "indicator": "stoch", "price": float(row["close"])})

        # Sell: %K crosses below 80
        for dt, row in df[_crossover_down(df["stoch_k"] - 80)].dropna(subset=["stoch_k"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "sell", "indicator": "stoch", "price": float(row["close"])})

    # ── CCI ──────────────────────────────────────────────────────────────────
    if "cci" in cfg.indicators:
        df["cci"] = ta.trend.CCIIndicator(high=df["high"], low=df["low"], close=df["close"], window=cfg.cci_period).cci()

        # Buy: CCI crosses above -100
        for dt, row in df[_crossover_up(df["cci"] + 100)].dropna(subset=["cci"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "buy", "indicator": "cci", "price": float(row["close"])})

        # Sell: CCI crosses below +100
        for dt, row in df[_crossover_down(df["cci"] - 100)].dropna(subset=["cci"]).iterrows():
            signals.append({"date": str(dt.date()), "type": "sell", "indicator": "cci", "price": float(row["close"])})

    # ── SMA ──────────────────────────────────────────────────────────────────
    sorted_sma = sorted(cfg.sma_periods)
    for period in sorted_sma:
        df[f"sma_{period}"] = ta.trend.SMAIndicator(close=df["close"], window=period).sma_indicator()

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
        df[f"ema_{period}"] = ta.trend.EMAIndicator(close=df["close"], window=period).ema_indicator()

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
