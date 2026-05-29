import logging
import os
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from db import get_supabase
from auth import get_current_user
from routers.shared import limiter, validate_ticker

logger = logging.getLogger(__name__)
router = APIRouter()


class AlertCreateRequest(BaseModel):
    ticker: str
    condition: Literal["above", "below"]
    price: float = Field(gt=0)
    label: str | None = None


@router.get("/api/alerts")
@limiter.limit("30/minute")
async def list_alerts(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """List all active price alerts for the authenticated user."""
    client = get_supabase()
    rows = (
        client.table("price_alerts")
        .select("id,ticker,condition,price,label,active,created_at")
        .eq("user_id", user["id"])
        .eq("active", True)
        .order("created_at", desc=True)
        .execute()
    )
    return {"alerts": rows.data}


@router.post("/api/alerts", status_code=201)
@limiter.limit("20/minute")
async def create_alert(
    request: Request,
    body: AlertCreateRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Create a new price alert."""
    ticker = validate_ticker(body.ticker)
    client = get_supabase()
    row = client.table("price_alerts").insert({
        "user_id": user["id"],
        "ticker": ticker,
        "condition": body.condition,
        "price": body.price,
        "label": body.label or None,
        "active": True,
    }).execute()
    return row.data[0]


@router.delete("/api/alerts/{alert_id}")
@limiter.limit("20/minute")
async def delete_alert(
    request: Request,
    alert_id: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Soft-delete (deactivate) a price alert."""
    client = get_supabase()
    result = (
        client.table("price_alerts")
        .update({"active": False})
        .eq("id", alert_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"deleted": True}
