"""
backtest_cambio.py — walk-forward do modelo de câmbio. Roda manualmente, offline.

Uso (dentro de backend/):
    python backtest_cambio.py --saida ../.specs/features/cambio-previsao/backtest.md

Modelos: M0 (vol constante, normal), M1 (EWMA + FHS, drift zero), M1f (M1 com drift de carry).
Origens a cada 21 dias úteis, janela de 756 preços, 10.000 caminhos, sem dado futuro.
A limpeza de série (limpar) é causal: só remove pontos em relação ao anterior.
Regra de decisão escrita antes de rodar: ver .specs/features/cambio-previsao/spec.md.
"""

from __future__ import annotations

import argparse
import math
from datetime import date

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.stats import chi2, norm

import cambio
import taxas

HORIZONTES = [5, 21, 63, 126]
JANELA = 756
CAMINHOS = 10_000
PASSO = 21
INICIO_TESTE = pd.Timestamp("2010-01-01")
NIVEIS_COBERTURA = [0.80, 0.90, 0.95]
TAUS = [0.05, 0.50, 0.95]
MODELOS = ["M0", "M1", "M1f"]


def carregar_dados() -> tuple[np.ndarray, pd.DatetimeIndex]:
    df = yf.download("USDBRL=X", start="2007-01-01", progress=False, auto_adjust=False)
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    close = close.dropna()
    closes, datas = cambio.limpar(close.values, close.index.values)
    return closes, pd.DatetimeIndex(datas)


def crps(amostras: np.ndarray, y: float) -> float:
    """CRPS por amostras ordenadas: E|X−y| − ½·E|X−X'|, O(n log n)."""
    x = np.sort(amostras)
    n = len(x)
    i = np.arange(1, n + 1)
    gmd = 2.0 * np.sum((2 * i - n - 1) * x) / n**2
    return float(np.mean(np.abs(x - y)) - 0.5 * gmd)


def pinball(q: float, pred: float, y: float) -> float:
    return max(q * (y - pred), (q - 1) * (y - pred))


def kupiec(misses: int, n: int, p: float) -> float:
    """Teste de cobertura incondicional de Kupiec. Devolve o p-valor (χ², 1 gl)."""
    pi = misses / n
    ll0 = (n - misses) * math.log(1 - p) + misses * math.log(p)
    ll1 = 0.0
    if 0 < misses < n:
        ll1 = (n - misses) * math.log(1 - pi) + misses * math.log(pi)
    lr = -2.0 * (ll0 - ll1)
    return float(chi2.sf(lr, 1))


def crps_pareado(res: dict, a: str, b: str, h: int) -> np.ndarray:
    """Diferença de CRPS (a − b) nas origens em que os dois modelos têm previsão."""
    ra, rb = res[a][h], res[b][h]
    mapa_b = dict(zip(rb["orig"], rb["crps"]))
    return np.array([ca - mapa_b[t] for t, ca in zip(ra["orig"], ra["crps"]) if t in mapa_b])


def diebold_mariano(d: np.ndarray, h: int) -> float:
    """p-valor bicaudal do teste DM com variância HAC (Newey-West), lag ⌈h/21⌉−1."""
    t = len(d)
    lag = math.ceil(h / PASSO) - 1
    dc = d - d.mean()
    var = float(np.dot(dc, dc) / t)
    for k in range(1, lag + 1):
        gamma = float(np.dot(dc[k:], dc[:-k]) / t)
        var += 2 * (1 - k / (lag + 1)) * gamma
    if var <= 0:
        return 1.0
    stat = d.mean() / math.sqrt(var / t)
    return float(2 * (1 - norm.cdf(abs(stat))))


def rodar(closes: np.ndarray, datas: pd.DatetimeIndex) -> dict:
    selic = taxas.selic_serie(datas[0].date(), datas[-1].date()).reindex(datas, method="ffill")
    fed = taxas.fed_funds_serie(datas[0].date(), datas[-1].date()).reindex(datas, method="ffill")

    origens = [
        t for t in range(JANELA - 1, len(closes) - max(HORIZONTES), PASSO) if datas[t] >= INICIO_TESTE
    ]
    res = {m: {h: {"crps": [], "pin": {q: [] for q in TAUS}, "cob": {c: [] for c in NIVEIS_COBERTURA},
                   "brier": [], "p50": [], "real": [], "s0": [], "orig": []} for h in HORIZONTES} for m in MODELOS}
    pulados_m1f = 0

    for t in origens:
        win = closes[t - JANELA + 1 : t + 1]
        s0 = float(closes[t])
        caminhos = {
            "M0": cambio.simular(win, max(HORIZONTES), CAMINHOS, seed=t, vol="constante"),
            "M1": cambio.simular(win, max(HORIZONTES), CAMINHOS, seed=t, vol="ewma"),
        }
        i_brl, i_usd = selic.iloc[t], fed.iloc[t]
        if np.isfinite(i_brl) and np.isfinite(i_usd):
            drift = (math.log(1 + i_brl / 100) - math.log(1 + i_usd / 100)) / cambio.DIAS_UTEIS_ANO
            caminhos["M1f"] = cambio.simular(win, max(HORIZONTES), CAMINHOS, drift=drift, seed=t, vol="ewma")
        else:
            pulados_m1f += 1

        for m, paths in caminhos.items():
            for h in HORIZONTES:
                y = float(closes[t + h])
                amostra = paths[:, h - 1].astype(np.float64)
                x_log = np.log(amostra / s0)
                y_log = math.log(y / s0)
                r = res[m][h]
                r["crps"].append(crps(x_log, y_log))
                for q in TAUS:
                    r["pin"][q].append(pinball(q, float(np.quantile(x_log, q)), y_log))
                for c in NIVEIS_COBERTURA:
                    lo, hi = np.quantile(x_log, [(1 - c) / 2, 1 - (1 - c) / 2])
                    r["cob"][c].append(lo <= y_log <= hi)
                for k in (s0 * 1.05, s0 * 0.95):
                    p = float(np.mean(amostra > k))
                    r["brier"].append((p - float(y > k)) ** 2)
                r["p50"].append(float(np.median(amostra)))
                r["real"].append(y)
                r["s0"].append(s0)
                r["orig"].append(t)

    return {"res": res, "origens": len(origens), "pulados_m1f": pulados_m1f,
            "inicio": datas[origens[0]].date(), "fim": datas[origens[-1] + max(HORIZONTES)].date(),
            "selic_ok": bool(selic.notna().any()), "fed_ok": bool(fed.notna().any())}


def resumir(out: dict) -> tuple[str, dict]:
    res = out["res"]
    linhas = []
    decisao = {}

    for h in HORIZONTES:
        n_efetivo = out["origens"] if h <= PASSO else round(out["origens"] * PASSO / h)
        linhas.append(f"\n### Horizonte {h} dias úteis\n")
        linhas.append("| Modelo | CRPS (%) | Skill vs M0 | Cobertura 80% (p) | 90% (p) | 95% (p) | Pinball p5/p50/p95 (%) | Brier | Skill Brier vs M0 |")
        linhas.append("|---|---|---|---|---|---|---|---|---|")
        crps_m0 = np.array(res["M0"][h]["crps"])
        brier_m0 = np.mean(res["M0"][h]["brier"])
        for m in MODELOS:
            r = res[m][h]
            if not r["crps"]:
                linhas.append(f"| {m} | sem dados (FRED/BCB indisponível) | | | | | | | |")
                continue
            c = np.array(r["crps"])
            skill = 1 - c.mean() / crps_m0.mean()
            cob_txt = []
            for lv in NIVEIS_COBERTURA:
                acertos = np.array(r["cob"][lv])
                hit = acertos.mean()
                p = kupiec(int((~acertos).sum()), len(acertos), 1 - lv)
                cob_txt.append(f"{hit*100:.1f}% (p={p:.2f})")
            pin = "/".join(f"{np.mean(r['pin'][q])*100:.3f}" for q in TAUS)
            brier = np.mean(r["brier"])
            skill_b = 1 - brier / brier_m0
            skill_b_txt = f"{skill_b:+.3f}" if h >= 21 else "não avaliado (h<21)"
            linhas.append(f"| {m} | {c.mean()*100:.3f} | {skill:+.3f} | {' | '.join(cob_txt)} | {pin} | {brier:.4f} | {skill_b_txt} |")
        if h > PASSO:
            linhas.append(f"\n_Cobertura em h={h} é informativa: N efetivo ≈ {n_efetivo} (overlap de janelas). Fora do gate._")

    # --- Decisão (regra escrita na spec) ---
    def passa_kupiec(m: str) -> bool:
        for h in (5, 21):
            if not res[m][h]["crps"]:
                return False
            for lv in NIVEIS_COBERTURA:
                acertos = np.array(res[m][h]["cob"][lv])
                if kupiec(int((~acertos).sum()), len(acertos), 1 - lv) < 0.05:
                    return False
        return True

    def skill_vs_m0(m: str, h: int) -> float:
        return 1 - np.mean(res[m][h]["crps"]) / np.mean(res["M0"][h]["crps"])

    m1_entra = all(skill_vs_m0("M1", h) >= 0 for h in (5, 21)) and passa_kupiec("M1")
    m1f_ok = bool(res["M1f"][5]["crps"]) and passa_kupiec("M1f")
    dm_p = {h: diebold_mariano(crps_pareado(res, "M1f", "M1", h), h)
            for h in HORIZONTES if res["M1f"][h]["crps"]}
    m1f_vence = m1f_ok and all(
        np.mean(res["M1f"][h]["crps"]) < np.mean(res["M1"][h]["crps"]) and dm_p.get(h, 1) < 0.05
        for h in (5, 21)
    )

    if m1f_vence:
        escolha = "M1f (drift de carry): CRPS menor que M1 com p<0,05 (DM) e cobertura aprovada."
    elif m1_entra:
        escolha = "M1 (EWMA + FHS, drift zero): CRPS do M1 ≤ CRPS do M0 (skill ≥ 0) em h=5 e 21 e cobertura aprovada."
    else:
        escolha = "M0 com aviso: nenhum modelo passou o gate de cobertura/CRPS em h=5 e 21."

    decisao_txt = [
        "## Decisão de produção",
        "",
        f"**Escolha pela regra:** {escolha}",
        "",
        "Regra aplicada (da spec): (1) M1 entra se skill vs M0 ≥ 0 em h=5 e 21 e Kupiec não rejeita a 5%; "
        "(2) M1f substitui M1 só com CRPS menor e Diebold-Mariano (HAC Newey-West) p<0,05; "
        "(3) senão, M0 com aviso.",
        "",
        "Diebold-Mariano (M1f − M1, CRPS): " + ", ".join(
            f"h={h}: p={p:.3f} (média da diferença {np.mean(np.array(res['M1f'][h]['crps']) - np.array(res['M1'][h]['crps']))*100:+.4f}%)"
            for h, p in dm_p.items()
        ),
        "",
        "**Limitação:** o M1 fica estreito no horizonte longo: em h=126 cobre 83% (nominal 90%) e 90% (nominal 95%). "
        "A API serve até 262 dias úteis, e só foi testado até 126. Bandas de seis meses ou mais devem ser lidas como indicativas. "
        "Os p-valores de h=63 e 126 usam N=origens, não o N efetivo, e superestimam a significância.",
    ]
    return "\n".join(linhas) + "\n\n" + "\n".join(decisao_txt) + "\n", {"escolha": escolha}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", required=True)
    args = parser.parse_args()

    closes, datas = carregar_dados()
    out = rodar(closes, datas)
    corpo, _ = resumir(out)

    cabecalho = (
        "# Backtest do câmbio (USD/BRL)\n\n"
        f"- Dados: `USDBRL=X` (yfinance), limpos: {len(closes)} fechamentos, de {datas[0].date()} a {datas[-1].date()}.\n"
        f"- Origens: {out['origens']} (a cada {PASSO} dias úteis, de {out['inicio']} a {out['fim']}), janela de {JANELA} preços, {CAMINHOS} caminhos.\n"
        f"- Selic (SGS 432) disponível: {out['selic_ok']}. Fed funds (FRED DFF) disponível: {out['fed_ok']}. "
        f"Origens sem M1f: {out['pulados_m1f']}.\n"
        "- CRPS em log-retorno (×100 = %). Skill = 1 − CRPS_modelo / CRPS_M0 (positivo é melhor que M0).\n"
        "- Kupiec: p-valor; rejeição a 5% se p<0,05. Gate em h ∈ {5, 21}.\n"
        "- Limitação: origens em h=63 e 126 se sobrepõem; testes de cobertura desses horizontes são informativos.\n\n"
    )
    with open(args.saida, "w", encoding="utf-8") as f:
        f.write(cabecalho + corpo)
    print(f"Backtest gravado em {args.saida}")


if __name__ == "__main__":
    main()
