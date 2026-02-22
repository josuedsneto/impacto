import streamlit as st
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objs as go
import yfinance as yf
from datetime import date

import streamlit as st
from utils import require_login, show_logo

st.set_page_config(page_title="Metas", page_icon="📈", layout="wide")
require_login()
show_logo()


@st.cache_data(ttl=3600)
def calcular_mtm(meta):
    start_date = date(2013, 1, 1)
    today = date.today()
    end_date = today.strftime('%Y-%m-%d')
    sugar_data = yf.download('SB=F', start=start_date, end=end_date, multi_level_index=False, auto_adjust=True, progress=False)
    forex_data = yf.download('USDBRL=X', start=start_date, end=end_date, multi_level_index=False, auto_adjust=True, progress=False)
    sugar_prices = sugar_data['Close']
    forex_prices = forex_data['Close']
    mtm = 22.0462 * 1.04 * sugar_prices * forex_prices
    mtm_df = pd.DataFrame({'Date': mtm.index, 'MTM': mtm.values, 'Meta': meta})
    mtm_df['Date'] = pd.to_datetime(mtm_df['Date']).dt.strftime('%d/%b/%Y')
    return mtm_df


def plot_heatmap_metas(meta):
    precos_acucar = np.arange(24, 19, -0.5)
    precos_dolar = np.arange(4.8, 5.3, 0.05)
    produto = np.zeros((len(precos_acucar), len(precos_dolar)))
    for i, acucar in enumerate(precos_acucar):
        for j, dolar in enumerate(precos_dolar):
            produto[i, j] = 22.0462 * 1.04 * acucar * dolar - meta
    fig, ax = plt.subplots(figsize=(20, 16))
    cax = ax.imshow(produto, cmap='RdYlGn', aspect='auto')
    for i in range(len(precos_acucar)):
        for j in range(len(precos_dolar)):
            ax.text(j, i, f'R$ {produto[i, j]:.0f}/Ton', ha='center', va='center', color='white', fontsize=11.5, fontweight='bold')
    fig.colorbar(cax, ax=ax, label='Produto')
    ax.set_xticks(np.arange(len(precos_dolar)))
    ax.set_xticklabels([f'{d:.2f}' for d in precos_dolar])
    ax.set_yticks(np.arange(len(precos_acucar)))
    ax.set_yticklabels([f'{a:.2f}' for a in precos_acucar])
    ax.set_xlabel('Preço do Dólar', fontsize=14)
    ax.set_ylabel('Preço do Açúcar', fontsize=14)
    ax.set_title(f'Produto = 22.0462 * 1.04 * Preço do Açúcar * Preço do Dólar - Meta: {meta}', fontsize=16)
    st.pyplot(fig)


st.title("Metas")
st.write("Selecione a meta desejada:")
meta = st.slider("Meta:", min_value=2400, max_value=2800, value=2600, step=10)
if st.button("Calcular"):
    plot_heatmap_metas(meta)
    mtm_data = calcular_mtm(meta)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=mtm_data['Date'], y=mtm_data['MTM'], mode='lines', name='MTM'))
    fig.add_trace(go.Scatter(x=mtm_data['Date'], y=[meta]*len(mtm_data), mode='lines', name='Meta', line=dict(dash='dash', color='red')))
    fig.update_layout(title=f'MTM ao Longo do Tempo - Meta: {meta}', xaxis_title='Data', yaxis_title='MTM')
    st.plotly_chart(fig)
