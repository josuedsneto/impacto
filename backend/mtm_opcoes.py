"""MTM de opções por modelo (posicoes-fixacoes v2, POS-V2-01 a POS-V2-05). Puro: os dados chegam por parâmetro.

Cada função devolve o valor unitário da opção (¢/lb para açúcar, R$/US$ para dólar) e os parâmetros usados.
Sem dado suficiente (vol, taxa, vencimento) cai no valor intrínseco com aviso.
"""
import math
from typing import Optional

import numpy as np

from cambio import forward
from hedge_cambial import taxas_gk
from options import black76_price, gk_price

DIAS_UTEIS = 252
MIN_RETORNOS = 60
JANELA_VOL = 252


def vol_historica(closes: np.ndarray) -> Optional[float]:
    """Vol anual: desvio amostral dos log-retornos diários dos últimos 252 pregões × √252. None se faltar histórico."""
    c = np.asarray(closes, dtype=float)
    c = c[c > 0]
    r = np.diff(np.log(c))
    if len(r) < MIN_RETORNOS:
        return None
    return float(np.std(r[-JANELA_VOL:], ddof=1) * math.sqrt(DIAS_UTEIS))


def _tipo(p: dict) -> str:
    return "call" if p.get("tipo_opcao") == "call" else "put"


def _intrinseco(p: dict, spot: float, motivo: str) -> dict:
    k = p["preco_fixado"]
    valor = max(spot - k, 0.0) if _tipo(p) == "call" else max(k - spot, 0.0)
    return {"modelo": "intrinseco", "valor_unitario": valor, "vol_anual": None, "taxa_dom": None,
            "taxa_for": None, "anos_ate_vencimento": None, "aviso": motivo}


def _motivo_faltante(vol, taxa, du) -> Optional[str]:
    if vol is None or not math.isfinite(vol) or vol <= 0:
        return "Sem volatilidade histórica suficiente: valor intrínseco."
    if taxa is None:
        return "Sem taxa de juros disponível: valor intrínseco."
    if du is None:
        return "Sem vencimento: valor intrínseco."
    if du <= 0:
        return "Opção vencida ou vencendo hoje: valor intrínseco."
    return None


def opcao_acucar(p: dict, sb: float, vol: Optional[float], fed: Optional[float], du: Optional[int]) -> dict:
    """Black-76 sobre SB=F (¢/lb). Desconto à Fed funds em taxa contínua ln(1+i) (R-V2-04)."""
    motivo = _motivo_faltante(vol, fed, du)
    if motivo:
        return _intrinseco(p, sb, motivo)
    T = du / DIAS_UTEIS
    r = math.log(1 + fed / 100)
    valor = black76_price(sb, p["preco_fixado"], T, r, vol, _tipo(p))
    return {"modelo": "black76", "valor_unitario": valor, "vol_anual": vol, "taxa_dom": r,
            "taxa_for": None, "anos_ate_vencimento": T, "aviso": None}


def opcao_dolar(p: dict, spot: float, vol: Optional[float], selic_aa: Optional[float], fed_aa: Optional[float],
                du: Optional[int], dc: Optional[int]) -> dict:
    """Garman-Kohlhagen sobre USDBRL=X. Mesma convenção do hedge cambial (R-V2-05 e R-V2-06)."""
    motivo = _motivo_faltante(vol, selic_aa, du)
    if motivo is None and fed_aa is None:
        motivo = "Sem taxa de juros disponível: valor intrínseco."
    if motivo:
        return _intrinseco(p, spot, motivo)
    T = du / DIAS_UTEIS
    F = forward(spot, selic_aa / 100, du, fed_aa / 100, dc)
    r_dom, r_for = taxas_gk(F, spot, selic_aa / 100, T)
    valor = gk_price(spot, p["preco_fixado"], T, r_dom, r_for, vol, _tipo(p))
    return {"modelo": "gk", "valor_unitario": valor, "vol_anual": vol, "taxa_dom": r_dom,
            "taxa_for": r_for, "anos_ate_vencimento": T, "aviso": None}
