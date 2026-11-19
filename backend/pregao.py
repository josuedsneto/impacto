"""Status do pregão do açúcar nº 11 (ICE Futures US), com feriados (pendencias-pequenas)."""
from datetime import date, datetime, time as Hora
from zoneinfo import ZoneInfo

# ICE Sugar No. 11: seg–sex, 03:30 às 13:00 (Nova York), exceto feriados da lista abaixo.
PREGAO_TZ = ZoneInfo("America/New_York")
PREGAO_ABERTURA = Hora(3, 30)
PREGAO_FECHAMENTO = Hora(13, 0)

# ponytail: atualizar todo ano. 2026 vem do "ICE Futures U.S. 2026 Trading Holiday Calendar" (coluna
# Sugar No. 11 = closed). 2027: só 1º/jan veio do PDF; o resto segue a regra dos feriados federais
# dos EUA (sáb → sexta, dom → segunda). Confirmar contra o calendário ICE 2027.
FERIADOS_ICE = frozenset({
    # 2026
    date(2026, 1, 1),    # Ano Novo
    date(2026, 1, 19),   # Martin Luther King Jr.
    date(2026, 2, 16),   # Presidents Day
    date(2026, 4, 3),    # Good Friday
    date(2026, 5, 25),   # Memorial Day
    date(2026, 6, 19),   # Juneteenth
    date(2026, 7, 3),    # Independence Day (observado)
    date(2026, 9, 7),    # Labor Day
    date(2026, 11, 26),  # Thanksgiving
    date(2026, 12, 25),  # Natal
    # 2027
    date(2027, 1, 1),    # Ano Novo
    date(2027, 1, 18),   # Martin Luther King Jr.
    date(2027, 2, 15),   # Presidents Day
    date(2027, 3, 26),   # Good Friday (Páscoa em 28/03/2027)
    date(2027, 5, 31),   # Memorial Day
    date(2027, 6, 18),   # Juneteenth (observado; 19/jun cai no sábado)
    date(2027, 7, 5),    # Independence Day (observado; 4/jul cai no domingo)
    date(2027, 9, 6),    # Labor Day
    date(2027, 11, 25),  # Thanksgiving
    date(2027, 12, 24),  # Natal (observado; 25/dez cai no sábado)
})


def estado_pregao(agora: datetime) -> str:
    """REGULAR dentro do pregão do açúcar nº 11, CLOSED fora dele. Intervalo [abertura, fechamento)."""
    local = agora.astimezone(PREGAO_TZ)
    if local.weekday() >= 5 or local.date() in FERIADOS_ICE:
        return "CLOSED"
    return "REGULAR" if PREGAO_ABERTURA <= local.time() < PREGAO_FECHAMENTO else "CLOSED"
