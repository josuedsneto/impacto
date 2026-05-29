import logging
import os
from typing import Annotated, Literal
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from db import get_supabase
from auth import get_current_user
from regression import run_dolar_regression, get_dolar_defaults, run_acucar_regression, get_acucar_defaults
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


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
    estoque_uso_pct: float
    usdbrl: float
    cl_f: float


@router.get("/api/focus")
@limiter.limit("20/minute")
async def get_focus(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """
    Returns latest BCB Focus report medians for IPCA, Câmbio, Selic, PIB Total.
    Falls back to None values if the BCB API is unavailable.
    """
    import asyncio
    from bcb import Expectativas

    current_year = str(date.today().year)
    today = date.today()
    week_ago = today - timedelta(days=9)

    indicators = ["IPCA", "Câmbio", "Selic", "PIB Total"]
    result = {}

    def fetch_indicator(name: str) -> dict:
        try:
            expec = Expectativas()
            ep = expec.get_endpoint("ExpectativasMercadoAnuais")
            data = (
                ep.query()
                .filter(ep.Indicador == name)
                .filter(ep.DataReferencia == current_year)
                .filter(ep.baseCalculo == 0)
                .filter(ep.Data >= str(week_ago))
                .filter(ep.Data <= str(today))
                .collect()
            )
            if data.empty:
                return {"value": None, "delta": None}
            data = data.sort_values("Data")
            latest = float(data.iloc[-1]["Mediana"])
            if len(data) >= 2:
                prior = float(data.iloc[0]["Mediana"])
                delta = round(latest - prior, 4)
            else:
                delta = None
            return {"value": round(latest, 4), "delta": delta}
        except Exception:
            return {"value": None, "delta": None}

    loop = asyncio.get_running_loop()
    tasks = [loop.run_in_executor(None, fetch_indicator, name) for name in indicators]
    values = await asyncio.gather(*tasks)

    key_map = {"IPCA": "ipca", "Câmbio": "cambio", "Selic": "selic", "PIB Total": "pib"}
    for name, val in zip(indicators, values):
        result[key_map[name]] = val

    result["ano_referencia"] = current_year
    return result


@router.get("/api/regression/dolar/defaults")
@limiter.limit("20/minute")
async def dolar_defaults(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    import asyncio
    loop = asyncio.get_running_loop()
    defaults = await loop.run_in_executor(None, get_dolar_defaults)
    return defaults


@router.post("/api/regression/dolar/run")
@limiter.limit("10/minute")
async def dolar_run(
    request: Request,
    body: DolarRegressionRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    import asyncio
    loop = asyncio.get_running_loop()
    try:
        resultado = await loop.run_in_executor(None, run_dolar_regression, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("dolar_run error: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao executar regressão.")

    supa = get_supabase()
    supa.table("regression_runs").insert({
        "user_id": user["id"],
        "tipo": "dolar",
        "inputs": body.model_dump(),
        "resultado": resultado,
    }).execute()
    return resultado


@router.get("/api/regression/acucar/defaults")
@limiter.limit("20/minute")
async def acucar_defaults(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    import asyncio
    loop = asyncio.get_running_loop()
    defaults = await loop.run_in_executor(None, get_acucar_defaults)
    return defaults


@router.post("/api/regression/acucar/run")
@limiter.limit("10/minute")
async def acucar_run(
    request: Request,
    body: AcucarRunRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    import asyncio
    loop = asyncio.get_running_loop()
    inputs = body.model_dump(exclude={"model"})
    try:
        resultado = await loop.run_in_executor(
            None, lambda: run_acucar_regression(inputs, model_type=body.model)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    supa = get_supabase()
    supa.table("regression_runs").insert({
        "user_id": str(user["id"]),
        "tipo": "acucar",
        "inputs": {**inputs, "model": body.model},
        "resultado": {
            "sb_f_previsto": resultado["sb_f_previsto"],
            "sb_f_min": resultado["sb_f_min"],
            "sb_f_max": resultado["sb_f_max"],
            "r2": resultado["r2"],
            "rmse": resultado["rmse"],
        },
    }).execute()
    return resultado


@router.get("/api/regression/runs")
@limiter.limit("20/minute")
async def regression_runs_list(
    request: Request,
    tipo: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    if tipo not in ("dolar", "acucar"):
        raise HTTPException(status_code=400, detail="tipo must be 'dolar' or 'acucar'")
    supa = get_supabase()
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
