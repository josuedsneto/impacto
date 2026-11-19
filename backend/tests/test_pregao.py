"""PEN-08 a PEN-10: feriados da ICE no status do pregão do açúcar nº 11."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pregao

NY = ZoneInfo("America/New_York")


def test_feriado_de_dia_util_em_horario_de_pregao_responde_closed():
    # Martin Luther King Jr. 2026 (segunda), 10h em NY
    assert pregao.estado_pregao(datetime(2026, 1, 19, 10, 0, tzinfo=NY)) == "CLOSED"
    # Good Friday 2026 (sexta)
    assert pregao.estado_pregao(datetime(2026, 4, 3, 9, 0, tzinfo=NY)) == "CLOSED"
    # Natal 2027 cai no sábado: o observado é sexta, 24/dez
    assert pregao.estado_pregao(datetime(2027, 12, 24, 10, 0, tzinfo=NY)) == "CLOSED"
    # Good Friday 2027 (Páscoa em 28/03/2027)
    assert pregao.estado_pregao(datetime(2027, 3, 26, 10, 0, tzinfo=NY)) == "CLOSED"


def test_sexta_santa_de_2027_nao_e_em_abril():
    # Regressão: a data de 23/04 estava errada; a Páscoa de 2027 é 28/03
    assert date(2027, 3, 26) in pregao.FERIADOS_ICE
    assert date(2027, 4, 23) not in pregao.FERIADOS_ICE


def test_dia_util_vizinho_ao_feriado_continua_regular():
    assert pregao.estado_pregao(datetime(2026, 1, 16, 10, 0, tzinfo=NY)) == "REGULAR"  # sexta antes do MLK
    assert pregao.estado_pregao(datetime(2026, 1, 20, 10, 0, tzinfo=NY)) == "REGULAR"  # terça depois do MLK
    assert pregao.estado_pregao(datetime(2027, 4, 26, 10, 0, tzinfo=NY)) == "REGULAR"  # segunda depois da Good Friday


def test_feriado_respeita_o_horario_de_pregao_no_mesmo_dia():
    # Feriado fecha o dia inteiro, inclusive antes da abertura e depois do fechamento
    assert pregao.estado_pregao(datetime(2026, 5, 25, 3, 30, tzinfo=NY)) == "CLOSED"
    assert pregao.estado_pregao(datetime(2026, 5, 25, 23, 0, tzinfo=NY)) == "CLOSED"


def test_regra_antiga_continua_valendo_fora_de_feriado():
    assert pregao.estado_pregao(datetime(2026, 11, 16, 10, 0, tzinfo=NY)) == "REGULAR"
    assert pregao.estado_pregao(datetime(2026, 11, 16, 3, 30, tzinfo=NY)) == "REGULAR"
    assert pregao.estado_pregao(datetime(2026, 11, 16, 13, 0, tzinfo=NY)) == "CLOSED"


def test_lista_tem_os_feriados_de_2026_e_2027():
    anos = {d.year for d in pregao.FERIADOS_ICE}
    assert anos == {2026, 2027}
    assert len(pregao.FERIADOS_ICE) == 20


def test_briefing_pula_feriado_do_pregao_no_dia_util_anterior():
    """Alertas: 'dia útil anterior' não conta feriado do ICE (1º/jan/2026 é quinta)."""
    import briefing
    from datetime import date

    assert briefing.ultimo_dia_util_anterior(date(2026, 1, 2)) == date(2025, 12, 31)  # sex 02/01 → qui 01/01 é feriado → qua 31/12
    assert briefing.ultimo_dia_util_anterior(date(2026, 1, 5)) == date(2026, 1, 2)    # segunda → sexta 02/01 (útil)
