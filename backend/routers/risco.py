"""Risco e cenários: breakeven, simulação de risco do EBITDA, cenários de safra, metas (MTM) e históricos salvos por usuário."""

import json
import os
from datetime import date, timedelta
from typing import Annotated, Literal
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from auth import get_current_user
from market_cache import get_prices, supa_client
from validacao import _validar_paginacao
from constantes import _ler_constantes
from limiter import limiter
from fastapi import APIRouter


router = APIRouter()

# ── Pydantic models ─────────────────────────────────────────────────────────────

OpcaoCenario = Literal["Moagem", "Câmbio", "NY", "Preço Etanol"]


MAX_JSON_BYTES = 64_000  # teto para JSON livre (inputs/results do Risco)


def _limitar_json(valor: dict) -> dict:
    if len(json.dumps(valor, ensure_ascii=False, default=str)) > MAX_JSON_BYTES:
        raise ValueError(f"Os dados enviados passam de {MAX_JSON_BYTES // 1000} KB.")
    return valor


# ── Breakeven ──────────────────────────────────────────────────────────────────

@router.get("/api/breakeven")
@limiter.limit("30/minute")
def get_breakeven(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
):
    """
    Compute sugar breakeven in BRL/saca.

    breakeven_reais_saca = preco_acucar_cents * fator_conversao * preco_dolar

    fator_conversao is stored in admin_config and defaults to 1.12045 if not found.
    """
    fator_conversao = _ler_constantes("breakeven_fator_conversao")["breakeven_fator_conversao"]

    # Latest prices from the cache; fechamentos nulos não contam
    today = date.today()
    start = today - timedelta(days=7)
    sugar_rows = [r for r in get_prices("SB=F", start, today) if r["close"] is not None]
    usd_rows = [r for r in get_prices("USDBRL=X", start, today) if r["close"] is not None]

    if not sugar_rows or not usd_rows:
        raise HTTPException(status_code=503, detail="Não foi possível obter os preços atuais de açúcar e dólar. Tente novamente em alguns minutos.")

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


@router.post("/api/breakeven/save", status_code=201)
@limiter.limit("30/minute")
def save_breakeven(
    request: Request,
    body: BreakevenSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    """Save a manual breakeven simulation for the authenticated user."""
    breakeven = round(body.preco_acucar_cents_lb * body.fator_conversao * body.preco_dolar_brl, 4)
    client = supa_client()
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
def list_breakeven_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
    offset: int = 0,
):
    """List saved breakeven simulations for the authenticated user."""
    _validar_paginacao(limit, offset)
    client = supa_client()
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

    @field_validator("inputs", "results")
    @classmethod
    def _tamanho_json(cls, valor: dict) -> dict:
        return _limitar_json(valor)


@router.post("/api/risco/save", status_code=201)
@limiter.limit("30/minute")
def save_risco(
    request: Request,
    body: RiscoSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = supa_client()
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
def list_risco_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
):
    _validar_paginacao(limit, 0)
    client = supa_client()
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
    opcao: OpcaoCenario
    ny: float | None = None
    moagem: float | None = None
    cambio: float | None = None
    preco_etanol: float | None = None
    breakeven: float
    probabilidade_abaixo: float
    media: float
    std: float
    label: str | None = None


@router.post("/api/cenarios/save", status_code=201)
@limiter.limit("30/minute")
def save_cenario(
    request: Request,
    body: CenariosSaveRequest,
    user: Annotated[dict, Depends(get_current_user)],
):
    client = supa_client()
    saved = client.table("cenarios_simulations").insert({
        "user_id": user["id"],
        **body.model_dump(exclude={"label"}),
        "label": body.label or None,
    }).execute()
    return saved.data[0]


@router.get("/api/cenarios/history")
@limiter.limit("60/minute")
def list_cenarios_history(
    request: Request,
    user: Annotated[dict, Depends(get_current_user)],
    limit: int = 50,
):
    _validar_paginacao(limit, 0)
    client = supa_client()
    result = (
        client.table("cenarios_simulations")
        .select("id,opcao,breakeven,probabilidade_abaixo,media,label,created_at")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .range(0, limit - 1)
        .execute()
    )
    return {"simulations": result.data}


# ── Metas ──────────────────────────────────────────────────────────────────────

@router.get("/api/metas")
@limiter.limit("20/minute")
def get_metas(
    request: Request,
    meta: float = 2600,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """MTM history and heatmap data for sugar price targets."""
    fator = _ler_constantes("fator_conversao_mtm")["fator_conversao_mtm"]
    end = date.today()
    start = date(2013, 1, 1)

    # Fechamentos nulos não contam
    sugar_rows = [r for r in get_prices("SB=F", start, end) if r["close"] is not None]
    fx_rows = [r for r in get_prices("USDBRL=X", start, end) if r["close"] is not None]

    if len(sugar_rows) < 10 or len(fx_rows) < 10 or not any(r["close"] for r in fx_rows):
        raise HTTPException(status_code=503, detail="Dados insuficientes.")

    # HARD-05: o mapa é centrado no último fechamento de cada preço
    limite = (end - timedelta(days=7)).isoformat()
    if str(sugar_rows[-1]["date"])[:10] < limite or str(fx_rows[-1]["date"])[:10] < limite:
        raise HTTPException(status_code=503, detail="Sem preços recentes para montar o mapa de metas.")
    spot_acucar = float(sugar_rows[-1]["close"])
    spot_dolar = float(fx_rows[-1]["close"])

    sugar_map = {r["date"]: r["close"] for r in sugar_rows}
    fx_map = {r["date"]: r["close"] for r in fx_rows}
    common_dates = sorted(set(sugar_map) & set(fx_map))

    mtm_series = [
        {
            "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
            "mtm": round(fator * sugar_map[d] * fx_map[d], 2),
            "meta": meta,
        }
        for d in common_dates
    ]

    # Açúcar: ±25% em passos de 5% (linhas, do maior para o menor).
    # Dólar: ±10% em passos de 2% (colunas, crescente). Centro = índice 5 nos dois eixos.
    acucares = [round(spot_acucar * (1 + 0.05 * k), 2) for k in range(5, -6, -1)]
    dolares = [round(spot_dolar * (1 + 0.02 * k), 2) for k in range(-5, 6)]
    heatmap = [[round(fator * a * d - meta, 2) for d in dolares] for a in acucares]

    return {
        "meta": meta,
        "mtm_series": mtm_series,
        "heatmap": heatmap,
        "acucares": acucares,
        "dolares": dolares,
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


ROTULOS_RISCO = {
    "moagem": "Moagem", "atr": "ATR", "vhp_total": "VHP total", "ny": "NY",
    "cambio": "Câmbio", "preco_cbios": "Preço do CBIO", "preco_etanol": "Preço do etanol",
}


@router.post("/api/risco")
@limiter.limit("10/minute")
def simular_risco(
    request: Request,
    body: RiscoRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Monte Carlo simulation of revenue, cost and EBITDA."""
    import numpy as np
    from scipy.stats import norm as _norm

    for nome, v in [(k, getattr(body, k)) for k in ROTULOS_RISCO]:
        if not (v.p15 < v.media < v.p85):
            raise HTTPException(status_code=422, detail=f"{ROTULOS_RISCO[nome]}: é preciso P15 < média < P85.")

    cfg = _ler_constantes("fator_conversao_mtm", "risco_custo_fixo_1", "risco_custo_fixo_2")

    def _std(v: VariavelRisco) -> float:
        return (v.p85 - v.p15) / (2 * _norm.ppf(0.85))

    rng = np.random.default_rng()
    n = body.num_simulacoes

    def _s(v: VariavelRisco) -> np.ndarray:
        return rng.normal(v.media, _std(v), n)

    # NY não pode ser negativo (trunca em zero). Moagem e ATR não entram: na fórmula de custo
    # moagem × ATR × atr_mtm = 0,6 × (faturamento − CBIO), então se cancelam.
    ny = np.maximum(_s(body.ny), 0.0)
    vhp = _s(body.vhp_total)
    cambio = _s(body.cambio)
    cbios = _s(body.preco_cbios)
    etanol = _s(body.preco_etanol)

    fat = ((ny - 0.19) * cfg["fator_conversao_mtm"] * cambio) * vhp + 17283303 + etanol * 35524 + 24479549 + cbios * 31616
    custo = cfg["risco_custo_fixo_1"] + cfg["risco_custo_fixo_2"] + 0.6 * (fat - cbios)
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
    opcao: OpcaoCenario
    ny: float = 20.0
    moagem: float = 1300000.0
    cambio: float = 5.25
    preco_etanol: float = 2768.90


@router.post("/api/cenarios")
@limiter.limit("20/minute")
def simular_cenarios(
    request: Request,
    body: CenariosRequest,
    user: Annotated[dict, Depends(get_current_user)] = None,
):
    """Breakeven analysis + probability distribution for operational variables."""
    import numpy as np
    from scipy.stats import norm as _norm

    cfg = _ler_constantes(
        "fator_conversao_mtm", "cenarios_custo_fixo_1", "cenarios_custo_fixo_2", "cenarios_custo_fixo_3",
    )
    fator = cfg["fator_conversao_mtm"]
    custo_fixo = cfg["cenarios_custo_fixo_1"] + cfg["cenarios_custo_fixo_2"] + cfg["cenarios_custo_fixo_3"]

    def _ebitda(moagem: float, cambio: float, preco_etanol: float, ny: float) -> float:
        vhp = (89.45 * 0.8346 * moagem) / 1000
        eth = (0.1654 * 80.18 * moagem + 327.19 * 60075) / 1000
        fat = (
            (vhp - 4047) * (ny - 0.19) * fator * cambio
            + (eth - 1000) * (preco_etanol + 349.83) * 0.96
            + 3227430 + 22061958
            + 12000 * (ny + 1) * 22.0462 * 0.75 * cambio
        )
        custo = 0.6 * 0.93 * (
            (vhp - 4047) * (ny - 0.19) * fator * cambio
            + (eth - 1000) * (preco_etanol + 349.83) * 0.96
            + 12000 * (ny + 1) * 22.0462 * 0.75 * cambio
        ) + custo_fixo
        return fat - custo

    from scipy.optimize import brentq

    # EBITDA is increasing in every variable, so the breakeven is the unique root.
    # The old upward step-search returned the input itself whenever EBITDA was
    # already positive (true for the defaults), so it never found the real breakeven.
    base = {"moagem": body.moagem, "cambio": body.cambio, "preco_etanol": body.preco_etanol, "ny": body.ny}
    key = {"Moagem": "moagem", "Câmbio": "cambio", "NY": "ny", "Preço Etanol": "preco_etanol"}[body.opcao]

    def f(x: float) -> float:
        return _ebitda(**{**base, key: x})

    try:
        # O front envia 0 na variável analisada; a escala do intervalo vem do valor típico (default do modelo).
        escala = max(base[key], CenariosRequest.model_fields[key].default)
        breakeven = brentq(f, 1e-6, escala * 100)
    except ValueError:
        raise HTTPException(status_code=422, detail="Sem breakeven no intervalo para esses parâmetros.")

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
