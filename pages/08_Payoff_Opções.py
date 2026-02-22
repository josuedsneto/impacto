import streamlit as st
import numpy as np
import plotly.graph_objs as go

from utils import require_login, show_logo

st.set_page_config(page_title="Simulação de Opções", page_icon="📈", layout="wide")
require_login()
show_logo()


def calcular_receita(tipo_opcao, tipo_posicao, strike, lotes, preco_acucar):
    if tipo_posicao == "Venda":
        if tipo_opcao == "Put":
            return np.where(preco_acucar > strike, 0, lotes * 1120 * (preco_acucar - strike))
        elif tipo_opcao == "Call":
            return np.where(preco_acucar < strike, 0, lotes * 1120 * (strike - preco_acucar))
    elif tipo_posicao == "Compra":
        if tipo_opcao == "Call":
            return np.where(preco_acucar < strike, 0, lotes * 1120 * (preco_acucar - strike))
        elif tipo_opcao == "Put":
            return np.where(preco_acucar > strike, 0, lotes * 1120 * (strike - preco_acucar))


st.title("Simulador de Opções")
min_preco_acucar = st.number_input("Preço mínimo:", min_value=0.0, max_value=100.0, step=0.01, value=0.0)
max_preco_acucar = st.number_input("Preço máximo:", min_value=0.0, max_value=100.0, step=0.01, value=26.0)
num_pernas = st.number_input("Quantas pernas deseja adicionar na simulação?", min_value=1, max_value=20, value=1, step=1)

pernas = []
for i in range(num_pernas):
    st.header(f"Perna {i+1}")
    tipo_posicao = st.radio(f"Tipo de posição para a perna {i+1}:", ("Compra", "Venda"), key=f"posicao_{i}")
    tipo_opcao = st.radio(f"Tipo de opção para a perna {i+1}:", ("Put", "Call"), key=f"opcao_{i}")
    strike = st.number_input(f"Strike para a perna {i+1}:", min_value=0.0, max_value=100.0, step=0.01, value=20.0, key=f"strike_{i}")
    lotes = st.number_input(f"Quantidade de lotes para a perna {i+1}:", min_value=1, max_value=1000000000, step=1, value=1, key=f"lotes_{i}")
    pernas.append((tipo_posicao, tipo_opcao, strike, lotes))

if st.button("Simular"):
    precos_acucar = np.arange(min_preco_acucar, max_preco_acucar, 0.25)
    receitas = np.zeros_like(precos_acucar)
    for perna in pernas:
        tipo_posicao, tipo_opcao, strike, lotes = perna
        receitas += calcular_receita(tipo_opcao, tipo_posicao, strike, lotes, precos_acucar)
    color = '#FF5733' if receitas[-1] < 0 else '#33FF57'
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=precos_acucar, y=receitas, fill='tozeroy', line=dict(color=color)))
    fig.update_layout(title='Simulação de Opções', xaxis_title='Preço do Açúcar', yaxis_title='Receita (US$)')
    st.plotly_chart(fig)
