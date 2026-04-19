import logging
import os
import time as _time
from typing import Annotated, Literal
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from supabase import create_client
from auth import get_current_user
from market_cache import get_prices
from routers.shared import limiter, validate_ticker, make_yf_session

logger = logging.getLogger(__name__)
router = APIRouter()

_yf_session = make_yf_session()

# TTL caches
_var_cache: dict = {}        # key: f"{ticker}_{confidence}_{horizon}"
_VAR_TTL = 60                # 1 minute — VaR changes with market
_breakeven_cache: dict = {"ts": 0.0, "data": None}
_BREAKEVEN_TTL = 300         # 5 minutes


# ── VaR ────────────────────────────────────────────────────────────────────────

@router.get("/api/var")
@limiter.limit("10/minute")
async def get_var(
    request: Request,
    ticker: str = "SB=F",
    confidence: float = 0.95,
    horizon: int = 1,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    from scipy.stats import norm
    import numpy as np
    import asyncio

    ticker = validate_ticker(ticker)
    if not (0 < confidence < 1):
        raise HTTPException(status_code=400, detail="confidence must be between 0 and 1")
    if horizon < 1:
        raise HTTPException(status_code=400, detail="horizon must be >= 1")

    cache_key = f"{ticker}_{confidence}_{horizon}"
    now = _time.time()
    if cache_key in _var_cache and now - _var_cache[cache_key]["ts"] < _VAR_TTL:
        return _var_cache[cache_key]["data"]

    import yfinance as yf

    def _fetch():
        return yf.download(ticker, period="1y", progress=False, auto_adjust=True, session=_yf_session)

    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, _fetch)

    if data.empty or len(data) < 10:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].dropna().values.flatten()
    returns = np.diff(closes) / closes[:-1]
    last_price = float(closes[-1])

    var_historico = float(np.percentile(returns, (1 - confidence) * 100) * last_price * (horizon ** 0.5))
    mu = float(np.mean(returns))
    sigma = float(np.std(returns, ddof=1))
    var_parametrico = float(norm.ppf(1 - confidence) * sigma * last_price * (horizon ** 0.5))

    result = {
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
    _var_cache[cache_key] = {"ts": now, "data": result}
    return result


# ── Breakeven ──────────────────────────────────────────────────────────────────

@router.get("/api/breakeven")
@limiter.limit("30/minute")
async def get_breakeven(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    now = _time.time()
    if now - _breakeven_cache["ts"] < _BREAKEVEN_TTL and _breakeven_cache["data"] is not None:
        return _breakeven_cache["data"]

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    config_row = (
        client.table("admin_config")
        .select("value")
        .eq("key", "breakeven_fator_conversao")
        .limit(1)
        .execute()
    )
    fator_conversao = float((config_row.data[0] if config_row.data else {}).get("value", "1.12045"))

    today = date.today()
    start = today - timedelta(days=7)
    sugar_rows = get_prices("SB=F", start, today)
    usd_rows = get_prices("USDBRL=X", start, today)

    if not sugar_rows or not usd_rows:
        raise HTTPException(status_code=503, detail="Could not fetch live prices — backfill needed")

    preco_acucar_cents = float(sugar_rows[-1]["close"])
    preco_dolar = float(usd_rows[-1]["close"])
    breakeven_reais_saca = preco_acucar_cents * fator_conversao * preco_dolar

    result = {
        "preco_acucar_cents_lb": round(preco_acucar_cents, 4),
        "preco_dolar_brl": round(preco_dolar, 4),
        "fator_conversao": fator_conversao,
        "breakeven_brl_saca": round(breakeven_reais_saca, 2),
    }
    _breakeven_cache["ts"] = now
    _breakeven_cache["data"] = result
    return result


class BreakevenSaveRequest(BaseModel):
    preco_acucar_cents_lb: float = Field(gt=0)
    preco_dolar_brl: float = Field(gt=0)
    fator_conversao: float = Field(gt=0)
    label: str | None = None


@router.post("/api/breakeven/save", status_code=201)
@limiter.limit("30/minute")
async def save_breakeven(
    request: Request,
    body: BreakevenSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
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


@router.get("/api/breakeven/history")
@limiter.limit("60/minute")
async def list_breakeven_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
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


# ── Stress Test ────────────────────────────────────────────────────────────────

@router.get("/api/stress")
@limiter.limit("10/minute")
async def get_stress(
    request: Request,
    ticker: str = "SB=F",
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    import numpy as np
    import pandas as pd
    import asyncio
    import yfinance as yf

    ticker = validate_ticker(ticker)

    def _fetch():
        return yf.download(ticker, period="max", progress=False, auto_adjust=True, session=_yf_session)

    loop = asyncio.get_running_loop()
    data = await loop.run_in_executor(None, _fetch)

    if data.empty or len(data) < 30:
        raise HTTPException(status_code=400, detail=f"Insufficient data for ticker '{ticker}'")

    closes = data["Close"].squeeze().dropna()
    last_price = float(closes.iloc[-1])

    def compute_drawdown_window(series: "pd.Series") -> dict:
        if series.empty:
            return {"start": None, "end": None, "drawdown_pct": None, "last_price_after": None}
        roll_max = series.cummax()
        drawdown = (series - roll_max) / roll_max
        worst_idx = int(drawdown.argmin())
        worst_val = float(drawdown.iloc[worst_idx])
        peak_idx = int(series.iloc[: worst_idx + 1].argmax())
        start_date = series.index[peak_idx].strftime("%Y-%m-%d")
        end_date = series.index[worst_idx].strftime("%Y-%m-%d")
        return {
            "start": start_date,
            "end": end_date,
            "drawdown_pct": round(worst_val * 100, 2),
            "last_price_after": round(float(series.iloc[worst_idx]), 4),
        }

    worst_dd = compute_drawdown_window(closes)
    try:
        crisis_2008_series = closes.loc["2008-08-01":"2009-03-31"]
    except Exception:
        crisis_2008_series = pd.Series(dtype=float)
    crisis_2008 = compute_drawdown_window(crisis_2008_series)
    crisis_2008["name"] = "Crise 2008"

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


class RiscoSaveRequest(BaseModel):
    inputs: dict
    fat_media: float
    custo_media: float
    ebitda_media: float
    results: dict
    label: str | None = None


@router.post("/api/risco")
@limiter.limit("10/minute")
async def simular_risco(
    request: Request,
    body: RiscoRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
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


@router.post("/api/risco/save", status_code=201)
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


@router.get("/api/risco/history")
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


# ── Cenários ───────────────────────────────────────────────────────────────────

class CenariosRequest(BaseModel):
    opcao: Literal["Moagem", "Câmbio", "NY", "Preço Etanol"]
    ny: float = 20.0
    moagem: float = 1300000.0
    cambio: float = 5.25
    preco_etanol: float = 2768.90


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


@router.post("/api/cenarios")
@limiter.limit("20/minute")
async def simular_cenarios(
    request: Request,
    body: CenariosRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
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


@router.post("/api/cenarios/save", status_code=201)
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


@router.get("/api/cenarios/history")
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
