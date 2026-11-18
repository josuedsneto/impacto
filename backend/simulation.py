"""
simulation.py — Monte Carlo price simulation engine.

Design decisions:
- Returns are drawn from a normal distribution parameterized by historical daily mean and std.
- Paths are NOT clipped. pct_bound is a reference band: pct_passou_limite reports the share of
  paths that left ±pct_bound around preco_inicial on at least one day of the horizon.
  (A cut path does not follow the model, so its percentiles would be wrong.)
- Simulated in blocks of days with n paths each; the log-price carries between blocks.
  Percentiles are per day across paths, so the result is exact, and peak memory is bounded by
  LIMITE_CELULAS (days_per_block × paths), not by dias_simulados × num_simulacoes.
- percentiles_series JSONB: dict keyed "p5"/"p20"/"p25"/"p50"/"p75"/"p80"/"p95",
  each value is a list of floats (one per simulated day, length = dias_simulados)
"""

import numpy as np
from market_cache import get_prices
from datetime import date, timedelta

# Máximo de células (dias do bloco × cenários) por bloco: ~40 MB em float64.
LIMITE_CELULAS = 5_000_000
PCT_LABELS = [5, 20, 25, 50, 75, 80, 95]
MIN_RETORNOS = 20


class DadosInsuficientesError(ValueError):
    """Histórico com menos de MIN_RETORNOS retornos válidos."""


def run_simulation(
    ticker: str,
    preco_inicial: float,
    dias_simulados: int = 252,
    num_simulacoes: int = 10_000,
    pct_bound: float = 0.50,
    volatilidade_custom: float | None = None,
    seed: int | None = None,
) -> dict:
    """
    Run Monte Carlo simulation and return scalar metrics + percentile series.

    Paths are not truncated: p5..p95 are the percentiles of the simulated distribution.
    pct_passou_limite is the fraction of paths that, on at least one day, were outside
    [preco_inicial × (1 − pct_bound), preco_inicial × (1 + pct_bound)]. With pct_bound ≥ 1 only
    the upper band applies.

    Raises DadosInsuficientesError if fewer than 20 valid returns are available.

    Returns dict with keys:
      p5, p20, p25, p50, p75, p80, p95  — final-day scalar percentiles (float)
      percentiles_series                 — JSONB-serializable dict of daily series
      pct_passou_limite                  — float in [0, 1]
      ticker, preco_inicial, dias_simulados, num_simulacoes, pct_bound
    """
    # --- Fetch historical returns for parameter estimation ---
    end_date = date.today()
    start_date = end_date - timedelta(days=3 * 365)  # ~3 years of history
    rows = get_prices(ticker, start_date, end_date)

    # Invalid closes (None, NaN, inf, ≤ 0) become NaN; the diff then drops every return
    # touching them, so a gap does not join two days into one return.
    closes = np.array(
        [np.nan if r.get("close") is None else r["close"] for r in rows], dtype=float
    )
    closes = np.where(np.isfinite(closes) & (closes > 0), closes, np.nan)
    retornos = np.diff(np.log(closes))
    retornos = retornos[np.isfinite(retornos)]

    if retornos.size < MIN_RETORNOS:
        raise DadosInsuficientesError(
            f"Não há dados históricos suficientes para {ticker} "
            f"(retornos válidos: {retornos.size}, mínimo: {MIN_RETORNOS})."
        )

    mu = float(np.mean(retornos))
    sigma = float(np.std(retornos, ddof=1))

    # Override sigma with user-specified volatility if provided (PARAM-01).
    # The param is annualized (UI: "ex: 0.25"); the simulation steps are daily.
    if volatilidade_custom is not None:
        sigma = float(volatilidade_custom) / np.sqrt(252)

    # --- Reference band in log space (comparison is against preco_inicial) ---
    log_lo = -np.inf if pct_bound >= 1 else np.log1p(-pct_bound)
    log_hi = np.log1p(pct_bound)

    # --- Blocked simulation over days; n paths fixed ---
    rng = np.random.default_rng(seed)
    n = num_simulacoes
    dias_por_bloco = max(1, LIMITE_CELULAS // n)
    carry = np.zeros(n)              # cumulative log-return at the end of the previous block
    fora = np.zeros(n, dtype=bool)   # path has left the band on some day so far
    partes: dict[int, list[np.ndarray]] = {p: [] for p in PCT_LABELS}

    for inicio in range(0, dias_simulados, dias_por_bloco):
        b = min(dias_por_bloco, dias_simulados - inicio)
        bloco = rng.normal(loc=mu, scale=sigma, size=(b, n))
        bloco[0] += carry
        np.cumsum(bloco, axis=0, out=bloco)
        carry = bloco[-1].copy()
        fora |= ((bloco < log_lo) | (bloco > log_hi)).any(axis=0)
        np.exp(bloco, out=bloco)
        bloco *= preco_inicial

        pcts = np.percentile(bloco, PCT_LABELS, axis=1)
        for p, row in zip(PCT_LABELS, pcts):
            partes[p].append(row)

    series = {f"p{p}": np.concatenate(partes[p]).tolist() for p in PCT_LABELS}

    return {
        "ticker": ticker,
        "preco_inicial": preco_inicial,
        "dias_simulados": dias_simulados,
        "num_simulacoes": num_simulacoes,
        "pct_bound": pct_bound,
        "pct_passou_limite": float(fora.mean()),
        "p5": series["p5"][-1],
        "p20": series["p20"][-1],
        "p25": series["p25"][-1],
        "p50": series["p50"][-1],
        "p75": series["p75"][-1],
        "p80": series["p80"][-1],
        "p95": series["p95"][-1],
        "percentiles_series": series,
    }
