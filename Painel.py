import streamlit as st
from utils import require_login, show_logo, get_prices_title

st.set_page_config(page_title="IBEA — Gestão de Risco", page_icon="📈", layout="wide")

require_login()
show_logo()

st.title("Painel Principal — Gestão de Risco")

# --- Live price tiles ---
dolar, acucar, petroleo = get_prices_title()

col1, col2, col3 = st.columns(3)
with col1:
    if dolar is not None:
        st.metric("Dólar (USD/BRL)", f"R$ {dolar:.4f}")
    else:
        st.metric("Dólar (USD/BRL)", "—")
with col2:
    if acucar is not None:
        st.metric("Açúcar NY #11 (¢/lb)", f"{acucar:.2f}")
    else:
        st.metric("Açúcar NY #11 (¢/lb)", "—")
with col3:
    if petroleo is not None:
        st.metric("Petróleo WTI ($/bbl)", f"{petroleo:.2f}")
    else:
        st.metric("Petróleo WTI ($/bbl)", "—")

st.divider()

# --- Page index ---
st.subheader("Módulos disponíveis")

pages = [
    ("01 — Introdução", "Visão geral e instruções de uso da plataforma."),
    ("02 — ATR", "Average True Range — medida de volatilidade histórica."),
    ("03 — Metas", "Definição e acompanhamento de metas de preço."),
    ("04 — Regressão Dólar", "Modelo de regressão para projeção do câmbio USD/BRL."),
    ("05 — Regressão Açúcar", "Modelo de regressão para projeção do açúcar NY #11."),
    ("06 — Volatilidade", "Análise de volatilidade histórica e implícita."),
    ("07 — Jump Diffusion", "Simulação com saltos estocásticos (modelo Merton)."),
    ("08 — Simulação Opções", "Precificação de opções via simulação Monte Carlo."),
    ("09 — Monte Carlo", "Simulação de trajetórias de preço (fan chart P5–P95)."),
    ("10 — Mercado", "Dados de mercado e indicadores técnicos em tempo real."),
    ("11 — Risco", "Análise de risco de carteira e exposição cambial."),
    ("12 — Breakeven", "Cálculo de ponto de equilíbrio operacional."),
    ("13 — Black-Scholes", "Precificação analítica de opções europeias (BSM)."),
    ("14 — Cenários", "Construção e comparação de cenários de preço."),
    ("15 — VaR", "Value at Risk — estimativa de perda máxima esperada."),
    ("16 — Relatório Focus", "Expectativas do mercado (Boletim Focus/BCB)."),
    ("17 — Expectativa Focus", "Evolução histórica das projeções do Boletim Focus."),
    ("18 — Teste de Stress", "Simulação de cenários extremos de mercado."),
    ("19 — Less Loss", "Estratégias de mitigação de perdas."),
    ("20 — ARIMA Açúcar", "Projeção de preço de açúcar via modelo ARIMA."),
    ("21 — ARIMA Dólar", "Projeção de câmbio via modelo ARIMA."),
    ("22 — Notícias", "Feed de notícias de commodities e câmbio."),
    ("23 — Opções", "Tabela de prêmios e gráfico de calls europeias por strike."),
]

cols = st.columns(2)
for i, (title, desc) in enumerate(pages):
    with cols[i % 2]:
        st.markdown(f"**{title}**  \n{desc}")

st.divider()
st.caption("Dados fornecidos via yfinance. Preços com delay padrão de mercado.")
