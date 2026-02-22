import streamlit as st
import numpy as np
import plotly.graph_objs as go

from utils import require_login, show_logo

st.set_page_config(page_title="Breakeven", page_icon="📈", layout="wide")
require_login()
show_logo()


def faturamento(variavel_parametro, valor_parametro, outras_variaveis):
    if variavel_parametro in ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol"]:
        return ((outras_variaveis["NY"] - 0.19) * 22.0462 * 1.04 * outras_variaveis["Câmbio"] * outras_variaveis["Prod VHP"]) + ((outras_variaveis["NY"] + 1) * 22.0462 * 0.75 * outras_variaveis["Câmbio"] * 12000) + outras_variaveis["Prod Etanol"] * outras_variaveis["Preço Etanol"] + 3227430 + 22061958
    elif variavel_parametro == "ATR":
        return 22061958 + (373613190 * valor_parametro) / 125.35
    elif variavel_parametro == "Moagem":
        return 22061958 + (373613190 * valor_parametro) / 1300000


def custo(variavel_parametro, valor_parametro, outras_variaveis):
    if variavel_parametro in ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol"]:
        return 0.6 * ((outras_variaveis["Prod Etanol"] * outras_variaveis["Preço Etanol"]) + ((outras_variaveis["NY"] + 1) * 22.0462 * 0.75 * outras_variaveis["Câmbio"] * 12000) + ((outras_variaveis["NY"] - 0.19) * 22.0462 * 1.04 * outras_variaveis["Câmbio"] * outras_variaveis["Prod VHP"])) + 88704735 + 43732035 + 20286465
    elif variavel_parametro == "ATR":
        return (0.6 * (380767714 * valor_parametro / 125)) + 88704735 + 43732035 + 20286465
    elif variavel_parametro == "Moagem":
        return (0.6 * (380767714 * valor_parametro / 1300000)) + 88704735 + 43732035 + 20286465


st.title("Break-even Analysis")
variavel_parametro = st.selectbox("Variável:", ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol", "ATR", "Moagem"])
outras_variaveis = {}
for variavel in ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol", "ATR", "Moagem"]:
    if variavel != variavel_parametro:
        outras_variaveis[variavel] = st.number_input(f"{variavel}:", value=0.0)

if st.button("Gerar Gráfico"):
    if variavel_parametro == "NY":
        valores_parametro = np.linspace(15, 25, 100)
    elif variavel_parametro == "Câmbio":
        valores_parametro = np.linspace(4, 6, 100)
    elif variavel_parametro == "Prod VHP":
        valores_parametro = np.linspace(90000, 110000, 100)
    elif variavel_parametro == "Moagem":
        valores_parametro = np.linspace(1000000, 1500000, 100)
    elif variavel_parametro == "ATR":
        valores_parametro = np.linspace(115, 145, 100)
    elif variavel_parametro == "Prod Etanol":
        valores_parametro = np.linspace(25000, 50000, 100)
    elif variavel_parametro == "Preço Etanol":
        valores_parametro = np.linspace(2000, 4000, 100)
    else:
        valores_parametro = np.linspace(0, 5000, 100)

    faturamentos = []
    custos = []
    for valor_parametro in valores_parametro:
        outras_variaveis[variavel_parametro] = valor_parametro
        faturamentos.append(faturamento(variavel_parametro, valor_parametro, outras_variaveis))
        custos.append(custo(variavel_parametro, valor_parametro, outras_variaveis))

    idx_break_even = np.argmin(np.abs(np.array(faturamentos) - np.array(custos)))
    break_even_point = valores_parametro[idx_break_even]
    st.write(f"O ponto de break-even para '{variavel_parametro}' é: **{break_even_point:.2f}**")

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=valores_parametro, y=faturamentos, mode='lines', name='Faturamento'))
    fig.add_trace(go.Scatter(x=valores_parametro, y=custos, mode='lines', name='Custo'))
    fig.add_shape(type="line", x0=break_even_point, y0=min(min(faturamentos), min(custos)), x1=break_even_point, y1=max(max(faturamentos), max(custos)), line=dict(color="red", width=2, dash="dashdot"))
    fig.update_layout(title="Análise de Ponto de Equilíbrio", xaxis_title=variavel_parametro, yaxis_title="Valor", template="plotly_white")
    st.plotly_chart(fig)
