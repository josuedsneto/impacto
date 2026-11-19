"""Posições de fixação e política de hedge por usina e safra (posicoes-fixacoes)."""
from datetime import date, timedelta
from typing import Annotated, Any, Literal, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

import cambio
import market_cache
from auth import get_current_user
from exposicao import FATOR, e_call, exposicao_aberta  # FATOR reexportado (testes e import antigo)
from limiter import limiter
from market_cache import get_prices
from mtm_opcoes import opcao_acucar, opcao_dolar, vol_historica
from politica_hedge import situacao
from routers.cambio import JANELA as JANELA_FX, juros_em, serie_fx

router = APIRouter(prefix="/api")

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
    # v2 (POS-V2-10): nulo em opção = put (linhas do MVP). Só opção pode ter tipo.
    tipo_opcao: Optional[Literal["call", "put"]] = None

    @model_validator(mode="after")
    def tipo_so_em_opcao(self):
        if self.tipo_opcao is not None and self.instrumento not in ("opcao_acucar", "opcao_dolar"):
            raise ValueError("tipo_opcao só vale para opção")
        return self


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
    "tipo_opcao": "Tipo da opção",
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
    """MTM intrínseco em R$ de uma posição (fallback do MTM por modelo). Venda = (fixado − mercado)."""
    k, v, pr, ins = p["preco_fixado"], p["volume"], p.get("premio") or 0, p["instrumento"]
    if ins in VENDA_ACUCAR:
        return (k - sb) * FATOR * fx * v
    if ins == "opcao_acucar":
        intr = max(sb - k, 0) if e_call(p) else max(k - sb, 0)
        return (intr - pr) * FATOR * fx * v
    if ins == "ndf_dolar":
        return (k - fx) * v
    if ins == "opcao_dolar":
        intr = max(fx - k, 0) if e_call(p) else max(k - fx, 0)
        return (intr - pr) * v
    raise ValueError(f"instrumento desconhecido: {ins}")


def mtm_com_modelo(p: dict, detalhe: dict, sb: float, fx: float) -> float:
    """MTM em R$ de uma opção pelo valor de mercado do modelo (POS-V2-01/02): (valor − prêmio) × escala."""
    v, pr = p["volume"], p.get("premio") or 0
    if p["instrumento"] == "opcao_acucar":
        return (detalhe["valor_unitario"] - pr) * FATOR * fx * v
    return (detalhe["valor_unitario"] - pr) * v


def resumo_safra(posicoes: list[dict], politica: Optional[dict], sb: Optional[float], fx: Optional[float],
                 modelos: Optional[dict] = None) -> dict:
    """Percentual fixado, preço médio, MTM e status contra a política (R2–R4, R8; v2 MTM por modelo).

    `modelos` mapeia id da posição → detalhe do MTM por modelo (opcoes v2). Sem entrada, cai no intrínseco.
    """
    modelos = modelos or {}
    sit = situacao([p for p in posicoes if not e_call(p)], politica)

    venda = [p for p in posicoes if p["instrumento"] in VENDA_ACUCAR]
    vol_v = sum(p["volume"] for p in venda)
    com_cambio = [p for p in venda if p.get("cambio_fixado")]
    vol_c = sum(p["volume"] for p in com_cambio)
    avisos = [
        f"Posição de {p['volume']:g} t sem câmbio fixado ficou fora do preço médio em R$/t."
        for p in venda if not p.get("cambio_fixado")
    ]

    mtm_linhas = []
    for p in posicoes:
        detalhe = modelos.get(p.get("id")) if p["instrumento"] in ("opcao_acucar", "opcao_dolar") else None
        if detalhe and detalhe["modelo"] != "intrinseco":
            mtm = mtm_com_modelo(p, detalhe, sb, fx)
        else:
            mtm = calcular_mtm(p, sb, fx)
        vazio = {"modelo": None, "vol_anual": None, "taxa_dom": None, "taxa_for": None,
                 "anos_ate_vencimento": None, "valor_unitario": None, "aviso": None}
        if p["instrumento"] in ("opcao_acucar", "opcao_dolar") and not detalhe:
            detalhe = {**vazio, "modelo": "intrinseco"}  # sem modelo calculado (uso puro): só o intrínseco
        mtm_linhas.append({**p, **(detalhe if p["instrumento"] in ("opcao_acucar", "opcao_dolar") else vazio),
                           "unidade": unidade(p["instrumento"]), "mtm_rs": round(mtm, 2)})
        if detalhe and detalhe.get("aviso"):
            avisos.append(detalhe["aviso"])

    avisos = list(dict.fromkeys(avisos))
    return {
        **sit,
        "preco_medio_cents_lb": round(sum(p["preco_fixado"] * p["volume"] for p in venda) / vol_v, 2) if vol_v else None,
        "preco_medio_rs_t": round(sum(p["preco_fixado"] * FATOR * p["cambio_fixado"] * p["volume"] for p in com_cambio) / vol_c, 2) if vol_c else None,
        "mtm_total_rs": round(sum(m["mtm_rs"] for m in mtm_linhas), 2),
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


def _carregar_safra(supa, usina_id: str, safra: str) -> tuple[list[dict], Optional[dict]]:
    posicoes = (
        supa.table("posicoes").select("*").eq("usina_id", usina_id).eq("safra", safra).order("created_at").execute()
    ).data
    pol = (
        supa.table("politica_hedge").select("*").eq("usina_id", usina_id).eq("safra", safra).execute()
    ).data
    return posicoes, (pol[0] if pol else None)


def _modelos_opcoes(posicoes: list[dict], sb: float, fx: float) -> dict:
    """MTM por modelo das opções (POS-V2-01 a 05). Histórico ou juros indisponíveis viram fallback com aviso, nunca erro."""
    opcoes = [p for p in posicoes if p["instrumento"] in ("opcao_acucar", "opcao_dolar")]
    if not opcoes:
        return {}
    hoje = date.today()
    vol_sb = vol_fx = selic = fed = None
    spot_fx = fx  # série limpa do USDBRL, como no hedge; o tick bruto do resumo é o fallback
    if any(p["instrumento"] == "opcao_acucar" for p in opcoes):
        try:
            linhas = [r for r in get_prices("SB=F", hoje - timedelta(days=400), hoje) if r.get("close") is not None]
            closes, _ = cambio.limpar(np.array([float(r["close"]) for r in linhas]), np.array([r["date"] for r in linhas]))
            vol_sb = vol_historica(closes)
        except Exception:
            vol_sb = None  # sem histórico: intrínseco com aviso
    if any(p["instrumento"] == "opcao_dolar" for p in opcoes):
        try:
            closes, _ = serie_fx(hoje)
            spot_fx = float(closes[-1])
            _, sigma_dia = cambio.vol_ewma(cambio.retornos(closes[-JANELA_FX:]))
            vol_fx = sigma_dia * np.sqrt(cambio.DIAS_UTEIS_ANO)
        except Exception:
            vol_fx = None
        try:
            selic, fed = juros_em(pd.Timestamp(hoje))
        except Exception:
            selic = fed = None

    modelos = {}
    for p in opcoes:
        du = dc = None
        if p.get("vencimento"):
            venc = date.fromisoformat(str(p["vencimento"])[:10])
            du = int(np.busday_count(hoje, venc))
            dc = (venc - hoje).days
        try:
            if p["instrumento"] == "opcao_acucar":
                modelos[p.get("id")] = opcao_acucar(p, sb, vol_sb, fed, du)
            else:
                modelos[p.get("id")] = opcao_dolar(p, spot_fx, vol_fx, selic, fed, du, dc)
        except (ValueError, ZeroDivisionError, FloatingPointError):
            # Dado que o modelo não aceita: nunca 500 (POS-V2-04)
            modelos[p.get("id")] = {"modelo": "intrinseco", "valor_unitario": None, "vol_anual": None,
                                    "taxa_dom": None, "taxa_for": None, "anos_ate_vencimento": None,
                                    "aviso": "Modelo indisponível para estes dados: valor intrínseco."}
    return modelos


@router.get("/posicoes/resumo")
@limiter.limit("30/minute")
def resumo(request: Request, usina_id: Annotated[str, Query(pattern=UUID_PADRAO)], safra: str, user: Annotated[dict, Depends(get_current_user)]):
    supa = market_cache.supa_client()
    if not _membro(supa, user["id"], usina_id):
        raise HTTPException(status_code=403, detail=MSG_SEM_ACESSO)
    posicoes, politica = _carregar_safra(supa, usina_id, safra)

    sb = fx = data_sb = data_fx = None
    if posicoes:  # sem posições não há o que marcar: não busca preço (R11)
        sb, data_sb = _ultimo_fechamento("SB=F")
        fx, data_fx = _ultimo_fechamento("USDBRL=X")

    modelos = _modelos_opcoes(posicoes, sb, fx) if posicoes else {}
    out = resumo_safra(posicoes, politica, sb, fx, modelos)
    out.update({"sb_fechamento": sb, "usdbrl_fechamento": fx, "data_sb": data_sb, "data_usdbrl": data_fx})
    return out


@router.get("/posicoes/exposicao")
@limiter.limit("30/minute")
def exposicao(request: Request, usina_id: Annotated[str, Query(pattern=UUID_PADRAO)], safra: str, user: Annotated[dict, Depends(get_current_user)]):
    """Parte aberta da safra e dólar em aberto (POS-V2-06). Conta única em exposicao.exposicao_aberta."""
    supa = market_cache.supa_client()
    if not _membro(supa, user["id"], usina_id):
        raise HTTPException(status_code=403, detail=MSG_SEM_ACESSO)
    posicoes, politica = _carregar_safra(supa, usina_id, safra)
    producao = politica.get("producao_estimada_t") if politica else None

    sb = fx = data_sb = data_fx = None
    if posicoes or producao:  # a receita em US$ precisa de SB=F (POS-V2-06, R-V2-09)
        sb, data_sb = _ultimo_fechamento("SB=F")
        fx, data_fx = _ultimo_fechamento("USDBRL=X")

    out = exposicao_aberta(posicoes, producao, sb)
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
