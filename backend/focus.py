"""
focus.py — mediana do Boletim Focus (BCB) por indicador e ano de referência.

Usado por /api/focus e pelo endpoint de câmbio. Bloqueante (chamada HTTP ao BCB):
chame a partir de endpoints `def` ou via run_in_executor.
"""

from __future__ import annotations

from datetime import date, timedelta


def fetch_indicator(name: str, ano: str, hoje: date | None = None) -> dict:
    """Mediana mais recente do indicador para o ano, e a variação vs ~7 dias antes. None se falhar."""
    hoje = hoje or date.today()
    semana_atras = hoje - timedelta(days=9)  # folga para fins de semana
    try:
        from bcb import Expectativas

        expec = Expectativas()
        ep = expec.get_endpoint("ExpectativasMercadoAnuais")
        data = (
            ep.query()
            .filter(ep.Indicador == name)
            .filter(ep.DataReferencia == ano)
            .filter(ep.baseCalculo == 0)
            .filter(ep.Data >= str(semana_atras))
            .filter(ep.Data <= str(hoje))
            .collect()
        )
        if data.empty:
            return {"value": None, "delta": None}
        data = data.sort_values("Data")
        latest = float(data.iloc[-1]["Mediana"])
        delta = round(latest - float(data.iloc[0]["Mediana"]), 4) if len(data) >= 2 else None
        return {"value": round(latest, 4), "delta": delta}
    except Exception:
        return {"value": None, "delta": None}
