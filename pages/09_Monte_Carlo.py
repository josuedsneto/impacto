import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import yfinance as yf
from datetime import date
from pandas.tseries.offsets import BDay

from utils import require_login, show_logo

st.set_page_config(page_title="Monte Carlo", page_icon="📈", layout="wide")
require_login()
show_logo()


@st.cache_data(ttl=3600)
def baixar_dados_mc(ativo: str) -> pd.DataFrame:
    start_date = date(2013, 1, 1)
    end_date = date.today().strftime("%Y-%m-%d")
    data = yf.download(ativo, start=start_date, end=end_date, multi_level_index=False, auto_adjust=True, progress=False)
    data["Daily Return"] = data["Close"].pct_change()
    return data


def simulacao_monte_carlo(preco_inicial, media, std, dias_simulados, num_simulacoes, limite_inferior, limite_superior):
    retornos = np.random.normal(media, std, (dias_simulados, num_simulacoes))
    fator = np.cumprod(1 + retornos, axis=0)
    precos_simulados = np.clip(preco_inicial * fator, limite_inferior, limite_superior)
    return precos_simulados


def calcular_dias_uteis(data_inicial, data_final):
    datas_uteis = pd.date_range(start=data_inicial, end=data_final, freq=BDay())
    return len(datas_uteis)


st.title("Simulação Monte Carlo de Preços")
tipo_ativo = st.selectbox("Selecione o tipo de ativo", ["Açúcar", "Dólar"])
ativo = "SB=F" if tipo_ativo == "Açúcar" else "USDBRL=X"

data = baixar_dados_mc(ativo)
media_retornos_diarios = data['Daily Return'].mean()
desvio_padrao_retornos_diarios = data['Daily Return'].std()

data_simulacao = st.date_input("Selecione a data para simulação", value=pd.to_datetime('today') + pd.offsets.BDay(30))
hoje = pd.to_datetime('today').date()
dias_simulados = calcular_dias_uteis(hoje, data_simulacao)

if "valor_simulado_mc" not in st.session_state:
    st.session_state["valor_simulado_mc"] = float(data['Close'].iloc[-1])
valor_simulado = st.number_input("Qual valor deseja simular?", value=st.session_state["valor_simulado_mc"], step=0.01)
preco_atual = float(data['Close'].iloc[-1])
PCT_BOUND = 0.50
limite_inferior = preco_atual * (1 - PCT_BOUND)
limite_superior = preco_atual * (1 + PCT_BOUND)

if dias_simulados <= 0:
    st.warning("A data de simulação deve ser posterior a hoje.")
    st.stop()

if st.button("Simular"):
    simulacoes = simulacao_monte_carlo(valor_simulado, media_retornos_diarios, desvio_padrao_retornos_diarios, dias_simulados, 10000, limite_inferior, limite_superior)
    percentil_20 = np.percentile(simulacoes[-1], 20)
    percentil_80 = np.percentile(simulacoes[-1], 80)
    prob_acima_valor = np.mean(simulacoes[-1] > valor_simulado) * 100
    prob_abaixo_valor = np.mean(simulacoes[-1] < valor_simulado) * 100
    days = np.arange(1, dias_simulados + 1)
    p5  = np.percentile(simulacoes, 5,  axis=1)
    p25 = np.percentile(simulacoes, 25, axis=1)
    p50 = np.percentile(simulacoes, 50, axis=1)
    p75 = np.percentile(simulacoes, 75, axis=1)
    p95 = np.percentile(simulacoes, 95, axis=1)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=days, y=p95, line=dict(width=0), showlegend=False))
    fig.add_trace(go.Scatter(x=days, y=p5,  fill='tonexty', fillcolor='rgba(70,130,180,0.15)', line=dict(width=0), name='P5–P95'))
    fig.add_trace(go.Scatter(x=days, y=p75, line=dict(width=0), showlegend=False))
    fig.add_trace(go.Scatter(x=days, y=p25, fill='tonexty', fillcolor='rgba(70,130,180,0.30)', line=dict(width=0), name='P25–P75'))
    fig.add_trace(go.Scatter(x=days, y=p50, line=dict(color='steelblue', width=2), name='Mediana (P50)'))
    fig.update_layout(title=f'Simulação Monte Carlo — {tipo_ativo}', xaxis_title='Dias', yaxis_title='Preço')
    st.plotly_chart(fig)
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("P20", f"{percentil_20:.2f}")
    col2.metric("P80", f"{percentil_80:.2f}")
    col3.metric(f"Prob. acima de {valor_simulado:.2f}", f"{prob_acima_valor:.1f}%")
    col4.metric(f"Prob. abaixo de {valor_simulado:.2f}", f"{prob_abaixo_valor:.1f}%")
    hist_data = simulacoes[-1]
    fig_hist = go.Figure()
    fig_hist.add_trace(go.Histogram(x=hist_data, nbinsx=100, histnorm='probability', marker_color='rgba(0,128,128,0.6)', opacity=0.75))
    fig_hist.update_layout(xaxis_title="Preço Simulado", yaxis_title="Frequência")
    st.plotly_chart(fig_hist)
