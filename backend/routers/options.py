import logging
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from auth import get_current_user
from options import compute_payoff, bs_call_price, mc_call_price
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()


class OptionLeg(BaseModel):
    type: str        # "call" | "put"
    strike: float
    premium: float
    position: str    # "long" | "short"
    quantity: int = 1


class PayoffRequest(BaseModel):
    legs: list[OptionLeg]


class BSPriceRequest(BaseModel):
    S: float = Field(gt=0, le=100_000)
    K: float = Field(gt=0)
    T: float = Field(gt=0, le=30)
    r: float = Field(ge=0, le=5)
    sigma: float = Field(gt=0, le=10)


class MCPriceRequest(BaseModel):
    S: float = Field(gt=0, le=100_000)
    K: float = Field(gt=0)
    T: float = Field(gt=0, le=30)
    r: float = Field(ge=0, le=5)
    sigma: float = Field(gt=0, le=10)
    num_simulacoes: int = Field(default=10_000, ge=1, le=100_000)


@router.post("/api/options/payoff")
async def options_payoff(
    body: PayoffRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-01: Compute combined payoff for a multi-leg options strategy."""
    legs = [leg.model_dump() for leg in body.legs]
    result = compute_payoff(legs, price_range=None)
    return result


@router.post("/api/options/bs-price")
async def options_bs_price(
    body: BSPriceRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-02: Black-Scholes European call price."""
    try:
        price = bs_call_price(S=body.S, K=body.K, T=body.T, r=body.r, sigma=body.sigma)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"price": price, "S": body.S, "K": body.K, "T": body.T, "r": body.r, "sigma": body.sigma}


@router.post("/api/options/mc-price")
@limiter.limit("10/minute")
async def options_mc_price(
    request: Request,
    body: MCPriceRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-03: Risk-neutral MC European call pricer."""
    try:
        price = mc_call_price(
            S=body.S, K=body.K, T=body.T, r=body.r,
            sigma=body.sigma, num_simulacoes=body.num_simulacoes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"price": price, "S": body.S, "K": body.K, "T": body.T, "r": body.r, "sigma": body.sigma}
