"""
Alert delivery — checks active price_alerts against current market prices
and sends email via Resend when a condition is triggered.

Call `run_alert_check()` from a scheduler (APScheduler, Vercel Cron, etc.).
Endpoint: POST /api/alerts/check  (internal, requires CRON_SECRET header)
"""

import logging
import os
from datetime import date, timedelta

import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from db import get_supabase
from market_cache import get_prices

logger = logging.getLogger(__name__)
router = APIRouter()

_RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
_RESEND_FROM = os.getenv("RESEND_FROM", "alertas@sugarcane.app")
_CRON_SECRET = os.getenv("CRON_SECRET", "")


# ── helpers ───────────────────────────────────────────────────────────────────

def _db():
    return get_supabase()


def _get_current_price(ticker: str) -> float | None:
    today = date.today()
    rows = get_prices(ticker, today - timedelta(days=7), today)
    if not rows:
        return None
    return float(rows[-1]["close"])


def _send_email(to: str, ticker: str, condition: str, trigger_price: float, current_price: float, label: str | None):
    condition_pt = "acima de" if condition == "above" else "abaixo de"
    subject = f"[Sugarcane] Alerta disparado: {ticker} {condition_pt} {trigger_price:.2f}"
    body = f"""
<html>
<body style="font-family:sans-serif;background:#f4f4f4;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="background:#052e16;padding:20px 28px">
      <h1 style="color:#4ade80;font-size:18px;margin:0">🔔 Alerta de Preço</h1>
    </div>
    <div style="padding:28px">
      <p style="font-size:15px;color:#111;margin:0 0 16px 0">
        Seu alerta foi disparado{f" (<strong>{label}</strong>)" if label else ""}:
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:8px 0;color:#6b7280">Ativo</td>
          <td style="padding:8px 0;font-weight:700;text-align:right">{ticker}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:8px 0;color:#6b7280">Condição</td>
          <td style="padding:8px 0;text-align:right">Preço {condition_pt} <strong>{trigger_price:.4f}</strong></td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#6b7280">Preço atual</td>
          <td style="padding:8px 0;font-weight:700;color:#16a34a;text-align:right">{current_price:.4f}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af">
        Acesse <a href="https://sugarcane.app/app/alertas" style="color:#16a34a">sugarcane.app</a> para gerenciar seus alertas.
      </p>
    </div>
  </div>
</body>
</html>
"""
    if not _RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email to %s", to)
        return False

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {_RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": _RESEND_FROM, "to": [to], "subject": subject, "html": body},
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("Alert email sent to %s for %s", to, ticker)
        return True
    except Exception as exc:
        logger.error("Failed to send alert email to %s: %s", to, exc)
        return False


# ── core logic ────────────────────────────────────────────────────────────────

def run_alert_check() -> dict:
    """
    Fetch all unfired active alerts, compare against live prices,
    fire emails and mark alerts as fired when triggered.
    Returns a summary dict.
    """
    db = _db()

    # Fetch alerts that haven't fired yet
    rows = (
        db.table("price_alerts")
        .select("id,user_id,ticker,condition,price,label,active")
        .eq("active", True)
        .is_("fired_at", "null")
        .execute()
    ).data

    if not rows:
        return {"checked": 0, "fired": 0}

    # Group by ticker to minimise market data calls
    by_ticker: dict[str, list] = {}
    for row in rows:
        by_ticker.setdefault(row["ticker"], []).append(row)

    fired_count = 0
    for ticker, alerts in by_ticker.items():
        current = _get_current_price(ticker)
        if current is None:
            logger.warning("No price data for %s — skipping", ticker)
            continue

        for alert in alerts:
            triggered = (
                (alert["condition"] == "above" and current > alert["price"]) or
                (alert["condition"] == "below" and current < alert["price"])
            )
            if not triggered:
                continue

            # Fetch user email from Supabase Auth
            try:
                user_row = db.auth.admin.get_user_by_id(alert["user_id"])
                email = user_row.user.email if user_row.user else None
            except Exception:
                email = None

            if email:
                _send_email(email, ticker, alert["condition"], alert["price"], current, alert.get("label"))

            # Mark as fired (deactivate so it won't re-trigger)
            db.table("price_alerts").update(
                {"active": False, "fired_at": "now()"}
            ).eq("id", alert["id"]).execute()

            fired_count += 1
            logger.info("Alert %s fired for user %s (%s %s %.4f, current %.4f)",
                        alert["id"], alert["user_id"], ticker, alert["condition"], alert["price"], current)

    return {"checked": len(rows), "fired": fired_count}


# ── HTTP endpoint (called by Vercel Cron / cron job) ─────────────────────────

@router.post("/api/alerts/check")
async def check_alerts(
    request: Request,
    x_cron_secret: str = Header(None, alias="x-cron-secret"),
):
    """
    Internal endpoint — trigger the alert delivery loop.
    Must be called with header  x-cron-secret: <CRON_SECRET>.
    Set up as a cron job: every 15 minutes.
    """
    if _CRON_SECRET and x_cron_secret != _CRON_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    result = run_alert_check()
    logger.info("Alert check complete: %s", result)
    return result
