import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import scipy.stats as si
import yfinance as yf
from datetime import datetime

from utils import require_login, show_logo

st.set_page_config(page_title="Black-Scholes", page_icon="📈", layout="wide")
require_login()
show_logo()


def black_scholes(S, K, T, r, sigma, option_type):
    d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    if option_type == 'call':
        return S * si.norm.cdf(d1, 0.0, 1.0) - K * np.exp(-r * T) * si.norm.cdf(d2, 0.0, 1.0)
    elif option_type == 'put':
        return K * np.exp(-r * T) * si.norm.cdf(-d2, 0.0, 1.0) - S * si.norm.cdf(-d1, 0.0, 1.0)
    else:
        raise ValueError("Tipo de opção inválido. Use 'call' ou 'put'.")


assets = {
    'SBN26.NYB': datetime(2026, 6, 30),
    'SBV26.NYB': datetime(2026, 9, 30),
}
volatilities = {
    'SBN26.NYB': 0.2573,
    'SBV26.NYB': 0.2573,
}
risk_free_rate = 0.053

st.title("Simulador de Preços de Opções - Modelo Black-Scholes")
asset = st.selectbox("Selecione o ativo subjacente", list(assets.keys()))
option_type = st.selectbox("Selecione o tipo de opção", ["call", "put"])
strike_price = st.number_input("Digite o preço de exercício (strike): ", min_value=1.0, value=20.0, step=0.5)
sigma = st.number_input(
    "Volatilidade implícita (anualizada):",
    value=volatilities[asset],
    min_value=0.01,
    max_value=2.0,
    step=0.01,
    format="%.4f",
    help="Volatilidade anualizada usada no modelo Black-Scholes. Padrão: 25.73%"
)

if st.button("Simular"):
    expiration_date = assets[asset]
    current_date = datetime.now()
    days_to_expiration = (expiration_date - current_date).days
    T = days_to_expiration / 365
    if T <= 0:
        st.error("O contrato selecionado já expirou.")
        st.stop()
    hist = yf.Ticker(asset).history(period="5d")
    if hist.empty:
        st.error(f"Não foi possível obter dados para {asset}.")
        st.stop()
    S = hist['Close'].iloc[-1]
    option_price = black_scholes(S, strike_price, T, risk_free_rate, sigma, option_type)
    st.write(f"O preço da {option_type} é: {option_price:.2f}")
    strikes = np.arange(14, 24.25, 0.25)
    call_prices = [black_scholes(S, k, T, risk_free_rate, sigma, 'call') for k in strikes]
    put_prices = [black_scholes(S, k, T, risk_free_rate, sigma, 'put') for k in strikes]
    df_options = pd.DataFrame({'Strike': strikes, 'Call Prices': call_prices, 'Put Prices': put_prices})
    st.write("Tabela de Preços das Opções")
    st.write(round(df_options, 2))
    fig = go.Figure()
    if option_type == 'call':
        fig.add_trace(go.Scatter(x=df_options['Strike'], y=df_options['Call Prices'], mode='lines', name='Call Prices'))
    else:
        fig.add_trace(go.Scatter(x=df_options['Strike'], y=df_options['Put Prices'], mode='lines', name='Put Prices'))
    fig.update_layout(title=f"Preços das Opções {option_type.upper()}", xaxis_title="Strike Price", yaxis_title="Option Price", template="plotly_dark")
    st.plotly_chart(fig)
    times_to_expiration = np.linspace(0.01, T, 100)
    option_prices_vs_time = [black_scholes(S, strike_price, t, risk_free_rate, sigma, option_type) for t in times_to_expiration]
    fig_time = go.Figure()
    fig_time.add_trace(go.Scatter(x=times_to_expiration, y=option_prices_vs_time, mode='lines', name='Option Price'))
    fig_time.update_layout(title=f"Preço da {option_type.upper()} em Função do Tempo", xaxis_title="Time to Expiration (Years)", yaxis_title="Option Price", template="plotly_dark")
    st.plotly_chart(fig_time)
