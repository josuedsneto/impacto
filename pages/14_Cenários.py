import streamlit as st
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import scipy.stats as stats

from utils import require_login, show_logo

st.set_page_config(page_title="Cenários", page_icon="📈", layout="wide")
require_login()
show_logo()


def calcular_ebtida_ajustado(Moagem, Cambio, Preco_Etanol, NY):
    VHP = (89.45 * 0.8346 * Moagem) / 1000
    Etanol = (0.1654 * 80.18 * Moagem + 327.19 * 60075) / 1000
    Faturamento = (VHP - 4047) * (NY - 0.19) * 22.0462 * 1.04 * Cambio + (Etanol - 1000) * (Preco_Etanol + 349.83) * 0.96 + 3227430 + 22061958 + 12000 * (NY + 1) * 22.0462 * 0.75 * Cambio
    Custo = 0.6 * 0.93 * ((VHP - 4047) * (NY - 0.19) * 22.0462 * 1.04 * Cambio + (Etanol - 1000) * (Preco_Etanol + 349.83) * 0.96 + 12000 * (NY + 1) * 22.0462 * 0.75 * Cambio) + 88704735 + 43732035 + 20286465
    return Faturamento - Custo


def encontrar_break_even(opcao, NY, Moagem, Cambio, Preco_Etanol):
    if opcao == "Moagem":
        while calcular_ebtida_ajustado(Moagem, Cambio, Preco_Etanol, NY) <= 0:
            Moagem += 1000
        return Moagem
    elif opcao == "Preço Etanol":
        while calcular_ebtida_ajustado(Moagem, Cambio, Preco_Etanol, NY) <= 0:
            Preco_Etanol += 0.01
        return Preco_Etanol
    elif opcao == "Câmbio":
        while calcular_ebtida_ajustado(Moagem, Cambio, Preco_Etanol, NY) <= 0:
            Cambio += 0.01
        return Cambio
    elif opcao == "NY":
        while calcular_ebtida_ajustado(Moagem, Cambio, Preco_Etanol, NY) <= 0:
            NY += 0.01
        return NY


def probabilidade_abaixo_break_even(valor, media, percentil):
    desvio_padrao = (percentil - media) / stats.norm.ppf(0.8)
    return stats.norm.cdf(valor, loc=media, scale=desvio_padrao)


def calcular_percentis(break_even, media, desvio_padrao):
    return [(i, stats.norm.ppf(i/100, loc=media, scale=desvio_padrao)) for i in range(5, 101, 5)]


def plotar_grafico_distribuicao(break_even, media, desvio_padrao):
    plt.figure(figsize=(10, 6))
    x = np.linspace(media - 3*desvio_padrao, media + 3*desvio_padrao, 1000)
    y = stats.norm.pdf(x, loc=media, scale=desvio_padrao)
    plt.plot(x, y, color='blue', label='Distribuição de Probabilidade')
    plt.axvline(x=break_even, color='black', linestyle='--', label='Break-even')
    plt.fill_between(x, y, where=(x < break_even), color='red', alpha=0.3)
    plt.fill_between(x, y, where=(x >= break_even), color='green', alpha=0.3)
    plt.title('Distribuição de Probabilidade')
    plt.xlabel('Valor')
    plt.ylabel('Densidade')
    plt.legend()
    st.pyplot(plt)


st.title("Cenários")
opcao = st.selectbox("Opção desejada", ("Moagem", "Preço Etanol", "Câmbio", "NY"))

if opcao == "Moagem":
    NY = st.number_input("Valor de NY", value=20.0)
    Preco_Etanol = st.number_input("Valor do Preço Etanol")
    Cambio = st.number_input("Preço do Cambio")
    if st.button("Simular"):
        be = encontrar_break_even(opcao, NY, 0, Cambio, Preco_Etanol)
        prob = probabilidade_abaixo_break_even(be, 1300000, (1400000 - 1300000) / stats.norm.ppf(0.8))
        st.write(f"Breakeven: {be:.2f} | Risco: {prob*100:.2f}%")
        plotar_grafico_distribuicao(be, 1300000, (1400000 - 1300000) / stats.norm.ppf(0.8))
        percentis = calcular_percentis(be, 1300000, (1400000 - 1300000) / stats.norm.ppf(0.8))
        df = pd.DataFrame(percentis, columns=["Percentil", "Valor"])
        df["Cor"] = np.where(df["Valor"] >= be, "green", "red")
        st.dataframe(df.set_index("Percentil"))

elif opcao == "Preço Etanol":
    NY = st.number_input("Valor de NY", value=20.0)
    Moagem = st.number_input("Valor da Moagem")
    Cambio = st.number_input("Preço do Cambio")
    if st.button("Simular"):
        be = encontrar_break_even(opcao, NY, Moagem, Cambio, 0)
        prob = probabilidade_abaixo_break_even(be, 2768.90, 3000.28)
        st.write(f"Breakeven: {be:.2f} | Risco: {prob*100:.2f}%")
        plotar_grafico_distribuicao(be, 2768.90, (3000.28 - 2768.90) / stats.norm.ppf(0.7))
        percentis = calcular_percentis(be, 2768.90, (3000.28 - 2768.90) / stats.norm.ppf(0.7))
        df = pd.DataFrame(percentis, columns=["Percentil", "Valor"])
        df["Cor"] = np.where(df["Valor"] >= be, "green", "red")
        st.dataframe(df.set_index("Percentil"))

elif opcao == "Câmbio":
    NY = st.number_input("Valor de NY", value=20.0)
    Moagem = st.number_input("Valor da Moagem")
    Preco_Etanol = st.number_input("Preço do Etanol")
    if st.button("Simular"):
        be = encontrar_break_even(opcao, NY, Moagem, 0, Preco_Etanol)
        prob = probabilidade_abaixo_break_even(be, 5.2504, 5.4293)
        st.write(f"Breakeven: {be:.2f} | Risco: {prob*100:.2f}%")
        plotar_grafico_distribuicao(be, 5.2504, (5.4293 - 5.1904) / stats.norm.ppf(0.8))

elif opcao == "NY":
    Moagem = st.number_input("Valor da Moagem")
    Cambio = st.number_input("Preço do Cambio")
    Preco_Etanol = st.number_input("Preço do Etanol")
    if st.button("Simular"):
        be = encontrar_break_even(opcao, 0, Moagem, Cambio, Preco_Etanol)
        prob = probabilidade_abaixo_break_even(be, 20.5572, 22.3796)
        st.write(f"Breakeven: {be:.2f} | Risco: {prob*100:.2f}%")
        plotar_grafico_distribuicao(be, 20.5572, (22.3796 - 20.5572) / stats.norm.ppf(0.8))
