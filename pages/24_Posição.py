import streamlit as st
import numpy as np
import plotly.graph_objs as go
import yfinance as yf
from datetime import date

from utils import require_login, show_logo

st.set_page_config(page_title="Posição Consolidada", page_icon="📊", layout="wide")
require_login()
show_logo()


def _br(v, dec=2):
    return f"{abs(v):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")


@st.cache_data(ttl=3600)
def buscar_preco(ticker: str) -> float:
    data = yf.download(ticker, period="5d", auto_adjust=True, multi_level_index=False, progress=False)
    if data.empty:
        return 0.0
    return float(data["Close"].dropna().iloc[-1])


st.title("Posição Consolidada de Hedge")
st.caption("Visão agregada do livro de hedge: cobertura, P&L e receita estimada.")

tipo = st.selectbox("Ativo", ["Açúcar (SB=F)", "Dólar (USDBRL=X)"])
ticker = "SB=F" if "Açúcar" in tipo else "USDBRL=X"
unidade = "¢/lb" if "Açúcar" in tipo else "R$/USD"

preco_atual = buscar_preco(ticker)

col1, col2, col3 = st.columns(3)
producao_total = col1.number_input(
    "Produção / exposição total (lotes):",
    min_value=0.0, step=100.0, value=1000.0,
)
quantidade_fixada = col2.number_input(
    "Quantidade já fixada (lotes):",
    min_value=0.0, step=100.0, value=0.0,
)
preco_fixado = col3.number_input(
    f"Preço médio fixado ({unidade}):",
    min_value=0.0, step=0.01, value=preco_atual if preco_atual > 0 else 0.0,
    format="%.4f",
)

st.divider()

if producao_total <= 0:
    st.warning("Informe a produção total para calcular a posição.")
    st.stop()

quantidade_aberta = max(producao_total - quantidade_fixada, 0.0)
cobertura_pct = min(quantidade_fixada / producao_total * 100, 100.0)

# ── Métricas principais ───────────────────────────────────────────────────────
st.subheader("Resumo da Posição")
c1, c2, c3, c4 = st.columns(4)
c1.metric("Preço atual de mercado", f"{_br(preco_atual, 4)} {unidade}")
c2.metric("Cobertura", f"{_br(cobertura_pct, 1)}%",
          help=f"{_br(quantidade_fixada, 0)} de {_br(producao_total, 0)} lotes fixados")
c3.metric("Lotes fixados", _br(quantidade_fixada, 0))
c4.metric("Lotes em aberto", _br(quantidade_aberta, 0))

st.progress(cobertura_pct / 100, text=f"Cobertura: {_br(cobertura_pct, 1)}%")

# ── P&L das fixações ──────────────────────────────────────────────────────────
st.subheader("P&L das Fixações")
pl_por_lote = preco_fixado - preco_atual          # positivo = fixou acima do mercado
pl_total    = pl_por_lote * quantidade_fixada

ca, cb = st.columns(2)
ca.metric(
    "P&L por lote (fixado vs mercado)",
    f"{_br(abs(pl_por_lote), 4)} {unidade}",
    delta=f"{'+' if pl_por_lote >= 0 else '-'}{_br(abs(pl_por_lote), 4)}",
    delta_color="normal" if pl_por_lote >= 0 else "inverse",
    help="Positivo = fixou acima do mercado atual (favorável para vendedores)",
)
cb.metric(
    "P&L total das fixações",
    f"{_br(abs(pl_total), 2)} {unidade}",
    delta=f"{'+' if pl_total >= 0 else '-'}{_br(abs(pl_total), 2)}",
    delta_color="normal" if pl_total >= 0 else "inverse",
)

# ── Receita estimada ──────────────────────────────────────────────────────────
st.subheader("Receita Estimada")
receita_fixada  = quantidade_fixada  * preco_fixado
receita_aberta  = quantidade_aberta  * preco_atual
receita_total   = receita_fixada + receita_aberta

receita_tudo_mercado = producao_total * preco_atual
receita_tudo_fixado  = producao_total * preco_fixado

c1, c2, c3 = st.columns(3)
c1.metric(
    "Receita estimada (posição atual)",
    f"{_br(receita_total)} {unidade}",
    help=f"Fixado: {_br(receita_fixada)} + Aberto: {_br(receita_aberta)}",
)
c2.metric(
    "Se tudo vendido a mercado",
    f"{_br(receita_tudo_mercado)} {unidade}",
)
c3.metric(
    "Se tudo tivesse sido fixado",
    f"{_br(receita_tudo_fixado)} {unidade}",
)

# ── Gráfico waterfall ─────────────────────────────────────────────────────────
fig = go.Figure(go.Waterfall(
    orientation="v",
    measure=["relative", "relative", "total"],
    x=["Receita fixada", "Receita em aberto", "Total estimado"],
    y=[receita_fixada, receita_aberta, 0],
    text=[
        f"{_br(receita_fixada)}<br>({_br(quantidade_fixada,0)} lotes × {_br(preco_fixado,4)})",
        f"{_br(receita_aberta)}<br>({_br(quantidade_aberta,0)} lotes × {_br(preco_atual,4)})",
        _br(receita_total),
    ],
    textposition="outside",
    connector=dict(line=dict(color="rgba(63,63,63,0.5)")),
    increasing=dict(marker_color="steelblue"),
    totals=dict(marker_color="teal"),
))
fig.update_layout(
    title=f"Composição da Receita Estimada — {tipo}",
    yaxis_title=f"Receita ({unidade})",
    separators=",.",
)
st.plotly_chart(fig, use_container_width=True)

# ── Comparação de cenários ────────────────────────────────────────────────────
st.subheader("Comparação de Cenários")
cenarios = ["Tudo a mercado", "Posição atual", "Tudo fixado"]
valores  = [receita_tudo_mercado, receita_total, receita_tudo_fixado]
cores    = ["#ef553b", "#636efa", "#00cc96"]

fig2 = go.Figure(go.Bar(
    x=cenarios,
    y=valores,
    marker_color=cores,
    text=[_br(v) for v in valores],
    textposition="outside",
))
fig2.update_layout(
    title="Receita por Cenário de Hedge",
    yaxis_title=f"Receita ({unidade})",
    separators=",.",
)
st.plotly_chart(fig2, use_container_width=True)
