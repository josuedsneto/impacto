"""Opções: payoff de estratégias, preço Black-76 e Monte Carlo de call sobre futuro (OPT-01 a OPT-03)."""

from typing import Annotated, Literal
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import get_current_user
from options import compute_payoff, black76_price, mc_black76_price
from limiter import limiter
from fastapi import APIRouter


router = APIRouter()

# ── Options & Pricing ─────────────────────────────────────────────────────────

class OptionLeg(BaseModel):
    type: Literal["call", "put"]
    strike: float = Field(gt=0, le=1_000_000)
    premium: float = Field(ge=0, le=1_000_000)
    position: Literal["long", "short"]
    quantity: int = Field(default=1, ge=1, le=100_000)


class PayoffRequest(BaseModel):
    legs: list[OptionLeg] = Field(min_length=1, max_length=20)


class BSPriceRequest(BaseModel):
    F: float = Field(gt=0, le=100_000)       # preço do futuro (¢/lb)
    K: float = Field(gt=0, le=1_000_000)     # strike
    T: float = Field(gt=0, le=30)            # time to expiry in years
    r: float = Field(ge=0, le=5)             # risk-free rate (annualized)
    sigma: float = Field(gt=0, le=10)        # volatility (annualized)


class MCPriceRequest(BaseModel):
    F: float = Field(gt=0, le=100_000)
    K: float = Field(gt=0, le=1_000_000)
    T: float = Field(gt=0, le=30)
    r: float = Field(ge=0, le=5)
    sigma: float = Field(gt=0, le=10)
    num_simulacoes: int = Field(default=10_000, ge=100, le=100_000)


@router.post("/api/options/payoff")
@limiter.limit("30/minute")
def options_payoff(
    request: Request,
    body: PayoffRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-01: Compute combined payoff for a multi-leg options strategy."""
    legs = [leg.model_dump() for leg in body.legs]
    try:
        return compute_payoff(legs, price_range=None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/options/bs-price")
@limiter.limit("60/minute")
def options_bs_price(
    request: Request,
    body: BSPriceRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-02: Preço de call sobre futuro por Black-76, com sigma informado pelo usuário."""
    try:
        price = black76_price(F=body.F, K=body.K, T=body.T, r=body.r, sigma=body.sigma)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"price": price, "F": body.F, "K": body.K, "T": body.T, "r": body.r, "sigma": body.sigma}


@router.post("/api/options/mc-price")
@limiter.limit("60/minute")
def options_mc_price(
    request: Request,
    body: MCPriceRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-03: Monte Carlo de call sobre futuro (Black-76, drift zero). Semente fixa: mesmo input, mesmo preço."""
    try:
        price = mc_black76_price(
            F=body.F, K=body.K, T=body.T, r=body.r,
            sigma=body.sigma, num_simulacoes=body.num_simulacoes, seed=42,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"price": price, "F": body.F, "K": body.K, "T": body.T, "r": body.r, "sigma": body.sigma}
