"""Exposição da safra (posicoes-fixacoes v2). Função pura, sem I/O.

Única fonte da conta de exposição: usada por GET /api/posicoes/exposicao e pelas duas telas de risco.
"""
from typing import Optional

# ¢/lb × 22,0462 = US$/t; × 1,04 é a convenção do código (mesma do MTM de metas).
FATOR = 22.0462 * 1.04

ACUCAR = ("fixacao_acucar", "futuro_acucar", "opcao_acucar")
FIXA = ("fixacao_acucar", "futuro_acucar")  # preço travado (R3 do MVP)


def e_call(p: dict) -> bool:
    return p.get("tipo_opcao") == "call"


def conta_acucar(p: dict) -> bool:
    """Açúcar que conta para % fixado: fixação, futuro e put de açúcar. Call comprada não conta (v2 R-V2-03)."""
    return p["instrumento"] in ACUCAR and not e_call(p)


def _soma(linhas: list[dict], campo: str = "volume") -> float:
    return sum(p[campo] for p in linhas)


def exposicao_aberta(posicoes: list[dict], producao_t: Optional[float], sb_cents_lb: Optional[float]) -> dict:
    """Quanto da safra está aberta e quanto dólar a usina ainda tem a receber.

    - pct_fixado: volume de açúcar que conta ÷ produção (R2 do MVP).
    - pct_travado: só fixação e futuro ÷ produção (é o que tem preço médio).
    - receita_usd_estimada: fixação e futuro SEM câmbio fixado a preço fixado, mais o restante da
      produção a SB=F spot, × FATOR. Fixação com câmbio fixado já está em R$ e sai (R-V2-01).
    - usd_protegido: NDF (nocional) mais put de dólar (nocional). Call de dólar não conta (R-V2-02).
    - usd_aberto: receita − protegido, nunca negativo. Nulo sem produção ou sem SB=F.
    """
    avisos: list[str] = []
    acucar = [p for p in posicoes if conta_acucar(p)]
    fixa = [p for p in posicoes if p["instrumento"] in FIXA]
    vol_acucar = _soma(acucar)
    vol_fixa = _soma(fixa)

    pct_fixado = pct_travado = acucar_aberto = None
    if producao_t:
        pct_fixado = round(vol_acucar / producao_t * 100, 2)
        pct_travado = round(vol_fixa / producao_t * 100, 2)
        acucar_aberto = round(max(producao_t - vol_acucar, 0.0), 2)
    else:
        avisos.append("Sem produção estimada: % fixado e dólar em aberto não foram calculados.")

    sem_cambio = [p for p in fixa if not p.get("cambio_fixado")]
    com_cambio_fixa = [p for p in fixa if p.get("cambio_fixado")]
    receita = None
    if producao_t and sb_cents_lb is not None:
        restante = max(producao_t - vol_fixa, 0.0)
        receita_cents = sum(p["preco_fixado"] * p["volume"] for p in sem_cambio) + restante * sb_cents_lb
        receita = round(receita_cents * FATOR, 2)

    usd_ndf = _soma([p for p in posicoes if p["instrumento"] == "ndf_dolar"])
    usd_put = _soma([p for p in posicoes if p["instrumento"] == "opcao_dolar" and not e_call(p)])
    usd_protegido = round(usd_ndf + usd_put, 2)
    usd_aberto = round(max(receita - usd_protegido, 0.0), 2) if receita is not None else None

    vol_v = vol_fixa
    preco_cents = round(sum(p["preco_fixado"] * p["volume"] for p in fixa) / vol_v, 2) if vol_v else None
    com_cambio = [p for p in fixa if p.get("cambio_fixado")]
    vol_c = _soma(com_cambio)
    preco_rs_t = (
        round(sum(p["preco_fixado"] * FATOR * p["cambio_fixado"] * p["volume"] for p in com_cambio) / vol_c, 2)
        if vol_c else None
    )
    for p in sem_cambio:
        avisos.append(f"Posição de {p['volume']:g} t sem câmbio fixado ficou fora do preço médio em R$/t.")

    return {
        "pct_fixado": pct_fixado,
        "pct_travado": pct_travado,
        # Só a parte com câmbio fixado: é a que tem preço médio em R$/t (R-V2-08 revisado).
        "pct_travado_rs": round(_soma(com_cambio_fixa) / producao_t * 100, 2) if producao_t else None,
        "producao_estimada_t": producao_t,
        "acucar_aberto_t": acucar_aberto,
        "preco_medio_cents_lb": preco_cents,
        "preco_medio_rs_t": preco_rs_t,
        "receita_usd_estimada": receita,
        "usd_ndf": round(usd_ndf, 2),
        "usd_opcao_dolar": round(usd_put, 2),
        "usd_protegido": usd_protegido,
        "usd_aberto": usd_aberto,
        "avisos": avisos,
    }
