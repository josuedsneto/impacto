import logging
import os
from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel, Field
from db import get_supabase
from auth import get_current_user
from simulation import run_simulation
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


class SimulationRequest(BaseModel):
    ticker: str
    preco_inicial: float
    dias_simulados: int = Field(default=252, ge=1, le=1000)
    num_simulacoes: int = Field(default=10_000, ge=1, le=100_000)
    pct_bound: float = Field(default=0.50, gt=0, le=2)
    label: str | None = None


async def _run_simulation_bg(sim_id: str, body: SimulationRequest, user_id: str):
    """Background task: run MC simulation and update the DB row with results."""
    try:
        client = get_supabase()

        # Fetch user's custom volatility
        params_row = (
            client.table("user_parameters")
            .select("volatilidade_custom")
            .eq("user_id", user_id)
            .eq("ticker", body.ticker.strip().upper())
            .limit(1)
            .execute()
        )
        volatilidade_custom = (params_row.data[0] if params_row.data else {}).get("volatilidade_custom")

        result = run_simulation(
            ticker=body.ticker.strip().upper(),
            preco_inicial=body.preco_inicial,
            dias_simulados=body.dias_simulados,
            num_simulacoes=body.num_simulacoes,
            pct_bound=body.pct_bound,
            volatilidade_custom=volatilidade_custom,
        )

        update_payload = {
            "ticker": result["ticker"],
            "preco_inicial": result["preco_inicial"],
            "dias_simulados": result["dias_simulados"],
            "num_simulacoes": result["num_simulacoes"],
            "pct_bound": result["pct_bound"],
            "p5": result["p5"],
            "p20": result["p20"],
            "p25": result["p25"],
            "p50": result["p50"],
            "p75": result["p75"],
            "p80": result["p80"],
            "p95": result["p95"],
            "percentiles_series": result["percentiles_series"],
            "status": "done",
        }
        client.table("simulations").update(update_payload).eq("id", sim_id).execute()
        logger.info("Simulation %s completed", sim_id)
    except Exception as exc:
        logger.error("Simulation %s failed: %s", sim_id, exc)
        try:
            client = get_supabase()
            client.table("simulations").update({"status": "error"}).eq("id", sim_id).execute()
        except Exception:
            pass


@router.post("/api/simulations", status_code=202)
@limiter.limit("10/minute")
async def create_simulation(
    request: Request,
    body: SimulationRequest,
    background_tasks: BackgroundTasks,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-01: Enqueue MC simulation as a background task.
    Returns {id, status: "running"} immediately; poll GET /api/simulations/{id} for result.
    """
    client = get_supabase()
    pending = client.table("simulations").insert({
        "user_id": user["id"],
        "ticker": body.ticker.strip().upper(),
        "label": body.label or None,
        "status": "running",
        "preco_inicial": body.preco_inicial,
        "dias_simulados": body.dias_simulados,
        "num_simulacoes": body.num_simulacoes,
        "pct_bound": body.pct_bound,
    }).execute()
    sim_id = pending.data[0]["id"]
    background_tasks.add_task(_run_simulation_bg, sim_id, body, user["id"])
    return {"id": sim_id, "status": "running", "created_at": pending.data[0]["created_at"]}


@router.get("/api/simulations")
@limiter.limit("60/minute")
async def list_simulations(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
    """SIM-02/SIM-04: List all simulations for the authenticated user only."""
    client = get_supabase()
    result = (
        client.table("simulations")
        .select("id,ticker,label,preco_inicial,dias_simulados,p5,p50,p95,status,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"simulations": result.data}


@router.get("/api/simulations/{sim_id}")
@limiter.limit("60/minute")
async def get_simulation(
    request: Request,
    sim_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """SIM-03/SIM-04: Fetch a single simulation including percentiles_series."""
    client = get_supabase()
    result = (
        client.table("simulations")
        .select("*")
        .eq("id", str(sim_id))
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Simulation not found.")
    return result.data[0]
