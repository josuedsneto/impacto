import datetime
import logging
import os
from typing import Annotated

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from supabase import create_client

from auth import get_current_user
from routers.shared import limiter

logger = logging.getLogger(__name__)
router = APIRouter()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

_PRICE_IDS: dict[str, str] = {
    "pro":        os.getenv("STRIPE_PRO_PRICE_ID", ""),
    "enterprise": os.getenv("STRIPE_ENTERPRISE_PRICE_ID", ""),
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _db():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def _upsert_subscription(user_id: str, **fields):
    _db().table("subscriptions").upsert(
        {"user_id": user_id, **fields},
        on_conflict="user_id",
    ).execute()


def _find_user_by_customer(customer_id: str) -> str | None:
    row = (
        _db()
        .table("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customer_id)
        .maybe_single()
        .execute()
    )
    return row.data["user_id"] if row.data else None


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/api/billing/subscription")
@limiter.limit("30/minute")
async def get_subscription(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Return the authenticated user's current plan."""
    row = (
        _db()
        .table("subscriptions")
        .select("plan,current_period_end,stripe_customer_id")
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )
    if not row.data:
        return {"plan": "free", "current_period_end": None}
    return {
        "plan": row.data["plan"],
        "current_period_end": row.data.get("current_period_end"),
        "has_stripe": bool(row.data.get("stripe_customer_id")),
    }


class CheckoutRequest(BaseModel):
    plan: str  # "pro" | "enterprise"


@router.post("/api/billing/checkout")
@limiter.limit("10/minute")
async def create_checkout(
    request: Request,
    body: CheckoutRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Create a Stripe Checkout session for the given plan."""
    price_id = _PRICE_IDS.get(body.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Plano inválido.")

    # Find or create Stripe customer
    row = (
        _db()
        .table("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )
    customer_id = row.data.get("stripe_customer_id") if row.data else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=user.get("email", ""),
            metadata={"user_id": user["id"]},
        )
        customer_id = customer.id
        _upsert_subscription(user["id"], stripe_customer_id=customer_id, plan="free")

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{_FRONTEND_URL}/app/planos?success=1",
        cancel_url=f"{_FRONTEND_URL}/app/planos?canceled=1",
        metadata={"user_id": user["id"], "plan": body.plan},
        allow_promotion_codes=True,
        billing_address_collection="required",
    )
    return {"checkout_url": session.url}


@router.post("/api/billing/portal")
@limiter.limit("10/minute")
async def create_portal(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Create a Stripe Customer Portal session."""
    row = (
        _db()
        .table("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )
    customer_id = row.data.get("stripe_customer_id") if row.data else None
    if not customer_id:
        raise HTTPException(status_code=400, detail="Nenhuma assinatura encontrada.")

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=f"{_FRONTEND_URL}/app/planos",
    )
    return {"portal_url": session.url}


@router.post("/api/billing/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """Stripe webhook — updates subscription table on billing events."""
    payload = await request.body()
    try:
        event = stripe.Webhook.construct_event(payload, stripe_signature, _WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        logger.warning("Invalid Stripe webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event["type"]
    logger.info("Stripe webhook: %s", etype)

    if etype == "checkout.session.completed":
        obj = event["data"]["object"]
        user_id = obj["metadata"].get("user_id")
        plan = obj["metadata"].get("plan", "pro")
        if user_id:
            _upsert_subscription(
                user_id,
                plan=plan,
                stripe_subscription_id=obj.get("subscription"),
            )

    elif etype in ("customer.subscription.updated", "customer.subscription.created"):
        sub = event["data"]["object"]
        user_id = _find_user_by_customer(sub["customer"])
        if user_id:
            status = sub["status"]
            active = status in ("active", "trialing")
            # derive plan from price metadata or default to 'pro'
            plan = "free"
            if active:
                items = sub.get("items", {}).get("data", [])
                price_id = items[0]["price"]["id"] if items else ""
                if price_id == _PRICE_IDS.get("enterprise"):
                    plan = "enterprise"
                elif price_id == _PRICE_IDS.get("pro"):
                    plan = "pro"
                else:
                    plan = "pro"  # fallback for any active sub
            period_end = sub.get("current_period_end")
            period_end_iso = (
                datetime.datetime.fromtimestamp(period_end, tz=datetime.timezone.utc).isoformat()
                if period_end else None
            )
            _upsert_subscription(
                user_id,
                plan=plan,
                stripe_subscription_id=sub["id"],
                current_period_end=period_end_iso,
            )

    elif etype == "customer.subscription.deleted":
        sub = event["data"]["object"]
        user_id = _find_user_by_customer(sub["customer"])
        if user_id:
            _upsert_subscription(
                user_id,
                plan="free",
                stripe_subscription_id=None,
                current_period_end=None,
            )

    elif etype == "invoice.payment_failed":
        invoice = event["data"]["object"]
        user_id = _find_user_by_customer(invoice["customer"])
        logger.warning("Payment failed for user %s", user_id)

    return {"received": True}
