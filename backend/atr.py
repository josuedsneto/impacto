"""
atr.py — ATR (Açúcar Total Recuperável) calibration and prediction module.

Calibração por OLS com medições reais (atr-calibracao). Sem medições suficientes
ou com dados colineares, usa os coeficientes do setor e devolve um aviso.
"""

from __future__ import annotations

import logging
import math

import numpy as np
import statsmodels.api as sm
from scipy import stats

logger = logging.getLogger(__name__)

MIN_MESES = 12  # 9 graus de liberdade com 3 parâmetros
LIMITE_CORRELACAO = 0.95  # |corr(chuva, impureza)| acima disso é colinearidade (VIF ≥ 10)
AVISO_SETOR = "Usando coeficientes padrão; lance dados reais de ATR."
AVISO_COLINEAR = "Chuva e impureza estão correlacionadas demais para calibrar. " + AVISO_SETOR


def get_sector_defaults() -> dict:
    """
    Coeficientes empíricos do setor (Consecana/Unica) para estimativa de ATR.

    Usados quando a usina não tem medições suficientes para calibrar.

    Returns:
        dict com intercept, coef_chuva, coef_impureza, sigma
    """
    return {
        "intercept": 135.0,       # ATR base kg/tc
        "coef_chuva": 0.15,       # ATR increase per mm of rainfall
        "coef_impureza": -1.8,    # ATR decrease per percentage point of impurity
        "sigma": 5.0,             # desvio do erro usado no intervalo sem calibração
    }


def _valido(h: dict) -> bool:
    """Linha entra na calibração só com as três variáveis finitas."""
    valores = (h.get("chuva_mm"), h.get("impureza_pct"), h.get("atr_real"))
    return all(v is not None and math.isfinite(float(v)) for v in valores)


def _setor(meses: int, aviso: str | None) -> dict:
    params = get_sector_defaults()
    params.update({"calibracao": "setor", "meses_usados": meses, "aviso": aviso})
    return params


def calibrate_atr(history: list[dict]) -> dict:
    """
    Calibra o modelo ATR por OLS com ATR medido.

    Linhas com valores ausentes ou não finitos são descartadas. Com menos de
    MIN_MESES linhas válidas, ou com chuva e impureza colineares, devolve os
    coeficientes do setor com `calibracao="setor"` e `aviso`.

    Args:
        history: lista de dicts com chuva_mm, impureza_pct, atr_real

    Returns:
        dict com intercept, coef_chuva, coef_impureza, sigma (= sqrt(SSR/(n-3))),
        cov (matriz 3x3 de covariância dos coeficientes, numpy), gl (n-3),
        meses_usados, calibracao ("usina" ou "setor") e aviso. Sem arredondamento.
    """
    rows = [h for h in history if _valido(h)]
    n = len(rows)
    if n < MIN_MESES:
        logger.info("calibrate_atr: %d meses válidos (mínimo %d); usando setor", n, MIN_MESES)
        return _setor(n, AVISO_SETOR)

    chuva = np.array([float(h["chuva_mm"]) for h in rows])
    impureza = np.array([float(h["impureza_pct"]) for h in rows])
    atr_real = np.array([float(h["atr_real"]) for h in rows])

    if chuva.std() < 1e-9 or impureza.std() < 1e-9:
        logger.warning("calibrate_atr: variável constante; usando setor")
        return _setor(n, AVISO_COLINEAR)
    if abs(np.corrcoef(chuva, impureza)[0, 1]) >= LIMITE_CORRELACAO:
        logger.warning("calibrate_atr: chuva e impureza colineares; usando setor")
        return _setor(n, AVISO_COLINEAR)

    X = sm.add_constant(np.column_stack([chuva, impureza]), has_constant="add")
    fitted = sm.OLS(endog=atr_real, exog=X).fit()

    gl = n - 3
    params = fitted.params
    return {
        "intercept": float(params[0]),
        "coef_chuva": float(params[1]),
        "coef_impureza": float(params[2]),
        "sigma": math.sqrt(float(fitted.ssr) / gl),
        "cov": np.asarray(fitted.cov_params()),  # s²·(XᵀX)⁻¹, s² = SSR/(n-3)
        "gl": gl,
        "meses_usados": n,
        "calibracao": "usina",
        "aviso": None,
    }


def predict_atr(
    chuva_mm: float,
    impureza_pct: float,
    params: dict,
    volume_moagem: float | None = None,
) -> dict:
    """
    Prevê o ATR com intervalo de previsão de 90%.

    Com parâmetros calibrados (com `cov`), o intervalo é o de uma nova observação:
    ŷ ± t(0,95; gl) · sqrt(x₀ᵀ·cov·x₀ + s²), igual ao obs_ci do statsmodels.
    Sem `cov` (coeficientes do setor), usa ŷ ± 1,645 · sigma.

    Args:
        chuva_mm: chuva em mm
        impureza_pct: impureza total em % (0-100)
        params: dict de calibração (intercept, coef_chuva, coef_impureza, sigma e,
            se calibrado, cov e gl)
        volume_moagem: moagem opcional em toneladas de cana (tc)

    Returns:
        dict com atr_min, atr_esperado, atr_max, producao_total (ou None)
    """
    atr_esperado = (
        params["intercept"]
        + params["coef_chuva"] * chuva_mm
        + params["coef_impureza"] * impureza_pct
    )

    if params.get("cov") is not None:
        x0 = np.array([1.0, chuva_mm, impureza_pct])
        var_previsao = float(x0 @ params["cov"] @ x0) + params["sigma"] ** 2
        margin = float(stats.t.ppf(0.95, params["gl"])) * math.sqrt(var_previsao)
    else:
        margin = 1.645 * params["sigma"]   # z = 1.645 para 90%

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
