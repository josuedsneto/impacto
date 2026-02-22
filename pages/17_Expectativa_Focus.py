import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
from scipy.stats import norm

from utils import require_login, show_logo

st.set_page_config(page_title="Expectativa Focus", page_icon="📈", layout="wide")
require_login()
show_logo()


def obter_dados_bcb(endpoint, data_inicio, data_fim, data_referencia, base_calculo):
    from bcb import Expectativas
    em = Expectativas()
    ep = em.get_endpoint(endpoint)
    df = (ep.query().filter(ep.Indicador == "Câmbio").filter(ep.Data >= data_inicio, ep.Data <= data_fim).filter(ep.DataReferencia == data_referencia, ep.baseCalculo == base_calculo).select(ep.Data, ep.Media, ep.Mediana, ep.DesvioPadrao, ep.Minimo, ep.Maximo, ep.numeroRespondentes).collect())
    return df


def grafico_probabilidade_focus(media, desvio_padrao, dolar_futuro):
    x = np.linspace(media - 4 * desvio_padrao, media + 4 * desvio_padrao, 1000)
    y = norm.pdf(x, media, desvio_padrao)
    probabilidade = 100 * (1 - norm.cdf(dolar_futuro, media, desvio_padrao))
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=x, y=y, mode='lines', name='Distribuição Normal'))
    x_verde = x[x <= dolar_futuro]
    y_verde = y[x <= dolar_futuro]
    if len(x_verde) > 0:
        fig.add_trace(go.Scatter(x=np.concatenate([[x_verde[0]], x_verde, [x_verde[-1]]]), y=np.concatenate([[0], y_verde, [0]]), fill='toself', fillcolor='rgba(0,255,0,0.3)', line=dict(width=0), name=f'P <= R${dolar_futuro}'))
    x_vermelho = x[x > dolar_futuro]
    y_vermelho = y[x > dolar_futuro]
    if len(x_vermelho) > 0:
        fig.add_trace(go.Scatter(x=np.concatenate([[x_vermelho[0]], x_vermelho, [x_vermelho[-1]]]), y=np.concatenate([[0], y_vermelho, [0]]), fill='toself', fillcolor='rgba(255,0,0,0.3)', line=dict(width=0), name=f'P > R${dolar_futuro}'))
    fig.add_annotation(x=dolar_futuro, y=norm.pdf(dolar_futuro, media, desvio_padrao), text=f'P > R${dolar_futuro}: {probabilidade:.2f}%', showarrow=True, arrowhead=2)
    fig.update_layout(title='Distribuição de Probabilidade do Dólar', xaxis_title='Valor do Dólar', yaxis_title='Densidade', plot_bgcolor="white")
    st.plotly_chart(fig)


def grafico_histograma_bcb(media, desvio_padrao, numero_respondentes, minimo, maximo):
    dados_simulados = np.random.normal(loc=media, scale=desvio_padrao, size=numero_respondentes)
    fig = go.Figure()
    fig.add_trace(go.Histogram(x=dados_simulados, nbinsx=25, name='Distribuição Simulada', opacity=0.7, marker=dict(color='blue')))
    fig.add_trace(go.Scatter(x=[media, media], y=[0, 100], mode='lines', name=f'Média: {media}', line=dict(dash='dash', color='red')))
    fig.add_trace(go.Scatter(x=[minimo, minimo], y=[0, 100], mode='lines', name=f'Mínimo: {minimo}', line=dict(dash='dash', color='orange')))
    fig.add_trace(go.Scatter(x=[maximo, maximo], y=[0, 100], mode='lines', name=f'Máximo: {maximo}', line=dict(dash='dash', color='purple')))
    fig.update_layout(title='Histograma das Expectativas', xaxis_title='Valor do Dólar', yaxis_title='Frequência', plot_bgcolor="white")
    st.plotly_chart(fig)


st.title("Análise de Expectativas de Mercado do Dólar")
endpoint = st.radio("Tipo de expectativa:", options=["ExpectativasMercadoAnuais", "ExpectativaMercadoMensais"], format_func=lambda x: "Anuais" if x == "ExpectativasMercadoAnuais" else "Mensais")
data_inicio = st.date_input("Data inicial:", value=pd.to_datetime("2020-01-01"), min_value=pd.to_datetime("2000-01-01"), max_value=pd.Timestamp.today())
data_fim = st.date_input("Data final:", value=pd.Timestamp.today(), min_value=pd.to_datetime("2000-01-01"), max_value=pd.Timestamp.today())
data_referencia = st.text_input("Ano de referência:", value="")
base_calculo = st.selectbox("Base de Cálculo", [0, 1])
dolar_futuro = st.number_input("Valor do Dólar Futuro", min_value=1.0, max_value=20.0, value=6.0, step=0.01)

if st.button("Obter Dados e Gerar Gráficos"):
    df = obter_dados_bcb(endpoint, data_inicio.strftime("%Y-%m-%d"), data_fim.strftime("%Y-%m-%d"), data_referencia, base_calculo)
    df = df.sort_values(by='Data', ascending=True)
    if not df.empty:
        ultima_linha = df.iloc[-1]
        grafico_probabilidade_focus(ultima_linha['Media'], ultima_linha['DesvioPadrao'], dolar_futuro)
        grafico_histograma_bcb(ultima_linha['Media'], ultima_linha['DesvioPadrao'], ultima_linha['numeroRespondentes'], ultima_linha['Minimo'], ultima_linha['Maximo'])
    else:
        st.write("Não há dados para os filtros selecionados.")
