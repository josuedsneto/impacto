"""
atr.py — ATR (Açúcar Total Recuperável) calibration and prediction module.

Provides sector-default coefficients, OLS calibration from historical data,
and prediction with 90% confidence interval.
"""

from __future__ import annotations

import logging

import numpy as np
import statsmodels.api as sm

logger = logging.getLogger(__name__)


def get_sector_defaults() -> dict:
    """
    Return Consecana/Unica sector empirical coefficients for ATR estimation.

    Used as fallback when a usina has fewer than 5 historical data points.

    Returns:
        dict with intercept, coef_chuva, coef_impureza, sigma
    """
    return {
        "intercept": 135.0,       # ATR base kg/tc
        "coef_chuva": 0.15,       # ATR increase per mm of rainfall
        "coef_impureza": -1.8,    # ATR decrease per percentage point of impurity
        "sigma": 5.0,             # residual std deviation for CI computation
    }


def calibrate_atr(history: list[dict]) -> dict:
    """
    Calibrate ATR model from historical observations using OLS.

    If fewer than 5 data points, returns sector defaults.
    Falls back to sector defaults if OLS fails (e.g. collinear data).

    Args:
        history: list of dicts with keys chuva_mm, impureza_pct, atr_real

    Returns:
        dict with intercept, coef_chuva, coef_impureza, sigma
    """
    if len(history) < 5:
        logger.info("calibrate_atr: fewer than 5 points (%d), using sector defaults", len(history))
        return get_sector_defaults()

    try:
        chuva = np.array([h["chuva_mm"] for h in history], dtype=float)
        impureza = np.array([h["impureza_pct"] for h in history], dtype=float)
        atr_real = np.array([h["atr_real"] for h in history], dtype=float)

        X = np.column_stack([chuva, impureza])
        X_with_const = sm.add_constant(X, has_constant="add")

        fitted = sm.OLS(endog=atr_real, exog=X_with_const).fit()

        residuals = atr_real - fitted.fittedvalues
        sigma = float(np.std(residuals))

        params = fitted.params
        return {
            "intercept": round(float(params[0]), 3),
            "coef_chuva": round(float(params[1]), 3),
            "coef_impureza": round(float(params[2]), 3),
            "sigma": round(sigma, 3),
        }
    except Exception as exc:
        logger.warning("calibrate_atr OLS failed (%s); falling back to sector defaults", exc)
        return get_sector_defaults()


def predict_atr(
    chuva_mm: float,
    impureza_pct: float,
    params: dict,
    volume_moagem: float | None = None,
) -> dict:
    """
    Predict ATR with 90% confidence interval.

    Args:
        chuva_mm: rainfall in mm
        impureza_pct: impurity percentage (0-100)
        params: calibration dict (intercept, coef_chuva, coef_impureza, sigma)
        volume_moagem: optional crushing volume in tonnes of cane (tc)

    Returns:
        dict with atr_min, atr_esperado, atr_max, producao_total (or None)
    """
    atr_esperado = (
        params["intercept"]
        + params["coef_chuva"] * chuva_mm
        + params["coef_impureza"] * impureza_pct
    )

    margin = 1.645 * params["sigma"]   # z = 1.645 for 90% CI
    atr_min = max(0.0, atr_esperado - margin)
    atr_max = atr_esperado + margin

    producao_total: float | None = None
    if volume_moagem is not None:
        # Toneladas de açúcar = kg ATR/tc × tc / 1000
        producao_total = round(atr_esperado * volume_moagem / 1000, 3)

    return {
        "atr_min": round(atr_min, 3),
        "atr_esperado": round(atr_esperado, 3),
        "atr_max": round(atr_max, 3),
        "producao_total": producao_total,
    }
