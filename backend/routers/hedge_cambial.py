"""POST /api/hedge-cambial: compara ficar aberto, travar no forward, put e collar sobre os mesmos caminhos.

Modelo em hedge_cambial.py; dados de câmbio e juros vêm de routers/cambio.py (mesma fonte da previsão).
Spec: .specs/features/hedge-cambial.
"""

import math
from datetime import date
from typing import Annotated, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

import cambio
import hedge_cambial as hc
from auth import get_current_user
from limiter import limiter
from routers.cambio import HORIZONTE_MAX, JANELA, CAMINHOS, juros_em, serie_fx

router = APIRouter()

VOLUME_MAX = 1e9
AVISO = "Comparação de cenários, não recomendação."
PREMISSAS = (
    "A simulação não tem carrego (drift zero). O forward e o prêmio são de mercado, "
    "com o diferencial de juros embutido: por isso travar tende a custar em média. "
    "O prêmio usa Garman-Kohlhagen com a mesma volatilidade EWMA da simulação; "
    "as caudas do câmbio são mais pesadas que a lognormal, então puts fora do dinheiro podem sair baratas."
)
MSG_JUROS = "Sem dados de juros para calcular o hedge. Tente novamente em alguns minutos."


class HedgeIn(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    volume_usd: float = Field(gt=0, le=VOLUME_MAX)
    horizonte_du: int = Field(ge=1, le=HORIZONTE_MAX)
    orcamento: Optional[float] = Field(default=None, ge=0.5, le=20)  # None = forward
    pct_forward: float = Field(default=50, ge=0, le=100)
    strike_put: Optional[float] = Field(default=None, ge=0.5, le=20)  # None = spot × 0,95
    collar_k1: Optional[float] = Field(default=None, ge=0.5, le=20)  # None = spot × 0,95
    collar_k2: Optional[float] = Field(default=None, ge=0.5, le=20)  # None = spot × 1,05


def _r2(v: float) -> float:
    return round(v, 2)


@router.post("/api/hedge-cambial")
@limiter.limit("10/minute")
def hedge_cambial(
    request: Request,
    body: HedgeIn,
    user: Annotated[dict, Depends(get_current_user)],
):
    closes, datas = serie_fx(date.today())
    spot = float(closes[-1])
    ultimo_dado = datas[-1]
    ultimo_ts = pd.Timestamp(str(ultimo_dado))
    janela = closes[-JANELA:]

    selic, fed = juros_em(ultimo_ts)
    if selic is None or fed is None:
        raise HTTPException(status_code=503, detail=MSG_JUROS)

    du = body.horizonte_du
    datas_futuras = pd.bdate_range(start=ultimo_ts + pd.offsets.BDay(1), periods=du)
    dc = (datas_futuras[-1] - ultimo_ts).days
    F = cambio.forward(spot, selic / 100, du, fed / 100, dc)

    # Mesma estimativa para o prêmio e para os caminhos: sigma_proximo da EWMA sobre a mesma janela.
    _, sigma_dia = cambio.vol_ewma(cambio.retornos(janela))
    sigma = sigma_dia * math.sqrt(cambio.DIAS_UTEIS_ANO)

    seed = int(str(ultimo_dado).replace("-", ""))
    caminhos = cambio.simular(janela, du, CAMINHOS, seed=seed)
    ST = caminhos[:, -1].astype(float)

    k_put = body.strike_put if body.strike_put is not None else round(spot * 0.95, 4)
    k1 = body.collar_k1 if body.collar_k1 is not None else round(spot * 0.95, 4)
    k2 = body.collar_k2 if body.collar_k2 is not None else round(spot * 1.05, 4)
    if k1 > k2:
        raise HTTPException(status_code=400, detail="No collar, o strike da put (K1) não pode ser maior que o da call (K2).")
    orcamento = body.orcamento if body.orcamento is not None else round(F, 4)

    resultado = hc.simular_estrategias(
        ST,
        body.volume_usd,
        spot,
        F,
        selic / 100,
        du / cambio.DIAS_UTEIS_ANO,
        sigma,
        orcamento,
        body.pct_forward / 100,
        k_put,
        k1,
        k2,
    )

    estrategias = [
        {
            "id": e["id"],
            "nome": e["nome"],
            "receita_rs": {k: _r2(v) for k, v in e["receita_rs"].items()},
            "p_abaixo_orcamento": round(e["p_abaixo_orcamento"], 4),
            "p_arrepender": round(e["p_arrepender"], 4),
            "premio_rs": _r2(e["premio_rs"]),
        }
        for e in resultado["estrategias"]
    ]

    return {
        "spot": round(spot, 4),
        "forward": round(F, 4),
        "forward_vs_spot": round(F / spot - 1, 4),
        "ultimo_dado": str(ultimo_dado),
        "vencimento": datas_futuras[-1].strftime("%Y-%m-%d"),
        "horizonte_du": du,
        "volume_usd": body.volume_usd,
        "orcamento": round(orcamento, 4),
        "pct_forward": body.pct_forward,
        "strikes": {"put": round(k_put, 4), "collar_k1": round(k1, 4), "collar_k2": round(k2, 4)},
        "vol_anual": round(sigma, 4),
        "selic_meta_aa": selic,
        "fed_funds_aa": fed,
        "carrego_rs": _r2(resultado["carrego_rs"]),
        "estrategias": estrategias,
        "aviso": AVISO,
        "premissas": PREMISSAS,
    }
