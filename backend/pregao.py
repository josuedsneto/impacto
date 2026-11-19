"""Estado do pregão do açúcar nº 11 (ICE). Regra pura, sem I/O."""
from datetime import datetime, time as Hora
from zoneinfo import ZoneInfo


# ICE Sugar No. 11: seg–sex, 03:30 às 13:00 (Nova York). Sem feriados (ponytail: calendário fixo).
PREGAO_TZ = ZoneInfo("America/New_York")
PREGAO_ABERTURA = Hora(3, 30)
PREGAO_FECHAMENTO = Hora(13, 0)


def estado_pregao(agora: datetime) -> str:
    """REGULAR dentro do pregão do açúcar nº 11, CLOSED fora dele. Intervalo [abertura, fechamento)."""
    local = agora.astimezone(PREGAO_TZ)
    if local.weekday() >= 5:
        return "CLOSED"
    return "REGULAR" if PREGAO_ABERTURA <= local.time() < PREGAO_FECHAMENTO else "CLOSED"
