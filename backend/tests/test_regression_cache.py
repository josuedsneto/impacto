"""CACHE-01/04: regressões leem preços pelo cache de preços."""
import ast
import sys
import types
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

import regression

RAIZ = Path(__file__).resolve().parent.parent


def test_main_e_regression_nao_chamam_yf_download():
    """CACHE-01 AC2."""
    for arquivo in ("main.py", "regression.py", "routers/conta.py", "routers/opcoes.py", "routers/regressao.py", "routers/simulacoes.py", "routers/atr_usinas.py", "routers/admin.py", "routers/mercado.py", "noticias.py"):
        arvore = ast.parse((RAIZ / arquivo).read_text(encoding="utf-8"))
        chamadas = [
            n for n in ast.walk(arvore)
            if isinstance(n, ast.Attribute) and n.attr == "download" and isinstance(n.value, ast.Name) and n.value.id == "yf"
        ]
        assert chamadas == [], arquivo


def test_defaults_do_acucar_vem_do_cache(supa, yahoo):
    yahoo.preco = lambda d: 21.5
    r = regression.get_acucar_defaults()
    assert r["sb_f"] == 21.5 and r["usdbrl"] == 21.5 and r["cl_f"] == 21.5
    assert r["ultimo_dado"] <= date.today().isoformat()
    assert {c[0] for c in yahoo.chamadas} == {"SB=F", "USDBRL=X", "CL=F"}


def test_historico_anual_do_acucar_usa_fechamento_de_fim_de_ano(supa, yahoo):
    # preço = ano - 2000, para o fechamento de cada ano ser identificável
    yahoo.preco = lambda d: float(d.year - 2000)
    df = regression.fetch_acucar_history()
    assert list(df.index[:3]) == [2014, 2015, 2016]
    assert df.loc[2015, "sb_f"] == 15.0
    assert df.attrs["ultimo_dado"] <= date.today().isoformat()


def test_dolar_mensal_vem_do_cache(supa, yahoo, monkeypatch):
    """Série mensal = último fechamento de cada mês dos diários do cache; BCB e FRED simulados."""
    yahoo.preco = lambda d: 5 + d.month / 100
    meses = pd.period_range(end=pd.Timestamp.today(), periods=80, freq="M").strftime("%Y-%m")

    def sgs_get(_codigo, start, end):
        idx = pd.date_range(start, end, freq="ME")
        return pd.Series(range(len(idx)), index=idx, dtype=float) + 1

    monkeypatch.setitem(sys.modules, "bcb", types.SimpleNamespace(sgs=types.SimpleNamespace(get=sgs_get)))
    monkeypatch.setattr(regression, "_fetch_fred_history", lambda sid, ini: pd.Series(range(len(meses)), index=meses, dtype=float) + 1)
    df = regression.fetch_dolar_history(months=36)
    jan = [i for i in df.index if i.endswith("-01")][0]
    assert df.loc[jan, "taxa_dolar"] == 5.01
    assert df.attrs["ultimo_dado"] <= date.today().isoformat()
    assert {c[0] for c in yahoo.chamadas} == {"USDBRL=X"}
