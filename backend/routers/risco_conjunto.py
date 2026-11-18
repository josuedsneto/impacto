"""POST /api/risco-conjunto: probabilidade de a receita em R$/t ficar abaixo da meta (spec risco-conjunto)."""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, model_validator

from auth import get_current_user
from main import limiter  # main.py define o limiter antes de incluir este router
from risco_conjunto import JANELA_MAX, JANELA_MIN, JANELA_PADRAO, HistoricoInsuficiente, buscar_e_calcular

router = APIRouter()

MSG_SEM_PRECO = "Não foi possível obter os preços atuais de açúcar e dólar. Tente novamente em alguns minutos."
MSG_HISTORICO = "Histórico insuficiente para estimar o risco conjunto. Tente novamente em alguns minutos."


class RiscoConjuntoBody(BaseModel):
    meta: float = Field(gt=0, le=100_000, description="Meta de receita em R$/t")
    horizonte: int = Field(63, ge=1, le=252, description="Horizonte em pregões")
    janela: int = Field(JANELA_PADRAO, ge=JANELA_MIN, le=JANELA_MAX, description="Pregões usados para estimar vol e correlação")
    n_simulacoes: int = Field(20_000, ge=1_000, le=100_000)
    percentual_fixado: float = Field(0, ge=0, le=100)
    preco_fixado: Optional[float] = Field(None, gt=0, le=100_000, description="Preço médio fixado em R$/t")
    seed: Optional[int] = Field(None, ge=0, lt=2**31)

    @model_validator(mode="after")
    def fixado_exige_preco(self):
        if self.percentual_fixado > 0 and self.preco_fixado is None:
            raise ValueError("preco_fixado é obrigatório quando percentual_fixado > 0")
        return self


@router.post("/api/risco-conjunto")
@limiter.limit("10/minute")
def post_risco_conjunto(
    request: Request,
    body: RiscoConjuntoBody,
    user: Annotated[dict, Depends(get_current_user)],
):
    try:
        return buscar_e_calcular(
            meta=body.meta,
            horizonte=body.horizonte,
            janela=body.janela,
            n=body.n_simulacoes,
            percentual_fixado=body.percentual_fixado,
            preco_fixado=body.preco_fixado,
            seed=body.seed,
        )
    except LookupError:
        raise HTTPException(status_code=503, detail=MSG_SEM_PRECO)
    except HistoricoInsuficiente:
        raise HTTPException(status_code=503, detail=MSG_HISTORICO)
