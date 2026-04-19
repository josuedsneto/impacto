import streamlit as st
import pandas as pd
import plotly.graph_objs as go
import yfinance as yf
from datetime import date
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.tsa.stattools import acf
from statsmodels.tsa.arima.model import ARIMA

from utils import require_login, show_logo

st.set_page_config(page_title="ARIMA Açúcar", page_icon="📈", layout="wide")
require_login()
show_logo()


@st.cache_data(ttl=3600)
def baixar_dados_acucar():
    start_date = date(2014, 1, 1)
    df = yf.download('SB=F', start=start_date, end=date.today().strftime('%Y-%m-%d'), auto_adjust=True, multi_level_index=False, progress=False)
    return df


def decompor_serie(df):
    decomposition = seasonal_decompose(df['Close'], model='additive', period=365)
    trend = decomposition.trend.dropna()
    seasonal = decomposition.seasonal.dropna()
    residual = decomposition.resid.dropna()
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df['Close'].index, y=df['Close'], mode='lines', name='Valor Real', line=dict(color='blue')))
    fig.add_trace(go.Scatter(x=trend.index, y=trend, mode='lines', name='Tendência', line=dict(color='red')))
    fig.add_trace(go.Scatter(x=seasonal.index, y=seasonal, mode='lines', name='Sazonalidade', line=dict(color='orange')))
    fig.add_trace(go.Scatter(x=residual.index, y=residual, mode='lines', name='Resíduos', line=dict(color='green')))
    fig.update_layout(title="Decomposição da Série Temporal", xaxis_title='Data', yaxis_title='Valor')
    st.plotly_chart(fig)


def plot_acf_custom(df):
    df_clean = df['Close'].dropna()
    lags = 50
    acf_vals = acf(df_clean, nlags=lags)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=list(range(lags+1)), y=acf_vals, mode='markers+lines', name='Autocorrelação', marker=dict(color='blue', size=6)))
    fig.update_layout(title='Autocorrelação (ACF)', xaxis_title='Lags', yaxis_title='Autocorrelação')
    st.plotly_chart(fig)


@st.cache_data(ttl=3600)
def _ajustar_arima_acucar(close_tuple: tuple, p: int, d: int, q: int, dias_futuro: int) -> list:
    """Ajusta o modelo ARIMA e retorna a previsão. Separado para permitir cache."""
    from statsmodels.tsa.arima.model import ARIMA as _ARIMA
    forecast = _ARIMA(pd.Series(close_tuple), order=(p, d, q)).fit().forecast(steps=dias_futuro)
    return forecast.tolist()


def arima_previsao(df, dias_futuro, p=5, d=1, q=0):
    with st.spinner("Ajustando modelo ARIMA..."):
        forecast_list = _ajustar_arima_acucar(tuple(df['Close'].values), p, d, q, dias_futuro)
    previsao_datas = pd.date_range(df.index[-1], periods=dias_futuro + 1, freq='D')[1:]
    df_forecast = pd.DataFrame({'Data': previsao_datas, 'Previsão': forecast_list})
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df.index, y=df['Close'], mode='lines', name='Valor Real', line=dict(color='blue')))
    fig.add_trace(go.Scatter(x=df_forecast['Data'], y=df_forecast['Previsão'], mode='lines+markers', name=f'Previsão de {dias_futuro} dias', line=dict(color='red', dash='dash')))
    fig.update_layout(title=f'Previsão ARIMA ({p}, {d}, {q}) — {dias_futuro} dias', xaxis_title='Data', yaxis_title='Preço do Açúcar')
    st.plotly_chart(fig)


st.title("Previsão do Preço do Açúcar com ARIMA")
df = baixar_dados_acucar()
st.write("### Dados Históricos")
st.write(df.tail())
st.write("### Decomposição da Série Temporal")
decompor_serie(df)
st.write("### Autocorrelação (ACF)")
plot_acf_custom(df)
dias_futuro = st.number_input("Quantos dias no futuro deseja prever?", min_value=1, max_value=365, value=30, step=1)
if st.button("Simular"):
    arima_previsao(df, dias_futuro)
