from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated, Literal
from datetime import date as date_type, timedelta
import os
import requests
import yfinance as yf
from supabase import create_client

# Oracle Cloud IPs are blocked by Yahoo Finance — use a browser User-Agent session.
_yf_session = requests.Session()
_yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})
from pydantic import BaseModel
from auth import get_current_user, require_admin
from market_cache import get_prices, backfill_ticker
from simulation import run_simulation
from options import compute_payoff, bs_call_price, mc_call_price

app = FastAPI(title="Impacto API", version="2.0.0")

# CORS — origins configured via env var; defaults to localhost for local dev
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/focus")
async def get_focus(user: Annotated[dict, Depends(get_current_user)]):
    """
    Returns latest BCB Focus report medians for IPCA, Câmbio, Selic, PIB Total
    for the current calendar year, plus the delta vs the reading from ~7 days ago.
    Falls back to None values if the BCB API is unavailable.
    """
    import asyncio
    from bcb import Expectativas

    current_year = str(date_type.today().year)
    today = date_type.today()
    week_ago = today - timedelta(days=9)  # buffer for weekends

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

    # Run all indicator fetches in a thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, fetch_indicator, name)
        for name in indicators
    ]
    values = await asyncio.gather(*tasks)

    key_map = {"IPCA": "ipca", "Câmbio": "cambio", "Selic": "selic", "PIB Total": "pib"}
    for name, val in zip(indicators, values):
        result[key_map[name]] = val

    result["ano_referencia"] = current_year
    return result


@app.get("/api/me")
async def me(user: Annotated[dict, Depends(get_current_user)]):
    """Returns current user info — verifies JWT is accepted for normal users."""
    return {"id": user["id"], "email": user["email"], "role": user["role"]}


@app.get("/api/admin/ping")
async def admin_ping(user: Annotated[dict, Depends(require_admin)]):
    """Admin-only route — verifies role enforcement."""
    return {"message": "admin ok", "user": user["email"]}


# ── Pydantic models ─────────────────────────────────────────────────────────────

class SimulationRequest(BaseModel):
    ticker: str
    preco_inicial: float
    dias_simulados: int = 252
    num_simulacoes: int = 10_000
    pct_bound: float = 0.50
    label: str | None = None


class TickerSuggestRequest(BaseModel):
    ticker: str
    nome: str = ""        # human-readable name, optional
    tipo: Literal["commodity", "fx", "acao", "indice"] = "commodity"


# ── Market data ─────────────────────────────────────────────────────────────────

@app.get("/api/market/prices")
async def market_prices(
    ticker: str,
    start: date_type,
    end: date_type,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Return cached OHLCV rows for ticker in [start, end].
    MKT-01: second call returns from DB without calling yfinance.
    MKT-02: only uncached dates are fetched from yfinance.
    """
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")
    rows = get_prices(ticker, start, end)
    return {"ticker": ticker, "start": start.isoformat(), "end": end.isoformat(), "rows": rows}


@app.post("/api/market/suggest")
async def suggest_ticker(
    body: TickerSuggestRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    MKT-03: User suggests a new ticker.
    Validates ticker against yfinance BEFORE writing to DB.
    Returns 400 with visible error if ticker is invalid or has no data.
    On success inserts row into tickers_catalog with status='pending'.
    """
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="ticker cannot be empty")

    # Validate: attempt a minimal yfinance download (last 5 days)
    try:
        probe = yf.download(ticker, period="5d", progress=False, auto_adjust=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"yfinance error for '{ticker}': {exc}")

    if probe.empty:
        raise HTTPException(
            status_code=400,
            detail=f"Ticker '{ticker}' not found on yfinance or has no recent data. "
                   "Check the symbol and try again.",
        )

    # Write to tickers_catalog only after validation passes
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    existing = (
        client.table("tickers_catalog")
        .select("ticker,status")
        .eq("ticker", ticker)
        .execute()
    )
    if existing.data:
        return {
            "ticker": ticker,
            "status": existing.data[0]["status"],
            "message": f"Ticker '{ticker}' already exists with status '{existing.data[0]['status']}'.",
        }

    client.table("tickers_catalog").insert({
        "ticker": ticker,
        "nome": body.nome or ticker,
        "tipo": body.tipo,
        "status": "pending",
        "backfill_status": "pending",
        "adicionado_por": user["id"],
    }).execute()

    return {"ticker": ticker, "status": "pending", "message": f"Ticker '{ticker}' submitted for admin review."}


@app.get("/api/admin/suggestions")
async def admin_list_suggestions(
    user: Annotated[dict, Depends(require_admin)],
    status: str | None = None,
):
    """ADM-01: Return ticker suggestions. Optionally filter by status=pending|approved|rejected."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    query = client.table("tickers_catalog").select(
        "id,ticker,nome,tipo,status,backfill_status,review_note,adicionado_por,created_at"
    ).order("created_at", desc=False)
    if status:
        query = query.eq("status", status)
    result = query.execute()
    return {"suggestions": result.data}


class SuggestionReviewRequest(BaseModel):
    action: str          # "approve" | "reject"
    review_note: str = ""


@app.patch("/api/admin/suggestions/{suggestion_id}")
async def admin_review_suggestion(
    suggestion_id: str,
    body: SuggestionReviewRequest,
    user: Annotated[dict, Depends(require_admin)],
):
    """
    ADM-02: Approve or reject a ticker suggestion.
    ADM-03: On approve, calls backfill_ticker() synchronously and sets backfill_status='done'.
    ADM-04: On reject, stores review_note and sets status='rejected'.
    """
    if body.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be 'approve' or 'reject'")

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    # Fetch the suggestion to get the ticker symbol
    existing = (
        client.table("tickers_catalog")
        .select("id,ticker,status")
        .eq("id", suggestion_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    ticker = existing.data[0]["ticker"]

    if body.action == "approve":
        # ADM-03: trigger backfill synchronously — completes within the request
        backfill_ticker(ticker)
        update_payload = {
            "status": "approved",
            "backfill_status": "done",
            "review_note": body.review_note or None,
        }
    else:  # reject
        update_payload = {
            "status": "rejected",
            "review_note": body.review_note or None,
        }

    client.table("tickers_catalog").update(update_payload).eq("id", suggestion_id).execute()

    return {"id": suggestion_id, "ticker": ticker, **update_payload}


@app.post("/api/admin/market/backfill/{ticker}")
async def admin_backfill(
    ticker: str,
    user: Annotated[dict, Depends(require_admin)],
):
    """
    MKT-04: Admin triggers full backfill for a ticker.
    Uses backfill_ticker() which handles tickers with history starting after 2013-01-01.
    Updates backfill_status in tickers_catalog on completion.
    """
    result = backfill_ticker(ticker.upper())

    # Update tickers_catalog backfill_status
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("tickers_catalog").update(
        {"backfill_status": "done"}
    ).eq("ticker", ticker.upper()).execute()

    return result


# ── Simulations ────────────────────────────────────────────────────────────────

@app.post("/api/simulations", status_code=201)
async def create_simulation(
    body: SimulationRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-01: Run MC simulation and persist results.
    Returns scalar metrics + percentiles_series for fan chart rendering.
    """
    # PARAM-01: fetch user's custom volatility for this ticker, if set
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    params_row = (
        client.table("user_parameters")
        .select("volatilidade_custom")
        .eq("user_id", user["id"])
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

    # Persist to simulations table with user_id (SIM-04: user isolation)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    insert_payload = {
        "user_id": user["id"],
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
        "label": body.label or None,
    }
    saved = client.table("simulations").insert(insert_payload).execute()
    sim_id = saved.data[0]["id"]

    return {**result, "id": sim_id, "created_at": saved.data[0]["created_at"]}


@app.get("/api/simulations")
async def list_simulations(
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-02/SIM-04: List all simulations for the authenticated user only.
    Returns id, ticker, label, p50, created_at (no percentiles_series to keep payload small).
    """
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("simulations")
        .select("id,ticker,label,preco_inicial,dias_simulados,p5,p50,p95,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return {"simulations": result.data}


@app.get("/api/simulations/{sim_id}")
async def get_simulation(
    sim_id: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    SIM-03/SIM-04: Fetch a single simulation including percentiles_series.
    Returns 404 if sim_id does not exist OR belongs to a different user.
    """
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("simulations")
        .select("*")
        .eq("id", sim_id)
        .eq("user_id", user["id"])  # SIM-04: enforces user isolation at query level
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Simulation not found.")
    return result.data[0]


# ── Options & Pricing ─────────────────────────────────────────────────────────

class OptionLeg(BaseModel):
    type: str        # "call" | "put"
    strike: float
    premium: float
    position: str    # "long" | "short"
    quantity: int = 1


class PayoffRequest(BaseModel):
    legs: list[OptionLeg]


class BSPriceRequest(BaseModel):
    S: float          # current underlying price
    K: float          # strike
    T: float          # time to expiry in years
    r: float          # risk-free rate (annualized)
    sigma: float      # volatility (annualized)


class MCPriceRequest(BaseModel):
    S: float
    K: float
    T: float
    r: float
    sigma: float
    num_simulacoes: int = 10_000


@app.post("/api/options/payoff")
async def options_payoff(
    body: PayoffRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-01: Compute combined payoff for a multi-leg options strategy."""
    legs = [leg.model_dump() for leg in body.legs]
    result = compute_payoff(legs, price_range=None)
    return result


@app.post("/api/options/bs-price")
async def options_bs_price(
    body: BSPriceRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """OPT-02: Black-Scholes European call price with user-supplied sigma."""
    try:
        price = bs_call_price(S=body.S, K=body.K, T=body.T, r=body.r, sigma=body.sigma)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"price": price, "S": body.S, "K": body.K, "T": body.T, "r": body.r, "sigma": body.sigma}


@app.post("/api/options/mc-price")
async def options_mc_price(
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


# ── User Parameters ────────────────────────────────────────────────────────────

class UserParamsRequest(BaseModel):
    volatilidade_custom: float | None = None   # 0–5
    taxa_livre_risco: float | None = None       # -0.5–1
    pct_bound_preferido: float | None = None    # 0.05–2


class WatchlistAddRequest(BaseModel):
    ticker: str


@app.get("/api/params/{ticker}")
async def get_params(
    ticker: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-01: Return saved simulation params for a ticker, or 404 if not set."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("user_parameters")
        .select("*")
        .eq("user_id", user["id"])
        .eq("ticker", ticker.upper())
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Params not found for ticker")
    return result.data[0]


@app.put("/api/params/{ticker}")
async def upsert_params(
    ticker: str,
    body: UserParamsRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-02: Upsert per-ticker simulation params for the authenticated user."""
    update_dict: dict = {}
    if body.volatilidade_custom is not None:
        update_dict["volatilidade_custom"] = body.volatilidade_custom
    if body.taxa_livre_risco is not None:
        update_dict["taxa_livre_risco"] = body.taxa_livre_risco
    if body.pct_bound_preferido is not None:
        update_dict["pct_bound_preferido"] = body.pct_bound_preferido

    if not update_dict:
        raise HTTPException(status_code=400, detail="No params provided")

    update_dict["updated_at"] = date_type.today().isoformat()

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("user_parameters").upsert(
        {"user_id": user["id"], "ticker": ticker.upper(), **update_dict},
        on_conflict="user_id,ticker",
    ).execute()

    return {"ticker": ticker.upper(), "saved": True}


# ── Watchlist ──────────────────────────────────────────────────────────────────

@app.get("/api/watchlist")
async def get_watchlist(
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-03: Return all tickers in the user's watchlist."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("watchlist")
        .select("ticker,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=False)
        .execute()
    )
    return {"tickers": [row["ticker"] for row in result.data]}


@app.post("/api/watchlist", status_code=201)
async def add_to_watchlist(
    body: WatchlistAddRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-03: Add a ticker to the user's watchlist (idempotent)."""
    ticker = body.ticker.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="ticker cannot be empty")

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("watchlist").upsert(
        {"user_id": user["id"], "ticker": ticker},
        on_conflict="user_id,ticker",
        ignore_duplicates=True,
    ).execute()

    return {"ticker": ticker, "added": True}


@app.delete("/api/watchlist/{ticker}")
async def remove_from_watchlist(
    ticker: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-03: Remove a ticker from the user's watchlist."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("watchlist").delete().eq("user_id", user["id"]).eq("ticker", ticker.upper()).execute()
    return {"ticker": ticker.upper(), "removed": True}


# ── Admin Config ───────────────────────────────────────────────────────────────

class AdminConfigUpdateRequest(BaseModel):
    value: str
    description: str | None = None


@app.get("/api/admin/config")
async def admin_get_config(
    user: Annotated[dict, Depends(require_admin)],
):
    """Return all admin_config rows ordered by key."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("admin_config")
        .select("key,value,description,updated_at")
        .order("key")
        .execute()
    )
    return {"config": result.data}


@app.put("/api/admin/config/{key}")
async def admin_update_config(
    key: str,
    body: AdminConfigUpdateRequest,
    user: Annotated[dict, Depends(require_admin)],
):
    """Upsert a key/value pair in admin_config."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    payload = {
        "key": key,
        "value": body.value,
        "updated_at": date_type.today().isoformat(),
    }
    if body.description is not None:
        payload["description"] = body.description
    client.table("admin_config").upsert(payload, on_conflict="key").execute()
    return {"key": key, "value": body.value, "saved": True}


# ── VaR ────────────────────────────────────────────────────────────────────────

@app.get("/api/var")
async def get_var(
    ticker: str = "SB=F",
    confidence: float = 0.95,
    horizon: int = 1,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute Historical and Parametric Value at Risk.

    Returns var_historico and var_parametrico in price units (not percent).
    Both figures represent the potential loss over `horizon` days at the
    given confidence level.
    """
    from scipy.stats import norm
    import numpy as np

    if not (0 < confidence < 1):
        raise HTTPException(status_code=400, detail="confidence must be between 0 and 1")
    if horizon < 1:
        raise HTTPException(status_code=400, detail="horizon must be >= 1")

    data = yf.download(ticker, period="1y", progress=False, auto_adjust=True)
    if data.empty or len(data) < 10:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].dropna().values.flatten()
    returns = np.diff(closes) / closes[:-1]
    last_price = float(closes[-1])

    # Historical VaR
    var_historico = float(np.percentile(returns, (1 - confidence) * 100) * last_price * (horizon ** 0.5))

    # Parametric VaR
    mu = float(np.mean(returns))
    sigma = float(np.std(returns, ddof=1))
    var_parametrico = float(norm.ppf(1 - confidence) * sigma * last_price * (horizon ** 0.5))

    return {
        "ticker": ticker,
        "confidence": confidence,
        "horizon": horizon,
        "var_historico": round(var_historico, 4),
        "var_parametrico": round(var_parametrico, 4),
        "last_price": round(last_price, 4),
        "n_observations": len(returns),
    }


# ── Breakeven ──────────────────────────────────────────────────────────────────

@app.get("/api/breakeven")
async def get_breakeven(
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Compute sugar breakeven in BRL/saca.

    breakeven_reais_saca = preco_acucar_cents * fator_conversao * preco_dolar

    fator_conversao is stored in admin_config and defaults to 1.12045 if not found.
    """
    # Fetch conversion factor from admin_config
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    config_row = (
        client.table("admin_config")
        .select("value")
        .eq("key", "breakeven_fator_conversao")
        .limit(1)
        .execute()
    )
    fator_conversao = float((config_row.data[0] if config_row.data else {}).get("value", "1.12045"))

    # Fetch latest prices from Supabase cache
    today = date_type.today()
    start = today - timedelta(days=7)
    sugar_rows = get_prices("SB=F", start, today)
    usd_rows = get_prices("USDBRL=X", start, today)

    if not sugar_rows or not usd_rows:
        raise HTTPException(status_code=503, detail="Could not fetch live prices — backfill needed")

    preco_acucar_cents = float(sugar_rows[-1]["close"])
    preco_dolar = float(usd_rows[-1]["close"])
    breakeven_reais_saca = preco_acucar_cents * fator_conversao * preco_dolar

    return {
        "preco_acucar_cents_lb": round(preco_acucar_cents, 4),
        "preco_dolar_brl": round(preco_dolar, 4),
        "fator_conversao": fator_conversao,
        "breakeven_brl_saca": round(breakeven_reais_saca, 2),
    }


# ── ARIMA ──────────────────────────────────────────────────────────────────────

@app.get("/api/arima/{ticker}")
async def get_arima(
    ticker: str,
    steps: int = 30,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Fit ARIMA(1,1,1) on 2 years of daily closes and forecast `steps` periods ahead.

    Returns forecast values with 95% confidence intervals.
    """
    import numpy as np
    from statsmodels.tsa.arima.model import ARIMA
    import pandas as pd

    if steps < 1 or steps > 365:
        raise HTTPException(status_code=400, detail="steps must be between 1 and 365")

    data = yf.download(ticker, period="2y", progress=False, auto_adjust=True)
    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].dropna()

    try:
        model = ARIMA(closes, order=(1, 1, 1))
        fit = model.fit()
        forecast_result = fit.get_forecast(steps=steps)
        forecast_mean = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=0.05)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"ARIMA fitting failed: {exc}")

    last_date = closes.index[-1]
    forecast_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=steps, freq="B")

    forecast_list = []
    lower_list = []
    upper_list = []
    for i, dt in enumerate(forecast_dates):
        date_str = dt.strftime("%Y-%m-%d")
        forecast_list.append({"date": date_str, "value": round(float(forecast_mean.iloc[i]), 4)})
        lower_list.append({"date": date_str, "value": round(float(conf_int.iloc[i, 0]), 4)})
        upper_list.append({"date": date_str, "value": round(float(conf_int.iloc[i, 1]), 4)})

    return {
        "ticker": ticker,
        "steps": steps,
        "forecast": forecast_list,
        "confidence_lower": lower_list,
        "confidence_upper": upper_list,
    }


# ── Stress Test ────────────────────────────────────────────────────────────────

@app.get("/api/stress")
async def get_stress(
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute stress scenarios for the given ticker using full price history.

    Returns three scenarios:
    - worst_5pct: Worst 5% drawdown period from historical data
    - crisis_2008: Price performance during Aug 2008 – Mar 2009
    - covid_2020: Price performance during Feb 2020 – Apr 2020
    """
    import numpy as np
    import pandas as pd

    data = yf.download(ticker, period="max", progress=False, auto_adjust=True)
    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].dropna()
    last_price = float(closes.iloc[-1])

    def compute_drawdown_window(series: "pd.Series") -> dict:
        """Return the worst drawdown window (start, end, drawdown_pct, price_after)."""
        if series.empty:
            return {"start": None, "end": None, "drawdown_pct": None, "last_price_after": None}
        roll_max = series.cummax()
        drawdown = (series - roll_max) / roll_max
        worst_idx = int(drawdown.argmin())
        worst_val = float(drawdown.iloc[worst_idx])
        # Find the peak before the trough
        peak_idx = int(series.iloc[: worst_idx + 1].argmax())
        start_date = series.index[peak_idx].strftime("%Y-%m-%d")
        end_date = series.index[worst_idx].strftime("%Y-%m-%d")
        return {
            "start": start_date,
            "end": end_date,
            "drawdown_pct": round(worst_val * 100, 2),
            "last_price_after": round(float(series.iloc[worst_idx]), 4),
        }

    # Scenario 1: worst 5% drawdown window from full history
    worst_dd = compute_drawdown_window(closes)

    # Scenario 2: 2008 financial crisis period
    crisis_2008_series = closes.loc["2008-08-01":"2009-03-31"] if "2008-08-01" in closes.index or closes.index[0].year <= 2008 else pd.Series(dtype=float)
    try:
        crisis_2008_series = closes.loc["2008-08-01":"2009-03-31"]
    except Exception:
        crisis_2008_series = pd.Series(dtype=float)
    crisis_2008 = compute_drawdown_window(crisis_2008_series)
    crisis_2008["name"] = "Crise 2008"

    # Scenario 3: COVID crash
    try:
        covid_series = closes.loc["2020-02-01":"2020-04-30"]
    except Exception:
        covid_series = pd.Series(dtype=float)
    covid = compute_drawdown_window(covid_series)
    covid["name"] = "COVID 2020"

    worst_dd["name"] = "Pior drawdown histórico"

    return {
        "ticker": ticker,
        "last_price": round(last_price, 4),
        "scenarios": [worst_dd, crisis_2008, covid],
    }


# ── News ───────────────────────────────────────────────────────────────────────

import time as _time

_news_cache: dict = {"ts": 0.0, "items": []}
_NEWS_TTL = 1800  # 30 minutes


@app.get("/api/news")
async def get_news(
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Fetch top 10 financial news items from Google News RSS feed.

    Results are cached for 30 minutes to avoid hammering the RSS endpoint.
    """
    import feedparser

    now = _time.time()
    if now - _news_cache["ts"] < _NEWS_TTL and _news_cache["items"]:
        return {"items": _news_cache["items"], "cached": True}

    url = "https://news.google.com/rss/search?q=açúcar+NY+futuros+dólar+real&hl=pt-BR&gl=BR&ceid=BR:pt-419"
    try:
        feed = feedparser.parse(url)
        items = []
        for entry in feed.entries[:10]:
            published = entry.get("published", "")
            source = entry.get("source", {})
            source_title = source.get("title", "") if isinstance(source, dict) else str(source)
            items.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": published,
                "source": source_title,
            })
        _news_cache["ts"] = now
        _news_cache["items"] = items
    except Exception as exc:
        if _news_cache["items"]:
            return {"items": _news_cache["items"], "cached": True, "warning": str(exc)}
        raise HTTPException(status_code=503, detail=f"Failed to fetch news: {exc}")

    return {"items": items, "cached": False}


# ── Volatility ─────────────────────────────────────────────────────────────────

@app.get("/api/volatility")
async def get_volatility(
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute realized volatility at 30d, 90d and 1y horizons (annualized).

    Also returns rolling 30d volatility history for chart rendering.
    """
    import numpy as np
    import pandas as pd

    data = yf.download(ticker, period="1y", progress=False, auto_adjust=True)
    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].dropna()
    last_price = float(closes.iloc[-1])
    log_returns = np.log(closes / closes.shift(1)).dropna()

    ann = 252 ** 0.5

    vol_30d = float(log_returns.iloc[-30:].std(ddof=1) * ann) if len(log_returns) >= 30 else None
    vol_90d = float(log_returns.iloc[-90:].std(ddof=1) * ann) if len(log_returns) >= 90 else None
    vol_1y = float(log_returns.std(ddof=1) * ann)

    rolling_30d = log_returns.rolling(30).std() * ann
    history = []
    for dt, row_close, row_vol in zip(closes.index[1:], closes.iloc[1:], rolling_30d):
        if not np.isnan(row_vol):
            history.append({
                "date": dt.strftime("%Y-%m-%d"),
                "close": round(float(row_close), 4),
                "vol_30d_rolling": round(float(row_vol), 6),
            })

    return {
        "ticker": ticker,
        "vol_30d": round(vol_30d, 6) if vol_30d is not None else None,
        "vol_90d": round(vol_90d, 6) if vol_90d is not None else None,
        "vol_1y": round(vol_1y, 6),
        "last_price": round(last_price, 4),
        "history": history,
    }
