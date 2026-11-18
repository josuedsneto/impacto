"""
routers/cambio.py — GET /api/cambio/previsao: faixa de possibilidades do USD/BRL.

Modelo M1 (cambio.py). Faixa e probabilidades, não previsão pontual.
"""


import math
from datetime import date, timedelta
from typing import Annotated

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Request

import cambio
import taxas
from auth import get_current_user
from focus import fetch_indicator
from limiter import limiter
from market_cache import get_prices

router = APIRouter()

TICKER = "USDBRL=X"
HORIZONTE_MAX = 262  # safra inteira de abril a março ≈ 260 dias úteis
MIN_FECHAMENTOS = 252
MSG_SEM_DADOS = "Dados insuficientes para o câmbio. Tente novamente em alguns minutos."
JANELA = 756
CAMINHOS = 10_000
MAX_NIVEIS = 10
AVISO = "Faixa de possibilidades, não previsão. Use junto com outras análises."
APROXIMACAO = (
    "Usa a Selic meta, não a taxa do DI, e o juro americano, não o cupom cambial. "
    "É uma aproximação, não o preço de mercado. Dias úteis contados sem feriados."
)


def _niveis_do_texto(texto: str | None, spot: float) -> list[float]:
    if texto is None:
        return [round(spot * 0.95, 4), round(spot * 1.05, 4)]
    try:
        valores = [float(x) for x in texto.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Os níveis precisam ser números separados por vírgula.")
    if not valores or len(valores) > MAX_NIVEIS:
        raise HTTPException(status_code=400, detail=f"Informe de 1 a {MAX_NIVEIS} níveis.")
    for k in valores:
        if not math.isfinite(k) or k < 0.5 or k > 20:
            raise HTTPException(status_code=400, detail="Cada nível precisa estar entre 0,5 e 20.")
    return valores


def serie_fx(hoje: date) -> tuple[np.ndarray, np.ndarray]:
    """Fechamentos limpos do USD/BRL e suas datas. 503 se houver menos de MIN_FECHAMENTOS."""
    linhas = [r for r in get_prices(TICKER, hoje - timedelta(days=1200), hoje) if r["close"] is not None]
    if len(linhas) < MIN_FECHAMENTOS:
        raise HTTPException(status_code=503, detail=MSG_SEM_DADOS)
    closes, datas = cambio.limpar(
        np.array([float(r["close"]) for r in linhas]), np.array([r["date"] for r in linhas])
    )
    if len(closes) < MIN_FECHAMENTOS:
        raise HTTPException(status_code=503, detail=MSG_SEM_DADOS)
    return closes, datas


def juros_em(ultimo_ts: pd.Timestamp) -> tuple[float | None, float | None]:
    """Selic meta e Fed funds (% a.a.) mais recentes até a data. None para o que estiver fora."""
    inicio = ultimo_ts.date() - timedelta(days=30)
    selic = taxas.ultimo_valor(taxas.selic_serie(inicio, ultimo_ts.date()))
    fed = taxas.ultimo_valor(taxas.fed_funds_serie(inicio, ultimo_ts.date()))
    return selic, fed


@router.get("/api/cambio/previsao")
@limiter.limit("10/minute")
def cambio_previsao(
    request: Request,
    horizonte: int = 63,
    niveis: str | None = None,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    if not 1 <= horizonte <= HORIZONTE_MAX:
        raise HTTPException(status_code=400, detail=f"O horizonte precisa estar entre 1 e {HORIZONTE_MAX} dias úteis.")
    hoje = date.today()
    closes, datas = serie_fx(hoje)

    spot = float(closes[-1])
    ultimo_dado = str(datas[-1])
    janela = closes[-JANELA:]
    niveis_k = _niveis_do_texto(niveis, spot)

    # Seed a partir da data do último dado: a faixa não muda a cada recarga no mesmo dia.
    seed = int(ultimo_dado.replace("-", ""))
    caminhos = cambio.simular(janela, HORIZONTE_MAX, CAMINHOS, seed=seed)
    caminhos_h = caminhos[:, :horizonte]

    ultimo_ts = pd.Timestamp(ultimo_dado)
    datas_futuras = pd.bdate_range(start=ultimo_ts + pd.offsets.BDay(1), periods=horizonte)
    b = cambio.bandas(caminhos_h)
    bandas = [
        {
            "data": datas_futuras[k].strftime("%Y-%m-%d"),
            "p5": round(float(b["p5"][k]), 4),
            "p50": round(float(b["p50"][k]), 4),
            "p95": round(float(b["p95"][k]), 4),
        }
        for k in range(horizonte)
    ]
    vencimento = datas_futuras[-1].strftime("%Y-%m-%d")

    _, sigma_dia = cambio.vol_ewma(cambio.retornos(janela))

    # Forward (paridade coberta): juros mais recentes da Selic e do Fed funds.
    selic, fed = juros_em(ultimo_ts)
    if selic is None or fed is None:
        forward = {"valor": None}
    else:
        dc = (datas_futuras[-1] - ultimo_ts).days
        valor = cambio.forward(spot, selic / 100, horizonte, fed / 100, dc)
        forward = {"valor": round(valor, 4)}
    forward.update({
        "selic_meta_aa": selic,
        "fed_funds_aa": fed,
        "tau_anos": round(horizonte / cambio.DIAS_UTEIS_ANO, 4),
        "aproximacao": APROXIMACAO,
    })

    # Focus: ano corrente; de outubro em diante, também o ano seguinte.
    focus = {"ano_corrente": str(hoje.year)}
    focus["cambio_ano_corrente"] = fetch_indicator("Câmbio", str(hoje.year))["value"]
    if hoje.month >= 10:
        focus["ano_seguinte"] = str(hoje.year + 1)
        focus["cambio_ano_seguinte"] = fetch_indicator("Câmbio", str(hoje.year + 1))["value"]

    niveis_out = []
    for k in niveis_k:
        acima = cambio.prob_acima(caminhos_h, k)
        niveis_out.append({
            "nivel": k,
            "p_acima_vencimento": round(acima, 4),
            "p_abaixo_vencimento": round(cambio.prob_abaixo(caminhos_h, k), 4),
            "p_tocar_antes": round(cambio.prob_tocar(caminhos_h, spot, k), 4),
        })

    historico = [
        {"date": str(d), "close": round(float(c), 4)}
        for d, c in zip(datas[-252:], closes[-252:])
    ]

    return {
        "ticker": TICKER,
        "spot": round(spot, 4),
        "ultimo_dado": ultimo_dado,
        "horizonte": horizonte,
        "vencimento": vencimento,
        "volatilidade_anual": round(sigma_dia * math.sqrt(cambio.DIAS_UTEIS_ANO), 4),
        "modelo": "Volatilidade EWMA (λ=0,94) com bootstrap de resíduos padronizados; drift zero.",
        "aviso": AVISO,
        "historico": historico,
        "bandas": bandas,
        "forward": forward,
        "focus": focus,
        "niveis": niveis_out,
    }
