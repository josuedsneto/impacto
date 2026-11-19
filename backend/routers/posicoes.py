"""Posições de fixação e política de hedge por usina e safra (posicoes-fixacoes)."""
from datetime import date, timedelta
from typing import Annotated, Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError

import market_cache
from auth import get_current_user
from limiter import limiter
from market_cache import get_prices

router = APIRouter(prefix="/api")

# ponytail: mesma convenção do MTM de metas (main.py). Se backend-robustez mover para admin_config, trocar aqui.
FATOR = 22.0462 * 1.04  # ¢/lb × 22,0462 = US$/t; × 1,04 é a convenção do código

INSTRUMENTOS = ("fixacao_acucar", "futuro_acucar", "ndf_dolar", "opcao_acucar", "opcao_dolar")
ACUCAR = ("fixacao_acucar", "futuro_acucar", "opcao_acucar")
VENDA_ACUCAR = ("fixacao_acucar", "futuro_acucar")  # entram no preço médio (R3)
LOTE_MAX = 500

MSG_PRECO = "Não foi possível obter os preços de {} agora. Tente novamente em alguns minutos."
MSG_SEM_ACESSO = "Usuário não associado a esta usina."


UUID_PADRAO = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"


class PosicaoBase(BaseModel):
    """Campos de uma posição, sem safra (o lote traz a safra no topo)."""
    model_config = ConfigDict(allow_inf_nan=False)
    instrumento: Literal["fixacao_acucar", "futuro_acucar", "ndf_dolar", "opcao_acucar", "opcao_dolar"]
    volume: float = Field(gt=0, lt=1e13)  # abaixo do limite de NUMERIC(16,2)
    preco_fixado: float = Field(gt=0, lt=1e6)
    cambio_fixado: Optional[float] = Field(default=None, gt=0, lt=1e6)
    premio: float = Field(default=0, ge=0, lt=1e6)
    vencimento: Optional[date] = None
    contraparte: Optional[str] = Field(default=None, max_length=120)
    observacao: Optional[str] = Field(default=None, max_length=300)


class PosicaoIn(PosicaoBase):
    safra: str = Field(pattern=r"^\d{4}/\d{2}$")


class PosicaoCreate(PosicaoIn):
    usina_id: str = Field(pattern=UUID_PADRAO)


class LotePosicoes(BaseModel):
    usina_id: str = Field(pattern=UUID_PADRAO)
    safra: str = Field(pattern=r"^\d{4}/\d{2}$")
    # Linhas validadas uma a uma em _validar_lote, para o 422 dizer a linha e o campo.
    posicoes: list[Any] = Field(max_length=LOTE_MAX)


CAMPO_PT = {
    "instrumento": "Instrumento",
    "volume": "Volume",
    "preco_fixado": "Preço fixado",
    "cambio_fixado": "Câmbio fixado",
    "premio": "Prêmio",
    "vencimento": "Vencimento",
    "contraparte": "Contraparte",
    "observacao": "Observação",
}


def _mensagem_linha(n: int, exc: ValidationError) -> str:
    """Texto em português para a primeira falha de uma linha do lote (1-based)."""
    erro = exc.errors()[0]
    loc = erro.get("loc") or ()
    if not loc:
        return f"Linha {n}: registro inválido."
    campo = str(loc[0])
    motivo = "campo obrigatório" if erro.get("type") == "missing" else "valor inválido"
    return f"Linha {n} ({CAMPO_PT.get(campo, campo)}): {motivo}."


def _validar_lote(brutas: list[Any]) -> list[PosicaoBase]:
    validadas = []
    for n, bruta in enumerate(brutas, start=1):
        try:
            validadas.append(PosicaoBase.model_validate(bruta))
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=_mensagem_linha(n, exc))
    return validadas


class PoliticaIn(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    usina_id: str = Field(pattern=UUID_PADRAO)
    safra: str = Field(pattern=r"^\d{4}/\d{2}$")
    minimo_pct: Optional[float] = Field(default=None, ge=0, le=100)
    maximo_pct: Optional[float] = Field(default=None, ge=0, le=100)
    producao_estimada_t: Optional[float] = Field(default=None, gt=0, lt=1e13)


# ── Cálculos puros ─────────────────────────────────────────────────────────────

def unidade(instrumento: str) -> str:
    return "t" if instrumento in ACUCAR else "US$"


def calcular_mtm(p: dict, sb: float, fx: float) -> float:
    """MTM em R$ de uma posição. Venda de açúcar/NDF = (fixado − mercado); put = intrínseco − prêmio."""
    k, v, pr, ins = p["preco_fixado"], p["volume"], p.get("premio") or 0, p["instrumento"]
    if ins in VENDA_ACUCAR:
        return (k - sb) * FATOR * fx * v
    if ins == "opcao_acucar":
        return (max(k - sb, 0) - pr) * FATOR * fx * v
    if ins == "ndf_dolar":
        return (k - fx) * v
    if ins == "opcao_dolar":
        return (max(k - fx, 0) - pr) * v
    raise ValueError(f"instrumento desconhecido: {ins}")


def resumo_safra(posicoes: list[dict], politica: Optional[dict], sb: Optional[float], fx: Optional[float]) -> dict:
    """Percentual fixado, preço médio, MTM e status contra a política (R2–R4, R8)."""
    producao = politica.get("producao_estimada_t") if politica else None
    minimo = politica.get("minimo_pct") if politica else None
    maximo = politica.get("maximo_pct") if politica else None

    vol_acucar = sum(p["volume"] for p in posicoes if p["instrumento"] in ACUCAR)
    pct = round(vol_acucar / producao * 100, 2) if producao else None

    if politica is None:
        status = "sem_politica"
    elif not producao:
        status = "sem_producao"
    else:
        lo = minimo or 0
        hi = 100 if maximo is None else maximo
        status = "abaixo" if pct < lo else "acima" if pct > hi else "dentro"

    venda = [p for p in posicoes if p["instrumento"] in VENDA_ACUCAR]
    vol_v = sum(p["volume"] for p in venda)
    com_cambio = [p for p in venda if p.get("cambio_fixado")]
    vol_c = sum(p["volume"] for p in com_cambio)
    avisos = [
        f"Posição de {p['volume']:g} t sem câmbio fixado ficou fora do preço médio em R$/t."
        for p in venda if not p.get("cambio_fixado")
    ]

    mtm_linhas = [{**p, "unidade": unidade(p["instrumento"]), "mtm_rs": round(calcular_mtm(p, sb, fx), 2)}
                  for p in posicoes] if posicoes else []

    return {
        "pct_fixado": pct,
        "minimo_pct": minimo,
        "maximo_pct": maximo,
        "producao_estimada_t": producao,
        "preco_medio_cents_lb": round(sum(p["preco_fixado"] * p["volume"] for p in venda) / vol_v, 2) if vol_v else None,
        "preco_medio_rs_t": round(sum(p["preco_fixado"] * FATOR * p["cambio_fixado"] * p["volume"] for p in com_cambio) / vol_c, 2) if vol_c else None,
        "mtm_total_rs": round(sum(m["mtm_rs"] for m in mtm_linhas), 2),
        "status": status,
        "avisos": avisos,
        "posicoes": mtm_linhas,
    }


# ── Acesso e preços ────────────────────────────────────────────────────────────

def _membro(supa, user_id: str, usina_id: str) -> bool:
    return bool(
        supa.table("user_usinas").select("usina_id").eq("user_id", user_id).eq("usina_id", usina_id).execute().data
    )


def _ultimo_fechamento(ticker: str) -> tuple[float, str]:
    hoje = date.today()
    linhas = [r for r in get_prices(ticker, hoje - timedelta(days=10), hoje) if r.get("close") is not None]
    if not linhas:
        raise HTTPException(status_code=503, detail=MSG_PRECO.format(ticker))
    return float(linhas[-1]["close"]), linhas[-1]["date"]


def _linha(body: PosicaoIn, usina_id: str, user_id: str) -> dict:
    d = body.model_dump(mode="json")
    d.update({"usina_id": usina_id, "criado_por": user_id})
    return d


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/posicoes", status_code=201)
@limiter.limit("20/minute")
def criar_posicao(request: Request, body: PosicaoCreate, user: Annotated[dict, Depends(get_current_user)]):
    supa = market_cache.supa_client()
    if not _membro(supa, user["id"], body.usina_id):
        raise HTTPException(status_code=403, detail=MSG_SEM_ACESSO)
    supa.table("posicoes").insert(_linha(body, body.usina_id, user["id"])).execute()
    return {"ok": True}


@router.post("/posicoes/lote", status_code=201)
@limiter.limit("5/minute")
def criar_lote(request: Request, body: LotePosicoes, user: Annotated[dict, Depends(get_current_user)]):
    """Importação inicial: tudo ou nada, numa única inserção."""
    supa = market_cache.supa_client()
    if not _membro(supa, user["id"], body.usina_id):
        raise HTTPException(status_code=403, detail=MSG_SEM_ACESSO)
    linhas = []
    for p in _validar_lote(body.posicoes):
        d = p.model_dump(mode="json")
        d["safra"] = body.safra
        d.update({"usina_id": body.usina_id, "criado_por": user["id"]})
        linhas.append(d)
    if linhas:
        supa.table("posicoes").insert(linhas).execute()
    return {"inseridas": len(linhas)}


@router.get("/posicoes/resumo")
@limiter.limit("30/minute")
def resumo(request: Request, usina_id: Annotated[str, Query(pattern=UUID_PADRAO)], safra: str, user: Annotated[dict, Depends(get_current_user)]):
    supa = market_cache.supa_client()
    if not _membro(supa, user["id"], usina_id):
        raise HTTPException(status_code=403, detail=MSG_SEM_ACESSO)
    posicoes = (
        supa.table("posicoes").select("*").eq("usina_id", usina_id).eq("safra", safra).order("created_at").execute()
    ).data
    pol = (
        supa.table("politica_hedge").select("*").eq("usina_id", usina_id).eq("safra", safra).execute()
    ).data
    politica = pol[0] if pol else None

    sb = fx = data_sb = data_fx = None
    if posicoes:  # sem posições não há o que marcar: não busca preço (R11)
        sb, data_sb = _ultimo_fechamento("SB=F")
        fx, data_fx = _ultimo_fechamento("USDBRL=X")

    out = resumo_safra(posicoes, politica, sb, fx)
    out.update({"sb_fechamento": sb, "usdbrl_fechamento": fx, "data_sb": data_sb, "data_usdbrl": data_fx})
    return out


@router.put("/posicoes/{pos_id}")
@limiter.limit("20/minute")
def atualizar_posicao(request: Request, pos_id: Annotated[str, Path(pattern=UUID_PADRAO)], body: PosicaoIn, user: Annotated[dict, Depends(get_current_user)]):
    supa = market_cache.supa_client()
    atual = supa.table("posicoes").select("usina_id").eq("id", pos_id).execute().data
    if not atual or not _membro(supa, user["id"], atual[0]["usina_id"]):
        raise HTTPException(status_code=404, detail="Posição não encontrada.")  # R7: não revela existência
    d = body.model_dump(mode="json")  # usina_id e criado_por não mudam (R5)
    supa.table("posicoes").update(d).eq("id", pos_id).execute()
    return {"ok": True}


@router.delete("/posicoes/{pos_id}")
@limiter.limit("20/minute")
def apagar_posicao(request: Request, pos_id: Annotated[str, Path(pattern=UUID_PADRAO)], user: Annotated[dict, Depends(get_current_user)]):
    supa = market_cache.supa_client()
    atual = supa.table("posicoes").select("usina_id").eq("id", pos_id).execute().data
    if not atual or not _membro(supa, user["id"], atual[0]["usina_id"]):
        raise HTTPException(status_code=404, detail="Posição não encontrada.")
    supa.table("posicoes").delete().eq("id", pos_id).execute()
    return {"ok": True}


@router.get("/politica-hedge")
@limiter.limit("30/minute")
def politica_get(request: Request, usina_id: Annotated[str, Query(pattern=UUID_PADRAO)], safra: str, user: Annotated[dict, Depends(get_current_user)]):
    supa = market_cache.supa_client()
    if not _membro(supa, user["id"], usina_id):
        raise HTTPException(status_code=403, detail=MSG_SEM_ACESSO)
    rows = supa.table("politica_hedge").select("*").eq("usina_id", usina_id).eq("safra", safra).execute().data
    return rows[0] if rows else None


@router.put("/politica-hedge")
@limiter.limit("20/minute")
def politica_salvar(request: Request, body: PoliticaIn, user: Annotated[dict, Depends(get_current_user)]):
    if body.minimo_pct is not None and body.maximo_pct is not None and body.minimo_pct > body.maximo_pct:
        raise HTTPException(status_code=422, detail="O mínimo não pode ser maior que o máximo.")
    supa = market_cache.supa_client()
    if not _membro(supa, user["id"], body.usina_id):
        raise HTTPException(status_code=403, detail=MSG_SEM_ACESSO)
    supa.table("politica_hedge").upsert(body.model_dump(mode="json"), on_conflict="usina_id,safra").execute()
    return {"ok": True}
