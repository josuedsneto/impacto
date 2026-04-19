from dotenv import load_dotenv
load_dotenv()

import logging
import os
import re
from uuid import UUID

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated, Literal, Optional
from datetime import date, timedelta
import requests
import yfinance as yf
from supabase import create_client
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

logger = logging.getLogger(__name__)

# Oracle Cloud IPs are blocked by Yahoo Finance — use a browser User-Agent session.
_yf_session = requests.Session()
_yf_session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
})
from pydantic import BaseModel, Field
from auth import get_current_user, require_admin
from market_cache import get_prices, backfill_ticker
from analysis import compute_analysis, IndicatorConfig
from simulation import run_simulation
from options import compute_payoff, bs_call_price, mc_call_price
from regression import run_dolar_regression, get_dolar_defaults, run_acucar_regression, get_acucar_defaults
from atr import calibrate_atr, predict_atr, get_sector_defaults

# ── Ticker validation ─────────────────────────────────────────────────────────
ALLOWED_TICKER_RE = re.compile(r"^[A-Z0-9=.]{1,20}$")


def validate_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not ALLOWED_TICKER_RE.match(t):
        raise HTTPException(status_code=400, detail="Invalid ticker format")
    return t


app = FastAPI(
    title="Impacto API",
    version="2.0.0",
    docs_url=None if os.getenv("RAILWAY_ENVIRONMENT") else "/docs",
    redoc_url=None if os.getenv("RAILWAY_ENVIRONMENT") else "/redoc",
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# CORS — origins configured via env var; defaults to localhost for local dev
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Pydantic models ─────────────────────────────────────────────────────────────

class SimulationRequest(BaseModel):
    ticker: str
    preco_inicial: float
    dias_simulados: int = Field(default=252, ge=1, le=1000)
    num_simulacoes: int = Field(default=10_000, ge=1, le=100_000)
    pct_bound: float = Field(default=0.50, gt=0, le=2)
    label: str | None = None


class TickerSuggestRequest(BaseModel):
    ticker: str
    nome: str = ""        # human-readable name, optional
    tipo: Literal["commodity", "fx", "acao", "indice"] = "commodity"


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


class AtrSimulateBody(BaseModel):
    usina_id: str
    chuva_mm: float = Field(gt=0)
    impureza_pct: float = Field(gt=0, lt=100)
    volume_moagem: Optional[float] = Field(None, gt=0)


class AtrUsinaCreateBody(BaseModel):
    nome: str = Field(min_length=2, max_length=100)


class AtrShareBody(BaseModel):
    compartilhado: bool


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/focus")
@limiter.limit("20/minute")
async def get_focus(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """
    Returns latest BCB Focus report medians for IPCA, Câmbio, Selic, PIB Total
    for the current calendar year, plus the delta vs the reading from ~7 days ago.
    Falls back to None values if the BCB API is unavailable.
    """
    import asyncio
    from bcb import Expectativas

    current_year = str(date.today().year)
    today = date.today()
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


@app.get("/api/regression/dolar/defaults")
@limiter.limit("20/minute")
async def dolar_defaults(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """Returns latest BCB + FRED values to pre-fill the frontend inputs."""
    import asyncio
    loop = asyncio.get_event_loop()
    defaults = await loop.run_in_executor(None, get_dolar_defaults)
    return defaults


@app.post("/api/regression/dolar/run")
@limiter.limit("10/minute")
async def dolar_run(
    request: Request,
    body: DolarRegressionRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Trains OLS on BCB+FRED history, predicts taxa_dolar for user inputs,
    persists run to regression_runs, returns regression metrics.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        resultado = await loop.run_in_executor(None, run_dolar_regression, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("dolar_run error: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao executar regressão.")

    # Persist to Supabase
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    supa.table("regression_runs").insert({
        "user_id": user["id"],
        "tipo": "dolar",
        "inputs": body.model_dump(),
        "resultado": resultado,
    }).execute()

    return resultado


@app.get("/api/regression/acucar/defaults")
@limiter.limit("20/minute")
async def acucar_defaults(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """Returns latest yfinance prices + USDA defaults to pre-fill sugar regression inputs."""
    import asyncio
    loop = asyncio.get_event_loop()
    defaults = await loop.run_in_executor(None, get_acucar_defaults)
    return defaults


@app.post("/api/regression/acucar/run")
@limiter.limit("10/minute")
async def acucar_run(
    request: Request,
    body: AcucarRunRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Trains Ridge or XGBoost on annual yfinance+USDA data, predicts SB=F price,
    persists run to regression_runs, returns prediction with uncertainty range.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    inputs = body.model_dump(exclude={"model"})
    try:
        resultado = await loop.run_in_executor(
            None, lambda: run_acucar_regression(inputs, model_type=body.model)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    supa = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
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


@app.get("/api/regression/runs")
@limiter.limit("20/minute")
async def regression_runs_list(
    request: Request,
    tipo: str,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Returns the authenticated user's regression runs filtered by tipo."""
    if tipo not in ("dolar", "acucar"):
        raise HTTPException(status_code=400, detail="tipo must be 'dolar' or 'acucar'")
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
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


@app.get("/api/me")
async def me(user: Annotated[dict, Depends(get_current_user)]):
    """Returns current user info — verifies JWT is accepted for normal users."""
    return {"id": user["id"], "email": user["email"], "role": user["role"]}


@app.get("/api/admin/ping")
async def admin_ping(user: Annotated[dict, Depends(require_admin)]):
    """Admin-only route — verifies role enforcement."""
    return {"message": "admin ok", "user": user["email"]}


# ── Market data ─────────────────────────────────────────────────────────────────

@app.get("/api/market/prices")
@limiter.limit("30/minute")
async def market_prices(
    request: Request,
    ticker: str,
    start: date,
    end: date,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Return cached OHLCV rows for ticker in [start, end].
    MKT-01: second call returns from DB without calling yfinance.
    MKT-02: only uncached dates are fetched from yfinance.
    """
    ticker = validate_ticker(ticker)
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")
    rows = get_prices(ticker, start, end)
    return {"ticker": ticker, "start": start.isoformat(), "end": end.isoformat(), "rows": rows}


@app.get("/api/market/analysis")
@limiter.limit("20/minute")
async def market_analysis(
    request: Request,
    ticker: str,
    start: date,
    end: date,
    user: Annotated[dict, Depends(get_current_user)],
    indicators: str = "",
    rsi_period: int = 14,
    bb_window: int = 20,
    bb_std: float = 2.0,
    macd_fast: int = 12,
    macd_slow: int = 26,
    macd_signal: int = 9,
    stoch_k: int = 14,
    stoch_d: int = 3,
    cci_period: int = 20,
    sma_periods: str = "",
    ema_periods: str = "",
):
    """
    Return OHLCV + computed technical indicators + buy/sell signals.
    Data is fetched via market_cache (Supabase-backed, no duplicate yfinance calls).
    """
    import pandas as pd

    ticker = validate_ticker(ticker)
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")

    selected = [i.strip().lower() for i in indicators.split(",") if i.strip()]
    sma_list = [int(p.strip()) for p in sma_periods.split(",") if p.strip().isdigit()]
    ema_list = [int(p.strip()) for p in ema_periods.split(",") if p.strip().isdigit()]

    cfg = IndicatorConfig(
        indicators=selected,
        rsi_period=rsi_period,
        bb_window=bb_window,
        bb_std=bb_std,
        macd_fast=macd_fast,
        macd_slow=macd_slow,
        macd_signal=macd_signal,
        stoch_k=stoch_k,
        stoch_d=stoch_d,
        cci_period=cci_period,
        sma_periods=sma_list,
        ema_periods=ema_list,
    )

    raw_rows = get_prices(ticker, start, end)
    if not raw_rows:
        return {"ticker": ticker, "rows": [], "signals": []}

    df = pd.DataFrame(raw_rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    for col in ["open", "high", "low", "close", "volume"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    enriched, signals = compute_analysis(df, cfg)

    import json as _json

    enriched = enriched.reset_index()
    enriched["date"] = enriched["date"].dt.strftime("%Y-%m-%d")
    rows = _json.loads(enriched.to_json(orient="records"))

    return {"ticker": ticker, "rows": rows, "signals": signals}


@app.get("/api/market/status")
@limiter.limit("30/minute")
async def market_status(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Return current market state for a ticker (REGULAR, PRE, POST, CLOSED)."""
    ticker = validate_ticker(ticker)
    try:
        t = yf.Ticker(ticker, session=_yf_session)
        state = getattr(t.fast_info, "market_state", None) or "CLOSED"
    except Exception:
        state = "CLOSED"
    return {"ticker": ticker, "state": state, "open": state == "REGULAR"}


@app.post("/api/market/suggest")
@limiter.limit("10/minute")
async def suggest_ticker(
    request: Request,
    body: TickerSuggestRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    MKT-03: User suggests a new ticker.
    Validates ticker against yfinance BEFORE writing to DB.
    Returns 400 with visible error if ticker is invalid or has no data.
    On success inserts row into tickers_catalog with status='pending'.
    """
    ticker = validate_ticker(body.ticker)

    # Validate: attempt a minimal yfinance download (last 5 days)
    try:
        probe = yf.download(ticker, period="5d", progress=False, auto_adjust=True)
    except Exception as exc:
        logger.error("yfinance error for '%s': %s", ticker, exc)
        raise HTTPException(status_code=400, detail="Failed to fetch market data")

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
    limit: int = 50,
    offset: int = 0,
):
    """ADM-01: Return ticker suggestions. Optionally filter by status=pending|approved|rejected."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    query = client.table("tickers_catalog").select(
        "id,ticker,nome,tipo,status,backfill_status,review_note,adicionado_por,created_at"
    ).order("created_at", desc=False)
    if status:
        query = query.eq("status", status)
    query = query.range(offset, offset + limit - 1)
    result = query.execute()
    return {"suggestions": result.data}


class SuggestionReviewRequest(BaseModel):
    action: str          # "approve" | "reject"
    review_note: str = ""


@app.patch("/api/admin/suggestions/{suggestion_id}")
async def admin_review_suggestion(
    suggestion_id: UUID,
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
        .eq("id", str(suggestion_id))
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

    client.table("tickers_catalog").update(update_payload).eq("id", str(suggestion_id)).execute()

    return {"id": str(suggestion_id), "ticker": ticker, **update_payload}


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
    ticker = validate_ticker(ticker)
    result = backfill_ticker(ticker)

    # Update tickers_catalog backfill_status
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("tickers_catalog").update(
        {"backfill_status": "done"}
    ).eq("ticker", ticker.upper()).execute()

    return result


# ── Simulations ────────────────────────────────────────────────────────────────

@app.post("/api/simulations", status_code=201)
@limiter.limit("10/minute")
async def create_simulation(
    request: Request,
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
@limiter.limit("60/minute")
async def list_simulations(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
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
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"simulations": result.data}


@app.get("/api/simulations/{sim_id}")
@limiter.limit("60/minute")
async def get_simulation(
    request: Request,
    sim_id: UUID,
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
        .eq("id", str(sim_id))
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
    S: float = Field(gt=0, le=100_000)       # current underlying price
    K: float = Field(gt=0)                    # strike
    T: float = Field(gt=0, le=30)            # time to expiry in years
    r: float = Field(ge=0, le=5)             # risk-free rate (annualized)
    sigma: float = Field(gt=0, le=10)        # volatility (annualized)


class MCPriceRequest(BaseModel):
    S: float = Field(gt=0, le=100_000)
    K: float = Field(gt=0)
    T: float = Field(gt=0, le=30)
    r: float = Field(ge=0, le=5)
    sigma: float = Field(gt=0, le=10)
    num_simulacoes: int = Field(default=10_000, ge=1, le=100_000)


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


# ── User Parameters ────────────────────────────────────────────────────────────

class UserParamsRequest(BaseModel):
    volatilidade_custom: float | None = Field(default=None, ge=0, le=5)
    taxa_livre_risco: float | None = Field(default=None, ge=-0.5, le=1)
    pct_bound_preferido: float | None = Field(default=None, ge=0.05, le=2)


class WatchlistAddRequest(BaseModel):
    ticker: str


@app.get("/api/params/{ticker}")
@limiter.limit("60/minute")
async def get_params(
    request: Request,
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
@limiter.limit("30/minute")
async def upsert_params(
    request: Request,
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

    update_dict["updated_at"] = date.today().isoformat()

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("user_parameters").upsert(
        {"user_id": user["id"], "ticker": ticker.upper(), **update_dict},
        on_conflict="user_id,ticker",
    ).execute()

    return {"ticker": ticker.upper(), "saved": True}


# ── Watchlist ──────────────────────────────────────────────────────────────────

@app.get("/api/watchlist")
@limiter.limit("60/minute")
async def get_watchlist(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
    """PARAM-03: Return all tickers in the user's watchlist."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("watchlist")
        .select("ticker,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=False)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"tickers": [row["ticker"] for row in result.data]}


@app.post("/api/watchlist", status_code=201)
@limiter.limit("30/minute")
async def add_to_watchlist(
    request: Request,
    body: WatchlistAddRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """PARAM-03: Add a ticker to the user's watchlist (idempotent)."""
    ticker = validate_ticker(body.ticker)

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    client.table("watchlist").upsert(
        {"user_id": user["id"], "ticker": ticker},
        on_conflict="user_id,ticker",
        ignore_duplicates=True,
    ).execute()

    return {"ticker": ticker, "added": True}


@app.delete("/api/watchlist/{ticker}")
@limiter.limit("30/minute")
async def remove_from_watchlist(
    request: Request,
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
        "updated_at": date.today().isoformat(),
    }
    if body.description is not None:
        payload["description"] = body.description
    client.table("admin_config").upsert(payload, on_conflict="key").execute()
    return {"key": key, "value": body.value, "saved": True}


# ── ATR (Açúcar Total Recuperável) ────────────────────────────────────────────

@app.get("/api/atr/usinas")
@limiter.limit("30/minute")
async def atr_usinas_list(request: Request, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-02: Lista usinas associadas ao usuário autenticado."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = (
        supa.table("user_usinas")
        .select("usina_id, usinas(id, nome)")
        .eq("user_id", user["id"])
        .execute()
    ).data
    return {"usinas": [{"id": r["usinas"]["id"], "nome": r["usinas"]["nome"]} for r in rows]}


@app.post("/api/atr/simulate")
@limiter.limit("20/minute")
async def atr_simulate(request: Request, body: AtrSimulateBody, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-03: Simula ATR com IC 90% e persiste no Supabase."""
    import asyncio
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    # Verificar que usuário pertence à usina
    assoc = supa.table("user_usinas").select("usina_id").eq("user_id", user["id"]).eq("usina_id", body.usina_id).execute()
    if not assoc.data:
        raise HTTPException(status_code=403, detail="Usuário não associado a esta usina.")
    # Buscar simulações anteriores da usina como proxy para calibração
    hist_rows = (
        supa.table("atr_simulacoes")
        .select("chuva_mm, impureza_pct, atr_esperado")
        .eq("usina_id", body.usina_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    ).data
    history = [{"chuva_mm": r["chuva_mm"], "impureza_pct": r["impureza_pct"], "atr_real": r["atr_esperado"]} for r in hist_rows]
    loop = asyncio.get_running_loop()
    params = await loop.run_in_executor(None, calibrate_atr, history)
    result = await loop.run_in_executor(None, lambda: predict_atr(body.chuva_mm, body.impureza_pct, params, body.volume_moagem))
    # Persistir
    supa.table("atr_simulacoes").insert({
        "user_id": user["id"],
        "usina_id": body.usina_id,
        "chuva_mm": body.chuva_mm,
        "impureza_pct": body.impureza_pct,
        "atr_min": result["atr_min"],
        "atr_esperado": result["atr_esperado"],
        "atr_max": result["atr_max"],
        "producao_total": result.get("producao_total"),
        "compartilhado": False,
    }).execute()
    return result


@app.get("/api/atr/historico")
@limiter.limit("30/minute")
async def atr_historico(request: Request, usina_id: str, user: Annotated[dict, Depends(get_current_user)]):
    """ATR-04: Histórico de simulações do usuário para uma usina (próprias + compartilhadas da usina)."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    # Verificar que o usuário está associado à usina
    user_assoc = supa.table("user_usinas").select("usina_id").eq("user_id", user["id"]).execute().data
    user_usina_ids = {r["usina_id"] for r in user_assoc}
    if usina_id not in user_usina_ids:
        raise HTTPException(status_code=403, detail="Não autorizado para esta usina.")
    # Buscar todas as simulações da usina via service_role; filtrar por regra de negócio
    rows = (
        supa.table("atr_simulacoes")
        .select("id, user_id, chuva_mm, impureza_pct, atr_min, atr_esperado, atr_max, producao_total, compartilhado, created_at")
        .eq("usina_id", usina_id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    ).data
    visible = [r for r in rows if r["user_id"] == user["id"] or r["compartilhado"]]
    return {"historico": visible}


@app.patch("/api/atr/simulacoes/{sim_id}/compartilhar")
@limiter.limit("20/minute")
async def atr_compartilhar(request: Request, sim_id: str, body: AtrShareBody, user: Annotated[dict, Depends(get_current_user)]):
    """Publica ou despublica uma simulação ATR para outros membros da mesma usina."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = supa.table("atr_simulacoes").update({"compartilhado": body.compartilhado}).eq("id", sim_id).eq("user_id", user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Simulação não encontrada.")
    return {"ok": True}


# ── Admin — Usinas ──────────────────────────────────────────────────────────────

@app.get("/api/admin/usinas")
@limiter.limit("20/minute")
async def admin_usinas_list(request: Request, _: Annotated[dict, Depends(require_admin)]):
    """Admin: lista todas as usinas cadastradas."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = supa.table("usinas").select("id, nome, created_at").order("nome").execute().data
    return {"usinas": rows}


@app.post("/api/admin/usinas")
@limiter.limit("10/minute")
async def admin_usinas_create(request: Request, body: AtrUsinaCreateBody, _: Annotated[dict, Depends(require_admin)]):
    """Admin: cria uma nova usina."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    try:
        row = supa.table("usinas").insert({"nome": body.nome}).execute().data[0]
    except Exception:
        raise HTTPException(status_code=409, detail="Usina com este nome já existe.")
    return {"id": row["id"], "nome": row["nome"]}


@app.delete("/api/admin/usinas/{usina_id}")
@limiter.limit("10/minute")
async def admin_usinas_delete(request: Request, usina_id: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: deleta uma usina pelo ID."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    supa.table("usinas").delete().eq("id", usina_id).execute()
    return {"ok": True}


@app.post("/api/admin/usinas/{usina_id}/usuarios/{user_id_target}")
@limiter.limit("10/minute")
async def admin_usinas_add_user(request: Request, usina_id: str, user_id_target: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: associa um usuário a uma usina."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    try:
        supa.table("user_usinas").insert({"usina_id": usina_id, "user_id": user_id_target}).execute()
    except Exception:
        raise HTTPException(status_code=409, detail="Associação já existe.")
    return {"ok": True}


@app.delete("/api/admin/usinas/{usina_id}/usuarios/{user_id_target}")
@limiter.limit("10/minute")
async def admin_usinas_remove_user(request: Request, usina_id: str, user_id_target: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: remove associação de usuário com usina."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    supa.table("user_usinas").delete().eq("usina_id", usina_id).eq("user_id", user_id_target).execute()
    return {"ok": True}


@app.get("/api/admin/usuarios")
@limiter.limit("10/minute")
async def admin_usuarios_list(request: Request, _: Annotated[dict, Depends(require_admin)]):
    """Admin: lista todos os usuários cadastrados no Supabase Auth."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    users = supa.auth.admin.list_users()
    return {"usuarios": [{"id": u.id, "email": u.email} for u in users]}


@app.get("/api/admin/usinas/{usina_id}/usuarios")
@limiter.limit("20/minute")
async def admin_usinas_usuarios_list(request: Request, usina_id: str, _: Annotated[dict, Depends(require_admin)]):
    """Admin: lista IDs dos usuários associados a uma usina."""
    supa = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    rows = supa.table("user_usinas").select("user_id").eq("usina_id", usina_id).execute().data
    return {"user_ids": [r["user_id"] for r in rows]}


# ── VaR ────────────────────────────────────────────────────────────────────────

@app.get("/api/var")
@limiter.limit("10/minute")
async def get_var(
    request: Request,
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

    ticker = validate_ticker(ticker)
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
        "last_price": round(last_price, 4),
        "var_historico_abs": round(var_historico, 4),
        "var_historico_pct": round(var_historico / last_price, 6) if last_price else None,
        "var_parametrico_abs": round(var_parametrico, 4),
        "var_parametrico_pct": round(var_parametrico / last_price, 6) if last_price else None,
        "n_observations": len(returns),
    }


# ── Breakeven ──────────────────────────────────────────────────────────────────

@app.get("/api/breakeven")
@limiter.limit("30/minute")
async def get_breakeven(
    request: Request,
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
    today = date.today()
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


class BreakevenSaveRequest(BaseModel):
    preco_acucar_cents_lb: float = Field(gt=0)
    preco_dolar_brl: float = Field(gt=0)
    fator_conversao: float = Field(gt=0)
    label: str | None = None


@app.post("/api/breakeven/save", status_code=201)
@limiter.limit("30/minute")
async def save_breakeven(
    request: Request,
    body: BreakevenSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Save a manual breakeven simulation for the authenticated user."""
    breakeven = round(body.preco_acucar_cents_lb * body.fator_conversao * body.preco_dolar_brl, 4)
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    saved = client.table("breakeven_simulations").insert({
        "user_id": user["id"],
        "preco_acucar_cents_lb": body.preco_acucar_cents_lb,
        "preco_dolar_brl": body.preco_dolar_brl,
        "fator_conversao": body.fator_conversao,
        "breakeven_brl_saca": breakeven,
        "label": body.label or None,
    }).execute()
    row = saved.data[0]
    return {**row, "breakeven_brl_saca": breakeven}


@app.get("/api/breakeven/history")
@limiter.limit("60/minute")
async def list_breakeven_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
    """List saved breakeven simulations for the authenticated user."""
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("breakeven_simulations")
        .select("id,preco_acucar_cents_lb,preco_dolar_brl,fator_conversao,breakeven_brl_saca,label,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"simulations": result.data}


# ── Risco history ──────────────────────────────────────────────────────────────

class RiscoSaveRequest(BaseModel):
    inputs: dict
    fat_media: float
    custo_media: float
    ebitda_media: float
    results: dict
    label: str | None = None


@app.post("/api/risco/save", status_code=201)
@limiter.limit("30/minute")
async def save_risco(
    request: Request,
    body: RiscoSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    saved = client.table("risco_simulations").insert({
        "user_id": user["id"],
        "inputs": body.inputs,
        "fat_media": body.fat_media,
        "custo_media": body.custo_media,
        "ebitda_media": body.ebitda_media,
        "results": body.results,
        "label": body.label or None,
    }).execute()
    return saved.data[0]


@app.get("/api/risco/history")
@limiter.limit("60/minute")
async def list_risco_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
):
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("risco_simulations")
        .select("id,fat_media,custo_media,ebitda_media,label,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(0, limit - 1)
        .execute()
    )
    return {"simulations": result.data}


# ── Cenários history ───────────────────────────────────────────────────────────

class CenariosSaveRequest(BaseModel):
    opcao: str
    ny: float | None = None
    moagem: float | None = None
    cambio: float | None = None
    preco_etanol: float | None = None
    breakeven: float
    probabilidade_abaixo: float
    media: float
    std: float
    label: str | None = None


@app.post("/api/cenarios/save", status_code=201)
@limiter.limit("30/minute")
async def save_cenario(
    request: Request,
    body: CenariosSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    saved = client.table("cenarios_simulations").insert({
        "user_id": user["id"],
        **body.model_dump(exclude={"label"}),
        "label": body.label or None,
    }).execute()
    return saved.data[0]


@app.get("/api/cenarios/history")
@limiter.limit("60/minute")
async def list_cenarios_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
):
    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    result = (
        client.table("cenarios_simulations")
        .select("id,opcao,breakeven,probabilidade_abaixo,media,label,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(0, limit - 1)
        .execute()
    )
    return {"simulations": result.data}


# ── ARIMA ──────────────────────────────────────────────────────────────────────

@app.get("/api/arima/{ticker}")
@limiter.limit("10/minute")
async def get_arima(
    request: Request,
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

    ticker = validate_ticker(ticker)
    if steps < 1 or steps > 365:
        raise HTTPException(status_code=400, detail="steps must be between 1 and 365")

    data = yf.download(ticker, period="2y", progress=False, auto_adjust=True)
    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].squeeze().dropna()

    try:
        model = ARIMA(closes, order=(1, 1, 1))
        fit = model.fit()
        forecast_result = fit.get_forecast(steps=steps)
        forecast_mean = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=0.05)
    except Exception as exc:
        logger.error("ARIMA fitting failed for '%s': %s", ticker, exc)
        raise HTTPException(status_code=400, detail="ARIMA model fitting failed. Try a different ticker or period.")

    last_date = closes.index[-1]
    forecast_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=steps, freq="B")

    # Historical points — last 90 days for chart context
    history = closes.iloc[-90:]
    series = [
        {"date": dt.strftime("%Y-%m-%d"), "value": round(float(v), 4)}
        for dt, v in history.items()
    ]

    # Forecast points
    for i, dt in enumerate(forecast_dates):
        date_str = dt.strftime("%Y-%m-%d")
        series.append({
            "date": date_str,
            "forecast": round(float(forecast_mean.iloc[i]), 4),
            "ci_lower": round(float(conf_int.iloc[i, 0]), 4),
            "ci_upper": round(float(conf_int.iloc[i, 1]), 4),
        })

    return {
        "ticker": ticker,
        "steps": steps,
        "series": series,
    }


# ── Stress Test ────────────────────────────────────────────────────────────────

@app.get("/api/stress")
@limiter.limit("10/minute")
async def get_stress(
    request: Request,
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

    ticker = validate_ticker(ticker)
    data = yf.download(ticker, period="max", progress=False, auto_adjust=True)
    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].squeeze().dropna()
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

    def to_scenario(d: dict, name: str) -> dict:
        return {
            "cenario": name,
            "periodo_inicio": d.get("start") or "N/A",
            "periodo_fim": d.get("end") or "N/A",
            "drawdown_pct": round((d.get("drawdown_pct") or 0) / 100, 4),
            "preco_final": d.get("last_price_after") or 0.0,
        }

    return [
        to_scenario(worst_dd, "Pior drawdown histórico"),
        to_scenario(crisis_2008, "Crise 2008"),
        to_scenario(covid, "COVID 2020"),
    ]


# ── News ───────────────────────────────────────────────────────────────────────

import time as _time

_news_cache: dict = {"ts": 0.0, "items": []}
_NEWS_TTL = 1800  # 30 minutes


@app.get("/api/news")
@limiter.limit("20/minute")
async def get_news(
    request: Request,
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
        logger.error("Failed to fetch news: %s", exc)
        if _news_cache["items"]:
            return {"items": _news_cache["items"], "cached": True, "warning": "News fetch failed, showing cached data"}
        raise HTTPException(status_code=503, detail="Failed to fetch news")

    return {"items": items, "cached": False}


# ── Volatility ─────────────────────────────────────────────────────────────────

@app.get("/api/volatility")
@limiter.limit("10/minute")
async def get_volatility(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """
    Compute realized volatility at 30d, 90d and 1y horizons (annualized).

    Also returns rolling 30d volatility history for chart rendering.
    """
    import numpy as np
    import pandas as pd

    ticker = validate_ticker(ticker)
    data = yf.download(ticker, period="1y", progress=False, auto_adjust=True)
    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].squeeze().dropna()
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

    rolling_30d_list = [
        {"date": h["date"], "vol": h["vol_30d_rolling"]}
        for h in history
    ]

    return {
        "ticker": ticker,
        "vol_30d": round(vol_30d, 6) if vol_30d is not None else None,
        "vol_90d": round(vol_90d, 6) if vol_90d is not None else None,
        "vol_1y": round(vol_1y, 6),
        "last_price": round(last_price, 4),
        "rolling_30d": rolling_30d_list,
    }


# ── Metas ──────────────────────────────────────────────────────────────────────

@app.get("/api/metas")
@limiter.limit("20/minute")
async def get_metas(
    request: Request,
    meta: float = 2600,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """MTM history and heatmap data for sugar price targets."""
    FATOR = 22.0462 * 1.04
    end = date.today()
    start = date(2013, 1, 1)

    sugar_rows = get_prices("SB=F", start, end)
    fx_rows = get_prices("USDBRL=X", start, end)

    if len(sugar_rows) < 10 or len(fx_rows) < 10:
        raise HTTPException(status_code=503, detail="Dados insuficientes.")

    sugar_map = {r["date"]: r["close"] for r in sugar_rows if r["close"]}
    fx_map = {r["date"]: r["close"] for r in fx_rows if r["close"]}
    common_dates = sorted(set(sugar_map) & set(fx_map))

    mtm_series = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "mtm": round(FATOR * sugar_map[d] * fx_map[d], 2),
            "meta": meta,
        }
        for d in common_dates
    ]

    acucares = [round(24 - 0.5 * i, 2) for i in range(11)]
    dolares = [round(4.8 + 0.05 * i, 2) for i in range(10)]
    heatmap = [[round(FATOR * a * d - meta, 2) for d in dolares] for a in acucares]

    return {
        "meta": meta,
        "mtm_series": mtm_series,
        "heatmap": heatmap,
        "acucares": acucares,
        "dolares": dolares,
    }


# ── Jump Diffusion ─────────────────────────────────────────────────────────────

class JumpDiffusionRequest(BaseModel):
    ticker: str = "SB=F"
    sigma: float | None = None
    lambda_jumps: float = Field(default=0.1, ge=0, le=5)
    mu_jump: float = Field(default=-0.02, ge=-1, le=1)
    sigma_jump: float = Field(default=0.05, ge=0, le=1)
    steps: int = Field(default=252, ge=10, le=1260)


@app.post("/api/jump-diffusion")
@limiter.limit("15/minute")
async def jump_diffusion(
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

    if len(rows) < 20:
        raise HTTPException(status_code=400, detail="Dados históricos insuficientes.")

    closes = np.array([r["close"] for r in rows if r["close"]], dtype=float)
    log_returns = np.diff(np.log(closes))
    mu = float(np.mean(log_returns))
    sigma = float(body.sigma) if body.sigma is not None else float(np.std(log_returns, ddof=1))
    s0 = float(closes[-1])

    dt = 1.0 / body.steps
    rng = np.random.default_rng()
    prices = [s0]
    for _ in range(body.steps):
        n_jumps = int(rng.poisson(body.lambda_jumps * dt))
        jump_mag = float(np.sum(rng.normal(body.mu_jump, body.sigma_jump, n_jumps))) if n_jumps > 0 else 0.0
        diffusion = (mu - 0.5 * sigma ** 2) * dt + sigma * float(rng.normal()) * (dt ** 0.5)
        prices.append(prices[-1] * float(np.exp(diffusion + jump_mag)))

    return {
        "ticker": ticker,
        "s0": round(s0, 4),
        "sigma": round(sigma, 6),
        "mu": round(mu, 6),
        "prices": [{"step": i, "price": round(p, 4)} for i, p in enumerate(prices)],
        "mean": round(float(np.mean(prices)), 4),
    }


# ── Risco ──────────────────────────────────────────────────────────────────────

class VariavelRisco(BaseModel):
    media: float
    p15: float
    p85: float


class RiscoRequest(BaseModel):
    moagem: VariavelRisco = VariavelRisco(media=1300000, p15=1100000, p85=1500000)
    atr: VariavelRisco = VariavelRisco(media=125, p15=120, p85=130)
    vhp_total: VariavelRisco = VariavelRisco(media=97000, p15=94000, p85=100000)
    ny: VariavelRisco = VariavelRisco(media=21, p15=18, p85=24)
    cambio: VariavelRisco = VariavelRisco(media=5.1, p15=4.9, p85=5.3)
    preco_cbios: VariavelRisco = VariavelRisco(media=90, p15=75, p85=105)
    preco_etanol: VariavelRisco = VariavelRisco(media=3000, p15=2500, p85=3500)
    num_simulacoes: int = Field(default=10000, ge=1000, le=50000)


@app.post("/api/risco")
@limiter.limit("10/minute")
async def simular_risco(
    request: Request,
    body: RiscoRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Monte Carlo simulation of revenue, cost and EBITDA."""
    import numpy as np
    from scipy.stats import norm as _norm

    def _std(v: VariavelRisco) -> float:
        return (v.p85 - v.p15) / (2 * _norm.ppf(0.85))

    rng = np.random.default_rng()
    n = body.num_simulacoes

    def _s(v: VariavelRisco) -> np.ndarray:
        return rng.normal(v.media, _std(v), n)

    moagem = _s(body.moagem)
    atr = _s(body.atr)
    vhp = _s(body.vhp_total)
    ny = _s(body.ny)
    cambio = _s(body.cambio)
    cbios = _s(body.preco_cbios)
    etanol = _s(body.preco_etanol)

    fat = ((ny - 0.19) * 22.0462 * 1.04 * cambio) * vhp + 17283303 + etanol * 35524 + 24479549 + cbios * 31616
    atr_mtm = 0.6 * (fat - cbios) / (moagem * atr)
    custo = 109212811 + 32947347 + atr_mtm * moagem * atr
    ebitda = fat - custo + 7219092

    pcts = [1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 99]

    def _summarize(arr: np.ndarray) -> dict:
        return {
            "media": round(float(np.mean(arr)), 2),
            "percentis": [{"p": p, "v": round(float(np.percentile(arr, p)), 2)} for p in pcts],
        }

    return {
        "faturamento": _summarize(fat),
        "custo": _summarize(custo),
        "ebitda": _summarize(ebitda),
    }


# ── Cenários ──────────────────────────────────────────────────────────────────

class CenariosRequest(BaseModel):
    opcao: Literal["Moagem", "Câmbio", "NY", "Preço Etanol"]
    ny: float = 20.0
    moagem: float = 1300000.0
    cambio: float = 5.25
    preco_etanol: float = 2768.90


@app.post("/api/cenarios")
@limiter.limit("20/minute")
async def simular_cenarios(
    request: Request,
    body: CenariosRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Breakeven analysis + probability distribution for operational variables."""
    import numpy as np
    from scipy.stats import norm as _norm

    def _ebitda(moagem: float, cambio: float, preco_etanol: float, ny: float) -> float:
        vhp = (89.45 * 0.8346 * moagem) / 1000
        eth = (0.1654 * 80.18 * moagem + 327.19 * 60075) / 1000
        fat = (
            (vhp - 4047) * (ny - 0.19) * 22.0462 * 1.04 * cambio
            + (eth - 1000) * (preco_etanol + 349.83) * 0.96
            + 3227430 + 22061958
            + 12000 * (ny + 1) * 22.0462 * 0.75 * cambio
        )
        custo = 0.6 * 0.93 * (
            (vhp - 4047) * (ny - 0.19) * 22.0462 * 1.04 * cambio
            + (eth - 1000) * (preco_etanol + 349.83) * 0.96
            + 12000 * (ny + 1) * 22.0462 * 0.75 * cambio
        ) + 88704735 + 43732035 + 20286465
        return fat - custo

    step_map = {"Moagem": 1000.0, "Câmbio": 0.01, "NY": 0.01, "Preço Etanol": 0.01}
    step = step_map[body.opcao]
    ny, moagem, cambio, preco_etanol = body.ny, body.moagem, body.cambio, body.preco_etanol

    for _ in range(100000):
        if _ebitda(moagem, cambio, preco_etanol, ny) > 0:
            break
        if body.opcao == "Moagem":
            moagem += step
        elif body.opcao == "Câmbio":
            cambio += step
        elif body.opcao == "NY":
            ny += step
        else:
            preco_etanol += step

    breakeven = {"Moagem": moagem, "Câmbio": cambio, "NY": ny, "Preço Etanol": preco_etanol}[body.opcao]

    dist_params: dict[str, dict] = {
        "Moagem":       {"media": 1300000.0, "p80": 1400000.0},
        "Câmbio":       {"media": 5.2504,    "p80": 5.4293},
        "NY":           {"media": 20.5572,   "p80": 22.3796},
        "Preço Etanol": {"media": 2768.90,   "p80": 3000.28},
    }
    dp = dist_params[body.opcao]
    std = (dp["p80"] - dp["media"]) / _norm.ppf(0.8)
    media = dp["media"]

    prob = float(_norm.cdf(breakeven, loc=media, scale=std))
    pcts = list(range(5, 100, 5))
    percentis = [{"p": p, "v": round(float(_norm.ppf(p / 100, loc=media, scale=std)), 4)} for p in pcts]
    x_vals = np.linspace(media - 3 * std, media + 3 * std, 200)
    distribuicao = [{"x": round(float(xi), 4), "y": round(float(_norm.pdf(xi, loc=media, scale=std)), 8)} for xi in x_vals]

    return {
        "opcao": body.opcao,
        "breakeven": round(breakeven, 4),
        "probabilidade_abaixo": round(prob, 4),
        "media": round(media, 4),
        "std": round(std, 4),
        "percentis": percentis,
        "distribuicao": distribuicao,
    }
