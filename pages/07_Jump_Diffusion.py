import streamlit as st
import numpy as np
import pandas as pd
import plotly.express as px
import yfinance as yf

from utils import require_login, show_logo

st.set_page_config(page_title="Jump Diffusion", page_icon="📈", layout="wide")
require_login()
show_logo()


def simulate_jump_diffusion(s0, mu, sigma, lambda_jumps, mu_jump, sigma_jump, T, steps):
    dt = T / steps
    prices = [s0]
    for _ in range(steps):
        jump = np.random.poisson(lambda_jumps * dt)
        jump_magnitude = np.sum(np.random.normal(mu_jump, sigma_jump, jump))
        diffusion = (mu - 0.5 * sigma**2) * dt + sigma * np.random.normal() * np.sqrt(dt)
        price = prices[-1] * np.exp(diffusion + jump_magnitude)
        prices.append(price)
    return prices


st.title("Simulação de Preços - Modelo Jump-Diffusion")
variable = st.selectbox("Escolha a variável para estudar:", ["Açúcar", "Dólar"])
start_date = st.date_input("Selecione a data de início:", value=pd.to_datetime("2013-01-01"))
symbol = "SB=F" if variable == "Açúcar" else "USDBRL=X"
sigma_input = st.text_input("Digite o valor de sigma (volatilidade):", value="")
sigma = float(sigma_input) if sigma_input else None

if st.button("Simular"):
    data = yf.download(symbol, start=start_date, end="2099-01-01", multi_level_index=False, auto_adjust=True, progress=False)
    if 'Close' in data.columns:
        data['Price'] = data['Close']
    else:
        st.error("Erro: coluna 'Close' não encontrada.")
        st.stop()
    data['Log Returns'] = np.log(data['Price'] / data['Price'].shift(1))
    data.dropna(inplace=True)
    if sigma is None:
        sigma = data['Log Returns'].std()
    mu = data['Log Returns'].mean()
    s0 = data['Price'].iloc[-1]
    simulated_prices = simulate_jump_diffusion(s0=s0, mu=mu, sigma=sigma, lambda_jumps=0.1, mu_jump=-0.02, sigma_jump=0.05, T=1, steps=252)
    jump_diffusion_df = pd.DataFrame({'Step': range(len(simulated_prices)), 'Price': simulated_prices})
    fig = px.line(jump_diffusion_df, x='Step', y='Price', title=f"Simulação de Preços - {variable} com Jump-Diffusion")
    st.plotly_chart(fig)
    st.write(f"O valor médio da simulação para o ano foi: {np.mean(simulated_prices):.2f}")
