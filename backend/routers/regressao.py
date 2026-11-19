"""Regressões: dólar (BCB+FRED) e açúcar (Ridge/XGBoost), com histórico de execuções por usuário."""

import logging
from typing import Annotated, Literal
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel
from auth import get_current_user
from market_cache import supa_client
from regression import run_dolar_regression, get_dolar_defaults, run_acucar_regression, get_acucar_defaults
from limiter import limiter
from fastapi import APIRouter


router = APIRouter()

logger = logging.getLogger(__name__)


class DolarRegressionRequest(BaseModel):
    selic: float
    m2_bcb: float
    prod_industrial: float
    fed_funds: float
    m2_fred: float
    indpro: float


class AcucarRunRequest(BaseModel):
    model: Literal["ridge", "xgboost"] = "ridge"
    estoque_inicial: float
    producao: float
    demanda: float
    estoque_final: float
    usdbrl: float
    cl_f: float


@router.get("/api/regression/dolar/defaults")
@limiter.limit("20/minute")
def dolar_defaults(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """Returns latest BCB + FRED values to pre-fill the frontend inputs."""
    return get_dolar_defaults()


@router.post("/api/regression/dolar/run")
@limiter.limit("10/minute")
def dolar_run(
    request: Request,
    body: DolarRegressionRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Trains OLS on BCB+FRED history, predicts taxa_dolar for user inputs,
    persists run to regression_runs, returns regression metrics.
    """
    try:
        resultado = run_dolar_regression(body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("dolar_run error: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao executar regressão.")

    # Persist to Supabase
    supa = supa_client()
    supa.table("regression_runs").insert({
        "user_id": user["id"],
        "tipo": "dolar",
        "inputs": body.model_dump(),
        "resultado": resultado,
    }).execute()

    return resultado


@router.get("/api/regression/acucar/defaults")
@limiter.limit("20/minute")
def acucar_defaults(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """Returns latest yfinance prices + USDA defaults to pre-fill sugar regression inputs."""
    return get_acucar_defaults()


@router.post("/api/regression/acucar/run")
@limiter.limit("10/minute")
def acucar_run(
    request: Request,
    body: AcucarRunRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Trains Ridge or XGBoost on annual yfinance+USDA data, predicts SB=F price,
    persists run to regression_runs, returns prediction with uncertainty range.
    """
    inputs = body.model_dump(exclude={"model"})
    try:
        resultado = run_acucar_regression(inputs, model_type=body.model)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    supa = supa_client()
    supa.table("regression_runs").insert({
        "user_id": str(user["id"]),
        "tipo": "acucar",
        "inputs": {**inputs, "model": body.model},
        "resultado": {
            "sb_f_previsto": resultado["sb_f_previsto"],
            "sb_f_min": resultado["sb_f_min"],
            "sb_f_max": resultado["sb_f_max"],
            "r2_loo": resultado["r2_loo"],
            "rmse_loo": resultado["rmse_loo"],
            "confianca": resultado["confianca"],
        },
    }).execute()

    return resultado


@router.get("/api/regression/runs")
@limiter.limit("20/minute")
def regression_runs_list(
    request: Request,
    tipo: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Returns the authenticated user's regression runs filtered by tipo."""
    if tipo not in ("dolar", "acucar"):
        raise HTTPException(status_code=400, detail="Tipo de regressão inválido: use 'dolar' ou 'acucar'.")
    supa = supa_client()
    res = (
        supa.table("regression_runs")
        .select("id, tipo, inputs, resultado, created_at")
        .eq("user_id", user["id"])
        .eq("tipo", tipo)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    return {"runs": res.data}
