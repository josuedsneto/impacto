"""Risco conjunto da receita em R$/t: Monte Carlo bivariado de açúcar (SB=F) × dólar (USDBRL=X).

Spec: .specs/features/risco-conjunto/spec.md (AS-01 a AS-09).
"""
import math
from datetime import date, timedelta
from typing import Optional

import numpy as np

from market_cache import get_prices

FATOR_RS_POR_T = 22.0462 * 1.04   # ¢/lb → US$/t (×22,0462) com o mesmo prêmio de /api/metas
PREGOES_POR_ANO = 252
JANELA_PADRAO = 756               # 3 anos de pregões
JANELA_MIN, JANELA_MAX = 60, 1260
MIN_DATAS = 60
N_BINS = 40


class HistoricoInsuficiente(ValueError):
    """Menos datas em comum do que o mínimo para estimar vol e correlação."""


def _alinhar(rows_acucar: list[dict], rows_dolar: list[dict], janela: int) -> tuple[np.ndarray, np.ndarray]:
    """Fechamentos das duas séries nas datas em comum, só as `janela` datas mais recentes."""
    acucar = {str(r["date"]): float(r["close"]) for r in rows_acucar if r["close"] and float(r["close"]) > 0}
    dolar = {str(r["date"]): float(r["close"]) for r in rows_dolar if r["close"] and float(r["close"]) > 0}
    comuns = sorted(set(acucar) & set(dolar))[-janela:]
    return np.array([acucar[d] for d in comuns]), np.array([dolar[d] for d in comuns])


def estimar(closes_acucar: np.ndarray, closes_dolar: np.ndarray) -> dict:
    """Vol anual de cada série, correlação dos log-retornos diários e os preços atuais."""
    if len(closes_acucar) < MIN_DATAS:
        raise HistoricoInsuficiente("histórico insuficiente")
    retornos = np.diff(np.log(np.column_stack([closes_acucar, closes_dolar])), axis=0)
    vol = retornos.std(axis=0, ddof=1) * math.sqrt(PREGOES_POR_ANO)
    # Série sem variação (σ = 0) não tem correlação definida: usa 0 (AS-04).
    corr = float(np.corrcoef(retornos[:, 0], retornos[:, 1])[0, 1]) if vol.min() > 0 else 0.0
    return {
        "vol_acucar": float(vol[0]),
        "vol_dolar": float(vol[1]),
        "correlacao": corr,
        "s0": float(closes_acucar[-1]),
        "x0": float(closes_dolar[-1]),
    }


def _choques(vol_acucar: float, vol_dolar: float, rho: float,
             horizonte: int, n: int, seed: int) -> tuple[np.ndarray, np.ndarray]:
    """Log-retorno terminal de cada fator (AS-01/AS-02).

    Soma de `horizonte` passos i.i.d.: normal com variância horizonte·σ_d².
    Cholesky 2×2: X_s = σ_s√T·Z1 ; X_f = σ_f√T·(ρ·Z1 + √(1−ρ²)·Z2).
    """
    rng = np.random.default_rng(seed)
    z1 = rng.standard_normal(n, dtype=np.float32)
    z2 = rng.standard_normal(n, dtype=np.float32)
    rho = min(1.0, max(-1.0, rho))
    dp = math.sqrt(horizonte)
    sd_s = vol_acucar / math.sqrt(PREGOES_POR_ANO) * dp   # σ_d·√T
    sd_f = vol_dolar / math.sqrt(PREGOES_POR_ANO) * dp
    x_s = np.float32(sd_s) * z1
    x_f = np.float32(sd_f) * (np.float32(rho) * z1 + np.float32(math.sqrt(1 - rho * rho)) * z2)
    return x_s, x_f


def _receitas(est: dict, vol_acucar: float, vol_dolar: float, rho: float,
              horizonte: int, n: int, seed: int) -> np.ndarray:
    """Receita simulada em R$/t no horizonte: FATOR · S0 · X0 · exp(X_s + X_f)."""
    x_s, x_f = _choques(vol_acucar, vol_dolar, rho, horizonte, n, seed)
    return (FATOR_RS_POR_T * est["s0"] * est["x0"] * np.exp(x_s + x_f)).astype(np.float32)


def _misturar(receita: np.ndarray, percentual_fixado: float, preco_fixado: Optional[float]) -> np.ndarray:
    """Receita = f·PF + (1−f)·R_simulada (AS-07)."""
    # float64 aqui: em float32, PF = meta pode virar menor que a meta e dar P = 1 em vez de 0.
    receita = receita.astype(np.float64)
    if percentual_fixado <= 0:
        return receita
    f = percentual_fixado / 100
    return f * preco_fixado + (1 - f) * receita


def calcular(
    est: dict,
    meta: float,
    horizonte: int = 63,
    n: int = 20_000,
    percentual_fixado: float = 0.0,
    preco_fixado: Optional[float] = None,
    seed: Optional[int] = None,
) -> dict:
    """Probabilidade e percentis da receita, mais a contribuição de cada fator (AS-09)."""
    if seed is None:
        seed = int(np.random.default_rng().integers(2**31))
    va, vd, rho = est["vol_acucar"], est["vol_dolar"], est["correlacao"]

    def cenario(vol_a: float, vol_d: float, r: float) -> np.ndarray:
        bruta = _receitas(est, vol_a, vol_d, r, horizonte, n, seed)
        return _misturar(bruta, percentual_fixado, preco_fixado)

    total = cenario(va, vd, rho)
    p5, p50, p95 = np.percentile(total, [5, 50, 95]).tolist()
    lo, hi = np.percentile(total, [0.5, 99.5])
    contagens, limites = np.histogram(total[(total >= lo) & (total <= hi)], bins=N_BINS, range=(lo, hi))

    return {
        "meta": meta,
        "prob_abaixo_meta": float(np.mean(total < meta)),
        "p5": p5,
        "p50": p50,
        "p95": p95,
        "histograma": {"limites": limites.tolist(), "contagens": contagens.tolist()},
        "correlacao": rho,
        "vol_acucar": va,
        "vol_dolar": vd,
        "contribuicao": {
            "prob_sem_correlacao": float(np.mean(cenario(va, vd, 0.0) < meta)),
            "prob_so_acucar": float(np.mean(cenario(va, 0.0, rho) < meta)),
            "prob_so_dolar": float(np.mean(cenario(0.0, vd, rho) < meta)),
        },
        "seed": seed,
    }


def buscar_e_calcular(meta: float, horizonte: int, janela: int, n: int,
                      percentual_fixado: float, preco_fixado: Optional[float],
                      seed: Optional[int]) -> dict:
    """Lê as duas séries pelo cache (`get_prices`) e roda o cálculo. Levanta LookupError se faltar preço atual e HistoricoInsuficiente se o histórico for curto."""
    hoje = date.today()
    inicio = hoje - timedelta(days=int(janela * 7 / 5) + 30)
    rows_a = get_prices("SB=F", inicio, hoje)
    rows_d = get_prices("USDBRL=X", inicio, hoje)
    if not rows_a or not rows_d:
        raise LookupError("sem preço atual")
    closes_a, closes_d = _alinhar(rows_a, rows_d, janela)
    est = estimar(closes_a, closes_d)
    resultado = calcular(est, meta, horizonte, n, percentual_fixado, preco_fixado, seed)
    resultado["ultimo_dado"] = min(str(rows_a[-1]["date"]), str(rows_d[-1]["date"]))
    resultado["spot"] = {"acucar_cents_lb": est["s0"], "dolar": est["x0"]}
    resultado["n_datas"] = len(closes_a)
    return resultado
