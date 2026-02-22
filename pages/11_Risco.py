import streamlit as st
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from utils import require_login, show_logo

st.set_page_config(page_title="Risco", page_icon="📈", layout="wide")
require_login()
show_logo()


def calcular_faturamento(vhp_total, ny, cambio, preco_cbios, preco_etanol):
    acucar = ((ny - 0.19) * 22.0462 * 1.04 * cambio) * vhp_total + 17283303
    etanol = preco_etanol * 35524
    cjm = 24479549
    cbios = preco_cbios * 31616
    return acucar + etanol + cjm + cbios


def calcular_custo(faturamento, moagem_total, atr, preco_cbios):
    atr_mtm = 0.6 * (faturamento - preco_cbios) / (moagem_total * atr)
    cana_acucar_atr = atr_mtm * moagem_total * atr
    gastos_variaveis = 32947347 + cana_acucar_atr
    gastos_fixos = 109212811
    return gastos_fixos + gastos_variaveis


def simulacao_monte_carlo_risco(valores_medios, perc_15, perc_85, num_simulacoes):
    faturamentos = []
    custos = []
    for _ in range(num_simulacoes):
        moagem_total_simulado = np.random.normal(valores_medios['Moagem Total']['Valor Médio'], (perc_85['Moagem Total']['Percentil 85'] - perc_15['Moagem Total']['Percentil 15']) / 2)
        atr_simulado = np.random.normal(valores_medios['ATR']['Valor Médio'], (perc_85['ATR']['Percentil 85'] - perc_15['ATR']['Percentil 15']) / 2)
        vhp_total_simulado = np.random.normal(valores_medios['VHP Total']['Valor Médio'], (perc_85['VHP Total']['Percentil 85'] - perc_15['VHP Total']['Percentil 15']) / 2)
        ny_simulado = np.random.normal(valores_medios['NY']['Valor Médio'], (perc_85['NY']['Percentil 85'] - perc_15['NY']['Percentil 15']) / 2)
        cambio_simulado = np.random.normal(valores_medios['Câmbio']['Valor Médio'], (perc_85['Câmbio']['Percentil 85'] - perc_15['Câmbio']['Percentil 15']) / 2)
        preco_cbios_simulado = np.random.normal(valores_medios['Preço CBIOS']['Valor Médio'], (perc_85['Preço CBIOS']['Percentil 85'] - perc_15['Preço CBIOS']['Percentil 15']) / 2)
        preco_etanol_simulado = np.random.normal(valores_medios['Preço Etanol']['Valor Médio'], (perc_85['Preço Etanol']['Percentil 85'] - perc_15['Preço Etanol']['Percentil 15']) / 2)
        fat = calcular_faturamento(vhp_total_simulado, ny_simulado, cambio_simulado, preco_cbios_simulado, preco_etanol_simulado)
        faturamentos.append(fat)
        custos.append(calcular_custo(fat, moagem_total_simulado, atr_simulado, preco_cbios_simulado))
    return faturamentos, custos


def plot_histograma(resultados, titulo, cor):
    fig, ax = plt.subplots(figsize=(10, 6))
    sns.histplot(resultados, bins=50, kde=True, color=cor, ax=ax)
    ax.set_xlabel('Valor (R$)')
    ax.set_ylabel('Frequência')
    ax.set_title(titulo)
    ax.grid(True)
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: 'R$ {:,.0f}M'.format(x/1_000_000)))
    plt.tight_layout()
    st.pyplot(fig)


st.title("IBEA - Simulações de Desempenho SF 2024/2025")
st.subheader("Inputs")
col1, col2, col3 = st.columns(3)
inputs = {
    'Moagem Total': {'Valor Médio': col1.number_input('Moagem Total - Valor Médio', value=1300000), 'Percentil 15': col2.number_input('Moagem Total - Percentil 15', value=1100000), 'Percentil 85': col3.number_input('Moagem Total - Percentil 85', value=1500000)},
    'ATR': {'Valor Médio': col1.number_input('ATR - Valor Médio', value=125), 'Percentil 15': col2.number_input('ATR - Percentil 15', value=120), 'Percentil 85': col3.number_input('ATR - Percentil 85', value=130)},
    'VHP Total': {'Valor Médio': col1.number_input('VHP Total - Valor Médio', value=97000), 'Percentil 15': col2.number_input('VHP Total - Percentil 15', value=94000), 'Percentil 85': col3.number_input('VHP Total - Percentil 85', value=100000)},
    'NY': {'Valor Médio': col1.number_input('NY - Valor Médio', value=21), 'Percentil 15': col2.number_input('NY - Percentil 15', value=18), 'Percentil 85': col3.number_input('NY - Percentil 85', value=24)},
    'Câmbio': {'Valor Médio': col1.number_input('Câmbio - Valor Médio', value=5.1), 'Percentil 15': col2.number_input('Câmbio - Percentil 15', value=4.9), 'Percentil 85': col3.number_input('Câmbio - Percentil 85', value=5.3)},
    'Preço CBIOS': {'Valor Médio': col1.number_input('Preço CBIOS - Valor Médio', value=90), 'Percentil 15': col2.number_input('Preço CBIOS - Percentil 15', value=75), 'Percentil 85': col3.number_input('Preço CBIOS - Percentil 85', value=105)},
    'Preço Etanol': {'Valor Médio': col1.number_input('Preço Etanol - Valor Médio', value=3000), 'Percentil 15': col2.number_input('Preço Etanol - Percentil 15', value=2500), 'Percentil 85': col3.number_input('Preço Etanol - Percentil 85', value=3500)},
}

if st.button("Simular"):
    faturamentos, custos = simulacao_monte_carlo_risco(inputs, inputs, inputs, 10000)
    st.subheader("Faturamento")
    plot_histograma(faturamentos, "Distribuição de Frequência do Faturamento Total", "skyblue")
    percentis_desejados = [1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 99]
    st.write(f"**Faturamento Médio:** R$ {np.mean(faturamentos):,.2f}")
    df_fat = pd.DataFrame({'Percentil': percentis_desejados, 'Faturamento': [np.percentile(faturamentos, p) for p in percentis_desejados]})
    st.dataframe(df_fat)
    st.subheader("Custo")
    plot_histograma(custos, "Distribuição de Frequência do Custo Total", "orange")
    st.write(f"**Custo Médio:** R$ {np.mean(custos):,.2f}")
    ebtida_ajustado = [f - c + 7219092 for f, c in zip(faturamentos, custos)]
    st.subheader("Ebtida Ajustado")
    plot_histograma(ebtida_ajustado, "Distribuição de Frequência do Ebtida Ajustado", "lightgreen")
    st.write(f"**Ebtida Ajustado Médio:** R$ {np.mean(ebtida_ajustado):,.2f}")
