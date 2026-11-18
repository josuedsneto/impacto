"""Supabase e Yahoo simulados para os testes do backend (sem rede)."""
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import market_cache  # noqa: E402

LIMITE_POSTGREST = 1000


class _Resp:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, db, tabela):
        self.db, self.tabela = db, tabela
        self.filtros, self.ordem, self.intervalo, self.op = [], None, None, "select"

    def select(self, *_):
        return self

    def eq(self, k, v):
        self.filtros.append(lambda r: r.get(k) == v)
        return self

    def gte(self, k, v):
        self.filtros.append(lambda r: r[k] >= v)
        return self

    def lte(self, k, v):
        self.filtros.append(lambda r: r[k] <= v)
        return self

    def order(self, k, desc=False):
        self.ordem = (k, desc)
        return self

    def range(self, a, b):
        self.intervalo = (a, b)
        return self

    def limit(self, n):
        self.intervalo = (0, n - 1)
        return self

    def upsert(self, linhas, on_conflict, ignore_duplicates=False):
        self.op, self.linhas, self.chaves, self.ignorar = "upsert", linhas, on_conflict.split(","), ignore_duplicates
        return self

    def insert(self, linhas):
        self.op, self.linhas = "insert", linhas
        return self

    def update(self, dados):
        self.op, self.dados = "update", dados
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        tabela = self.db.setdefault(self.tabela, {})
        if self.op == "insert":
            for linha in self.linhas if isinstance(self.linhas, list) else [self.linhas]:
                novo_id = str(uuid.uuid4())
                tabela[novo_id] = {"id": novo_id, **linha}
            return _Resp([])
        if self.op in ("update", "delete"):
            alvo = [(k, r) for k, r in tabela.items() if all(f(r) for f in self.filtros)]
            for k, r in alvo:
                if self.op == "update":
                    r.update(self.dados)
                else:
                    del tabela[k]
            return _Resp([r for _, r in alvo])
        if self.op == "upsert":
            for linha in self.linhas if isinstance(self.linhas, list) else [self.linhas]:
                chave = tuple(linha[k] for k in self.chaves)
                if chave in tabela and self.ignorar:
                    continue
                tabela[chave] = {**tabela.get(chave, {}), **linha}
            return _Resp([])
        linhas = [r for r in tabela.values() if all(f(r) for f in self.filtros)]
        if self.ordem:
            linhas.sort(key=lambda r: r[self.ordem[0]], reverse=self.ordem[1])
        a, b = self.intervalo or (0, LIMITE_POSTGREST - 1)
        # Como o PostgREST: nunca mais que LIMITE_POSTGREST linhas por requisição
        return _Resp(linhas[a : min(b + 1, a + LIMITE_POSTGREST)])


class FakeSupabase:
    def __init__(self):
        self.db: dict = {}

    def table(self, nome):
        return _Query(self.db, nome)

    # Atalhos de preparação
    def gravar_precos(self, ticker, dias_closes: dict):
        t = self.db.setdefault("market_prices", {})
        for d, c in dias_closes.items():
            t[(ticker, d.isoformat())] = {"ticker": ticker, "date": d.isoformat(), "open": c, "high": c, "low": c, "close": c, "volume": 0}

    def cobertura(self, ticker, ini: date, fim: date):
        self.db.setdefault("market_coverage", {})[(ticker,)] = {"ticker": ticker, "first_date": ini.isoformat(), "last_date": fim.isoformat()}


def dias_uteis(ini: date, fim: date):
    d = ini
    while d <= fim:
        if d.weekday() < 5:
            yield d
        d += timedelta(days=1)


class FakeYahoo:
    """Substitui _fetch_from_yfinance: devolve pregões em dias úteis com close = preco(dia)."""

    def __init__(self, preco=lambda d: 20.0):
        self.preco, self.chamadas, self.falhar, self.vazio = preco, [], False, False

    def __call__(self, ticker, start, end):
        self.chamadas.append((ticker, start, end))
        if self.falhar:
            raise ConnectionError("Yahoo fora do ar")
        dias = [] if self.vazio else list(dias_uteis(start, end))
        if not dias:
            return pd.DataFrame()
        return pd.DataFrame(
            {"ticker": ticker, "date": dias, "open": [self.preco(d) for d in dias], "high": [self.preco(d) for d in dias],
             "low": [self.preco(d) for d in dias], "close": [self.preco(d) for d in dias], "volume": [0] * len(dias)}
        )


@pytest.fixture
def supa(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(market_cache, "supa_client", lambda: fake)
    market_cache._ultima_rebusca.clear()
    return fake


@pytest.fixture
def yahoo(monkeypatch):
    fake = FakeYahoo()
    monkeypatch.setattr(market_cache, "_fetch_from_yfinance", fake)
    return fake


@pytest.fixture
def api(supa, yahoo):
    """Cliente HTTP da API com usuário autenticado e limitador de requisições desligado."""
    from fastapi.testclient import TestClient

    import main

    main.limiter.enabled = False
    main.app.dependency_overrides[main.get_current_user] = lambda: {"id": "u1", "email": "u@x.com", "role": "user"}
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()
