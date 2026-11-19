"""Simulações Monte Carlo do preço (salvas por usuário), parâmetros por ativo e Jump Diffusion (Merton)."""

import os
from datetime import date, timedelta
from typing import Annotated
from uuid import UUID
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import get_current_user
from market_cache import get_prices, supa_client
from simulation import run_simulation, DadosInsuficientesError
from validacao import validate_ticker, _validar_paginacao
from limiter import limiter
from fastapi import APIRouter


router = APIRouter()

class SimulationRequest(BaseModel):
    ticker: str
    preco_inicial: float = Field(gt=0, le=100_000)
    # Simulated in day blocks (≤ 5M cells each), so peak memory does not grow with the product.
    dias_simulados: int = Field(default=252, ge=1, le=1260)
    num_simulacoes: int = Field(default=10_000, ge=1, le=50_000)
    pct_bound: float = Field(default=0.50, gt=0, le=2)
    label: str | None = None


# ── Simulations ────────────────────────────────────────────────────────────────

@router.post("/api/simulations", status_code=201)
@limiter.limit("10/minute")
def create_simulation(
    request: Request,
    body: SimulationRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-01: Run MC simulation and persist results.
    Returns scalar metrics + percentiles_series for fan chart rendering.
    """
    ticker = validate_ticker(body.ticker)

    # PARAM-01: fetch user's custom volatility for this ticker, if set
    client = supa_client()
    params_row = (
        client.table("user_parameters")
        .select("volatilidade_custom")
        .eq("user_id", user["id"])
        .eq("ticker", ticker)
        .limit(1)
        .execute()
    )
    volatilidade_custom = (params_row.data[0] if params_row.data else {}).get("volatilidade_custom")

    try:
        result = run_simulation(
            ticker=ticker,
            preco_inicial=body.preco_inicial,
            dias_simulados=body.dias_simulados,
            num_simulacoes=body.num_simulacoes,
            pct_bound=body.pct_bound,
            volatilidade_custom=volatilidade_custom,
        )
    except DadosInsuficientesError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Persist to simulations table with user_id (SIM-04: user isolation)
    client = supa_client()
    insert_payload = {
        "user_id": user["id"],
        "ticker": result["ticker"],
        "preco_inicial": result["preco_inicial"],
        "dias_simulados": result["dias_simulados"],
        "num_simulacoes": result["num_simulacoes"],
        "pct_bound": result["pct_bound"],
        "pct_passou_limite": result["pct_passou_limite"],
        "p5": result["p5"],
        "p20": result["p20"],
        "p25": result["p25"],
        "p50": result["p50"],
        "p75": result["p75"],
        "p80": result["p80"],
        "p95": result["p95"],
        "percentiles_series": result["percentiles_series"],
        "label": body.label or None,
    }
    saved = client.table("simulations").insert(insert_payload).execute()
    sim_id = saved.data[0]["id"]

    return {**result, "id": sim_id, "created_at": saved.data[0]["created_at"]}


@router.get("/api/simulations")
@limiter.limit("60/minute")
def list_simulations(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
    """
    SIM-02/SIM-04: List all simulations for the authenticated user only.
    Returns id, ticker, label, p50, created_at (no percentiles_series to keep payload small).
    """
    _validar_paginacao(limit, offset)
    client = supa_client()
    result = (
        client.table("simulations")
        .select("id,ticker,label,preco_inicial,dias_simulados,p5,p50,p95,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"simulations": result.data}


@router.get("/api/simulations/{sim_id}")
@limiter.limit("60/minute")
def get_simulation(
    request: Request,
    sim_id: UUID,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-03/SIM-04: Fetch a single simulation including percentiles_series.
    Returns 404 if sim_id does not exist OR belongs to a different user.
    """
    client = supa_client()
    result = (
        client.table("simulations")
        .select("*")
        .eq("id", str(sim_id))
        .eq("user_id", user["id"])  # SIM-04: enforces user isolation at query level
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Simulação não encontrada.")
    return result.data[0]


# ── User Parameters ────────────────────────────────────────────────────────────

class UserParamsRequest(BaseModel):
    volatilidade_custom: float | None = Field(default=None, ge=0, le=5)
    taxa_livre_risco: float | None = Field(default=None, ge=-0.5, le=1)
    pct_bound_preferido: float | None = Field(default=None, ge=0.05, le=2)


@router.get("/api/params/{ticker}")
@limiter.limit("60/minute")
def get_params(
    request: Request,
    ticker: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-01: Return saved simulation params for a ticker, or 404 if not set."""
    client = supa_client()
    result = (
        client.table("user_parameters")
        .select("*")
        .eq("user_id", user["id"])
        .eq("ticker", ticker.upper())
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Nenhum parâmetro salvo para este ativo.")
    return result.data[0]


@router.put("/api/params/{ticker}")
@limiter.limit("30/minute")
def upsert_params(
    request: Request,
    ticker: str,
    body: UserParamsRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-02: Upsert per-ticker simulation params for the authenticated user."""
    ticker = validate_ticker(ticker)
    update_dict: dict = {}
    if body.volatilidade_custom is not None:
        update_dict["volatilidade_custom"] = body.volatilidade_custom
    if body.taxa_livre_risco is not None:
        update_dict["taxa_livre_risco"] = body.taxa_livre_risco
    if body.pct_bound_preferido is not None:
        update_dict["pct_bound_preferido"] = body.pct_bound_preferido

    if not update_dict:
        raise HTTPException(status_code=400, detail="Preencha ao menos um parâmetro.")

    update_dict["updated_at"] = date.today().isoformat()

    client = supa_client()
    client.table("user_parameters").upsert(
        {"user_id": user["id"], "ticker": ticker.upper(), **update_dict},
        on_conflict="user_id,ticker",
    ).execute()

    return {"ticker": ticker.upper(), "saved": True}


# ── Jump Diffusion ─────────────────────────────────────────────────────────────

class JumpDiffusionRequest(BaseModel):
    ticker: str = "SB=F"
    sigma: float | None = Field(default=None, gt=0, le=1)  # diária
    lambda_jumps: float = Field(default=0.1, ge=0, le=5)
    mu_jump: float = Field(default=-0.02, ge=-1, le=1)
    sigma_jump: float = Field(default=0.05, ge=0, le=1)
    steps: int = Field(default=252, ge=10, le=1260)


@router.post("/api/jump-diffusion")
@limiter.limit("15/minute")
def jump_diffusion(
    request: Request,
    body: JumpDiffusionRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Merton jump-diffusion price simulation."""
    import numpy as np
    ticker = validate_ticker(body.ticker)
    end = date.today()
    start = end - timedelta(days=3 * 365)
    rows = get_prices(ticker, start, end)

    closes = np.array([r["close"] for r in rows if r["close"]], dtype=float)
    if len(rows) < 20 or len(closes) < 2:
        raise HTTPException(status_code=400, detail="Dados históricos insuficientes.")

    log_returns = np.diff(np.log(closes))
    mu = float(np.mean(log_returns))
    sigma = float(body.sigma) if body.sigma is not None else float(np.std(log_returns, ddof=1))
    s0 = float(closes[-1])

    # mu e sigma são diários (log-retornos de fechamentos diários): cada passo é um pregão.
    # lambda_jumps é anual (tooltip), por isso /252.
    # mu já é o drift em log da série: não se subtrai σ²/2 de novo. Como mu traz os saltos
    # históricos, tira-se a média dos saltos por passo (λ_d·μ_salto) para não contar duas vezes.
    lam_d = body.lambda_jumps / 252
    rng = np.random.default_rng()
    n = body.steps
    n_saltos = rng.poisson(lam_d, n)
    # Soma de N saltos N(m, s²) i.i.d. ~ N(N·m, N·s²): exato em distribuição, sem loop
    saltos = n_saltos * body.mu_jump + np.sqrt(n_saltos) * body.sigma_jump * rng.standard_normal(n)
    incrementos = (mu - lam_d * body.mu_jump) + sigma * rng.standard_normal(n) + saltos
    precos = s0 * np.exp(np.concatenate(([0.0], np.cumsum(incrementos))))

    return {
        "ticker": ticker,
        "s0": round(s0, 4),
        "sigma": round(sigma, 6),
        "mu": round(mu, 6),
        "prices": [{"step": i, "price": round(float(p), 4)} for i, p in enumerate(precos)],
        "mean": round(float(np.mean(precos)), 4),
    }
