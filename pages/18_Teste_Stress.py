import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go

from utils import require_login, show_logo

st.set_page_config(page_title="Teste de Stress", page_icon="📈", layout="wide")
require_login()
show_logo()

st.title("Teste de Estresse: Impacto Financeiro vs. Dólar")
venda_media = st.number_input("Valor da venda média do Dólar (R$):", min_value=0.0, step=0.01, format="%.2f")
valor_total = st.number_input("Valor total (R$):", min_value=0.0, step=1000.0, format="%.2f")
min_hipotetico = st.number_input("Valor mínimo hipotético do dólar (R$):", min_value=0.0, step=0.01, format="%.2f")
max_hipotetico = st.number_input("Valor máximo hipotético do dólar (R$):", min_value=min_hipotetico + 0.01, step=0.01, format="%.2f")
intervalo = st.number_input("Intervalo entre os valores do dólar (R$):", min_value=0.01, step=0.01, format="%.2f", value=0.10)

if st.button("Executar Teste de Estresse"):
    if min_hipotetico >= max_hipotetico:
        st.error("O valor máximo hipotético deve ser maior que o valor mínimo.")
        st.stop()
    valores_hipoteticos = np.round(np.arange(min_hipotetico, max_hipotetico + intervalo, intervalo), 2)
    impactos = np.round((venda_media - valores_hipoteticos) * valor_total, 2)
    df = pd.DataFrame({'Valor Hipotético (R$)': valores_hipoteticos, 'Impacto (R$)': impactos})
    st.dataframe(df.style.format({'Valor Hipotético (R$)': "R$ {:.2f}", 'Impacto (R$)': "R$ {:.2f}"}))
    fig = go.Figure(go.Bar(x=df['Impacto (R$)'], y=[f'R$ {x:.2f}' for x in df['Valor Hipotético (R$)']], orientation='h', marker=dict(color=df['Impacto (R$)'], colorscale='RdYlGn_r')))
    fig.update_layout(title='Teste de Estresse: Impacto Financeiro vs. Dólar', xaxis_title='Impacto Financeiro (R$)', yaxis_title='Valor do Dólar (R$)', template="plotly_white")
    st.plotly_chart(fig)
