"""
cambio.py — simulação do câmbio USD/BRL como faixa de possibilidades.

Modelo M1: log-retorno com volatilidade EWMA (λ=0,94) atualizada ao longo de cada
caminho, e resíduos padronizados reamostrados (filtered historical simulation).
Drift zero por padrão. Funções puras de NumPy; sem I/O.
"""

from __future__ import annotations

import numpy as np

LAMBDA = 0.94
DIAS_UTEIS_ANO = 252
JANELA_SEMENTE = 30
LIMITE_RETORNO = 0.10  # |log-retorno| acima disso é tick ruim do Yahoo


def limpar(closes: np.ndarray, datas: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Remove fechamentos ≤ 0, datas repetidas e saltos > 10% (ticks ruins)."""
    closes = np.asarray(closes, dtype=float)
    datas = np.asarray(datas)
    ok = closes > 0
    closes, datas = closes[ok], datas[ok]
    _, primeira = np.unique(datas, return_index=True)
    primeira.sort()
    closes, datas = closes[primeira], datas[primeira]
    mantidos = [0]
    for i in range(1, len(closes)):
        if abs(np.log(closes[i] / closes[mantidos[-1]])) <= LIMITE_RETORNO:
            mantidos.append(i)
    idx = np.array(mantidos, dtype=int)
    return closes[idx], datas[idx]


def retornos(closes: np.ndarray) -> np.ndarray:
    return np.diff(np.log(np.asarray(closes, dtype=float)))


def vol_ewma(r: np.ndarray, lam: float = LAMBDA) -> tuple[np.ndarray, float]:
    """
    Volatilidade EWMA. Devolve (sigma_pre, sigma_proximo):
    sigma_pre[t] é a vol estimada antes de observar r[t]; sigma_proximo é a vol de amanhã.
    Semente: variância dos primeiros JANELA_SEMENTE retornos.
    """
    r = np.asarray(r, dtype=float)
    var = float(np.var(r[:JANELA_SEMENTE])) if len(r) >= 2 else 0.0
    pre = np.empty(len(r))
    for t in range(len(r)):
        pre[t] = np.sqrt(var)
        var = lam * var + (1 - lam) * r[t] ** 2
    return pre, float(np.sqrt(var))


def simular(
    closes: np.ndarray,
    h: int,
    n: int,
    drift: float = 0.0,
    seed: int | None = None,
    vol: str = "ewma",
) -> np.ndarray:
    """
    Caminhos de preço de tamanho (n, h), em nível, a partir do último fechamento.
    `closes` deve estar limpo (ver `limpar`). `drift` é log-drift diário.
    vol="ewma" (M1, FHS) ou vol="constante" (M0: desvio histórico, resíduo normal).
    """
    closes = np.asarray(closes, dtype=float)
    r = retornos(closes)
    rng = np.random.default_rng(seed)
    s0 = float(closes[-1])

    if vol == "ewma":
        pre, sigma = vol_ewma(r)
        z = np.where(pre > 0, r / np.where(pre > 0, pre, 1.0), 0.0)
        z = (z - z.mean()) / (z.std() or 1.0)  # média 0, desvio 1
        sig = np.full(n, sigma, dtype=np.float64)
        var_atual = sig**2
    elif vol == "constante":
        sig = np.full(n, float(np.std(r)), dtype=np.float64)
        z = None
    else:
        raise ValueError("vol deve ser 'ewma' ou 'constante'")

    log_s = np.full(n, np.log(s0), dtype=np.float64)
    caminhos = np.empty((n, h), dtype=np.float32)
    for k in range(h):
        if z is not None:
            eps = z[rng.integers(0, len(z), n)]
        else:
            eps = rng.standard_normal(n)
        ret = drift + sig * eps
        log_s = log_s + ret
        caminhos[:, k] = np.exp(log_s)
        if z is not None:
            var_atual = LAMBDA * var_atual + (1 - LAMBDA) * (ret - drift) ** 2
            sig = np.sqrt(var_atual)
    return caminhos


def bandas(caminhos: np.ndarray) -> dict[str, np.ndarray]:
    """Percentis 5, 50 e 95 por dia (colunas)."""
    p5, p50, p95 = np.percentile(caminhos, [5, 50, 95], axis=0)
    return {"p5": p5, "p50": p50, "p95": p95}


def prob_acima(caminhos: np.ndarray, k: float) -> float:
    """P(S_h > K) no vencimento."""
    return float(np.mean(caminhos[:, -1] > k))


def prob_abaixo(caminhos: np.ndarray, k: float) -> float:
    """P(S_h < K) no vencimento."""
    return float(np.mean(caminhos[:, -1] < k))


def prob_tocar(caminhos: np.ndarray, s0: float, k: float) -> float:
    """
    P(tocar K antes do vencimento), medido no fechamento diário.
    K > S0: algum dia com fechamento ≥ K. K < S0: algum dia com fechamento ≤ K. K = S0: 1.
    """
    if k > s0:
        return float(np.mean(caminhos.max(axis=1) >= k))
    if k < s0:
        return float(np.mean(caminhos.min(axis=1) <= k))
    return 1.0


def forward(s0: float, i_brl_aa: float, du: int, i_usd_aa: float, dc: int) -> float:
    """
    Paridade coberta: F = S·(1+i_BRL)^(du/252) / (1 + i_USD·dc/360).
    i_BRL: taxa anual base 252 (Selic). i_USD: taxa simples ACT/360 (Fed funds).
    Taxas em decimal (0,10 = 10%).
    """
    return s0 * (1 + i_brl_aa) ** (du / DIAS_UTEIS_ANO) / (1 + i_usd_aa * dc / 360)
