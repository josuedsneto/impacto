import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import yfinance as yf
from scipy.stats import norm
from datetime import date, datetime

from utils import require_login, show_logo

st.set_page_config(page_title="VaR", page_icon="📈", layout="wide")
require_login()
show_logo()


def calcular_var(data, n_days, current_price, z_score):
    if 'Close' in data.columns:
        data = data.copy()
        data['Returns'] = data['Close'].pct_change()
    else:
        raise KeyError("Coluna 'Close' não encontrada.")
    lambda_ = 0.94
    data['EWMA_Vol'] = data['Returns'].ewm(span=(2 / (1 - lambda_) - 1)).std()
    data['Annualized_EWMA_Vol'] = data['EWMA_Vol'] * np.sqrt(n_days)
    VaR_EWMA = z_score * data['Annualized_EWMA_Vol'].iloc[-1] * current_price
    price_at_risk = current_price + VaR_EWMA
    return VaR_EWMA, price_at_risk, data['Returns'].mean(), data['Returns'].std()


def calcular_dias_uteis(data_inicio, data_fim):
    return np.busday_count(data_inicio.date(), data_fim.date())


st.title("Análise de Risco - VaR")
escolha = st.selectbox('Selecione o ativo:', ['USDBRL=X', 'SB=F'])
start_date = date(2013, 1, 1)
data = yf.download(escolha, start=start_date, end=date.today().strftime('%Y-%m-%d'), auto_adjust=True, multi_level_index=False, progress=False)

if data.empty:
    st.error("Não foi possível baixar os dados.")
    st.stop()

current_price = float(data["Close"].iloc[-1])
data_fim = st.date_input('Selecione a data final:', datetime.now())
n_days = calcular_dias_uteis(data.index[-1], pd.to_datetime(data_fim))
confianca = st.slider('Nível de confiança (%):', min_value=90, max_value=99, step=1)
z_score = norm.ppf((100 - confianca) / 100)

if st.button('Calcular'):
    VaR_EWMA, price_at_risk, mean_returns, std_returns = calcular_var(data, n_days, current_price, z_score)
    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric("VaR", f"{VaR_EWMA:.2f}")
    col2.metric("Preço em risco", f"{price_at_risk:.2f}")
    col3.metric("Média Retornos", f"{mean_returns:.2%}")
    col4.metric("Volatilidade Histórica", f"{std_returns:.2%}")
    col5.metric("Z-Score", f"{z_score:.2f}")
    hist_data = data['Close'].pct_change().dropna()
    bin_centers = np.linspace(hist_data.min(), hist_data.max(), 100)
    pdf = norm.pdf(bin_centers, mean_returns, std_returns)
    fig = go.Figure()
    fig.add_trace(go.Histogram(x=hist_data, nbinsx=100, name='Histograma', histnorm='probability density'))
    fig.add_trace(go.Scatter(x=bin_centers, y=pdf, mode='lines', name='Distribuição Normal', line=dict(color='red')))
    st.plotly_chart(fig)
