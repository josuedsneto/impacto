import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

from config import ATIVOS, carregar_dados
from utils import require_login

st.set_page_config(page_title="Simulação de Preços de Calls", page_icon="📈", layout="wide")

require_login()

st.markdown(
    '<img src="https://ibea.com.br/wp-content/uploads/2020/10/Capturar1.png"'
    ' alt="logo" style="width:200px;">',
    unsafe_allow_html=True,
)
st.write("")


# ---------------------------------------------------------------------------
# Simulation — European call, final day only
# ---------------------------------------------------------------------------

def simulacao_monte_carlo(
    media: float,
    std: float,
    dias: int,
    num_simulacoes: int,
    limite_inf: float,
    limite_sup: float,
    preco_inicial: float,
    valor_strike: float,
) -> float:
    retornos = np.random.normal(media, std, (dias, num_simulacoes))
    fator = np.cumprod(1 + retornos, axis=0)
    precos = np.clip(preco_inicial * fator, limite_inf, limite_sup)
    precos_finais = precos[-1, :]
    return float(np.mean(np.maximum(precos_finais - valor_strike, 0)))


def simular_calls(dias_simulados, data, limite_inferior, limite_superior):
    media = data["Daily Return"].mean()
    std = data["Daily Return"].std()
    preco_inicial = data["Close"].iloc[-1]
    num_simulacoes = 10_000

    resultados = []
    for strike in np.arange(limite_inferior, limite_superior + 0.25, 0.25):
        valor_justo = simulacao_monte_carlo(
            media, std, dias_simulados, num_simulacoes,
            limite_inferior, limite_superior, preco_inicial, float(strike),
        )
        resultados.append([round(float(strike), 2), round(valor_justo, 4)])
    return resultados


# ---------------------------------------------------------------------------
# Sidebar
# ---------------------------------------------------------------------------

st.sidebar.title("Simulação de Preços de Calls")
tipo_ativo = st.sidebar.selectbox("Selecione o tipo de ativo", list(ATIVOS.keys()))
tempo_desejado = st.sidebar.slider(
    "Para quantos dias você quer avaliar o preço?",
    min_value=1, max_value=180, value=30,
)
simular = st.sidebar.button("Simular")

# ---------------------------------------------------------------------------
# Main content
# ---------------------------------------------------------------------------

data, _, limite_inferior, limite_superior = carregar_dados(tipo_ativo)

st.subheader("Parâmetros históricos do ativo")
media_retornos = data["Daily Return"].mean()
std_retornos = data["Daily Return"].std()
preco_inicial = data["Close"].iloc[-1]

col1, col2, col3 = st.columns(3)
col1.metric("Retorno médio diário", f"{media_retornos:.4%}")
col2.metric("Volatilidade diária (std)", f"{std_retornos:.4%}")
col3.metric("Preço inicial", f"{float(preco_inicial):.4f}")

if simular:
    st.subheader(f"Preços das Calls — {tipo_ativo} — {tempo_desejado} dias")
    with st.spinner("Calculando preços das calls..."):
        resultados = simular_calls(tempo_desejado, data, limite_inferior, limite_superior)

    df = pd.DataFrame(resultados, columns=["Strike", "Preço Justo"])
    st.dataframe(df, use_container_width=True)

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.bar(df["Strike"], df["Preço Justo"], width=0.2, color="steelblue", alpha=0.8)
    ax.set_xlabel("Strike")
    ax.set_ylabel("Preço Justo da Call")
    ax.set_title(f"Curva de Preços de Calls — {tipo_ativo} ({tempo_desejado} dias)")
    ax.grid(axis="y")
    ax.grid(False, axis="x")
    st.pyplot(fig)
