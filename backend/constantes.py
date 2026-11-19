"""Constantes de negócio lidas de admin_config (com fallback para o valor do código)."""
import logging
import re

from market_cache import supa_client

logger = logging.getLogger(__name__)


# Constantes de negócio lidas de admin_config. Conjunto fechado: só estas chaves são numéricas.
CONSTANTES_NEGOCIO: dict[str, tuple[float, str]] = {
    "breakeven_fator_conversao": (1.12045, "Fator de conversão cents/lb → R$/saca (0,022046 × 50,802). Usado no Breakeven."),
    "fator_conversao_mtm": (22.928048, "Fator de conversão do valor de mercado (cents/lb → R$/t): 22,0462 × 1,04. Usado em Metas, Risco e Cenários."),
    "risco_custo_fixo_1": (109212811.0, "Custo fixo 1 do Risco (R$): primeira parcela da fórmula de custo. Confirmar a rubrica."),
    "risco_custo_fixo_2": (32947347.0, "Custo fixo 2 do Risco (R$): segunda parcela da fórmula de custo. Confirmar a rubrica."),
    "cenarios_custo_fixo_1": (88704735.0, "Custo fixo 1 de Cenários (R$): primeira parcela da fórmula de custo. Confirmar a rubrica."),
    "cenarios_custo_fixo_2": (43732035.0, "Custo fixo 2 de Cenários (R$): segunda parcela da fórmula de custo. Confirmar a rubrica."),
    "cenarios_custo_fixo_3": (20286465.0, "Custo fixo 3 de Cenários (R$): terceira parcela da fórmula de custo. Confirmar a rubrica."),
}


def _valor_numerico(texto) -> float:
    """Aceita dígitos com no máximo um separador decimal (ponto ou vírgula). Precisa ser > 0."""
    t = str(texto).strip()
    if not re.fullmatch(r"[0-9]+([.,][0-9]+)?", t):
        raise ValueError(t)
    valor = float(t.replace(",", "."))
    if valor <= 0:
        raise ValueError(t)
    return valor


def _ler_constantes(*chaves: str) -> dict[str, float]:
    """Lê as constantes de admin_config. Ausente, ilegível ou erro de rede → valor do código + aviso no log."""
    try:
        linhas = supa_client().table("admin_config").select("key,value").execute().data or []
        brutos = {r["key"]: r["value"] for r in linhas}
    except Exception as exc:
        logger.warning("Não foi possível ler admin_config (%s); usando valores do código.", exc)
        brutos = {}
    valores = {}
    for chave in chaves:
        padrao = CONSTANTES_NEGOCIO[chave][0]
        if chave not in brutos:
            logger.warning("Constante %s ausente em admin_config; usando %s.", chave, padrao)
            valores[chave] = padrao
            continue
        try:
            valores[chave] = _valor_numerico(brutos[chave])
        except ValueError:
            logger.warning("Valor inválido em admin_config para %s; usando %s.", chave, padrao)
            valores[chave] = padrao
    return valores
