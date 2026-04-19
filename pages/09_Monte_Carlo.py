import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import yfinance as yf
from datetime import date
from pandas.tseries.offsets import BDay

from utils import require_login, show_logo


def _br(v, dec=2):
    """Formata número no padrão brasileiro (vírgula decimal, ponto milhar)."""
    return f"{abs(v):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")

st.set_page_config(page_title="Monte Carlo", page_icon="📈", layout="wide")
require_login()
show_logo()


@st.cache_data(ttl=3600)
def baixar_dados_mc(ativo: str) -> pd.DataFrame:
    start_date = date(2013, 1, 1)
    end_date = date.today().strftime("%Y-%m-%d")
    data = yf.download(ativo, start=start_date, end=end_date, multi_level_index=False, auto_adjust=True, progress=False)
    data["Daily Return"] = data["Close"].pct_change()
    return data


def simulacao_monte_carlo(preco_inicial, drift, std, dias_simulados, num_simulacoes, limite_inferior, limite_superior):
    # drift = mu - 0.5*sigma^2 (correção log-normal para GBM não tendencioso)
    retornos = np.random.normal(drift, std, (dias_simulados, num_simulacoes))
    fator = np.cumprod(1 + retornos, axis=0)
    precos_simulados = np.clip(preco_inicial * fator, limite_inferior, limite_superior)
    return precos_simulados


def calcular_dias_uteis(data_inicial, data_final):
    datas_uteis = pd.date_range(start=data_inicial, end=data_final, freq=BDay())
    return len(datas_uteis)


st.title("Simulação Monte Carlo de Preços")
tipo_ativo = st.selectbox("Selecione o tipo de ativo", ["Açúcar", "Dólar"])
ativo = "SB=F" if tipo_ativo == "Açúcar" else "USDBRL=X"

data = baixar_dados_mc(ativo)
media_retornos_diarios = data['Daily Return'].mean()
desvio_padrao_retornos_diarios = data['Daily Return'].std()
# Correção log-normal: drift GBM = mu - 0.5*sigma^2
# Sem essa correção, a mediana simulada desvia sistematicamente do preço atual
drift_gbm = media_retornos_diarios - 0.5 * desvio_padrao_retornos_diarios ** 2

data_simulacao = st.date_input("Selecione a data para simulação", value=pd.to_datetime('today') + pd.offsets.BDay(30))
hoje = pd.to_datetime('today').date()
dias_simulados = calcular_dias_uteis(hoje, data_simulacao)

preco_atual = float(data['Close'].dropna().iloc[-1])
if "valor_simulado_mc" not in st.session_state:
    st.session_state["valor_simulado_mc"] = preco_atual
valor_simulado = st.number_input("Qual valor deseja simular?", value=st.session_state["valor_simulado_mc"], step=0.01)
valor_posicao = st.number_input(
    "Valor da posição (opcional — para calcular impacto financeiro):",
    min_value=0.0, step=1000.0, value=0.0,
    help="Informe o valor em R$ da sua posição para ver o impacto financeiro nos cenários P5/P50/P95.",
)
PCT_BOUND = 0.50
limite_inferior = preco_atual * (1 - PCT_BOUND)
limite_superior = preco_atual * (1 + PCT_BOUND)

if dias_simulados <= 0:
    st.warning("A data de simulação deve ser posterior a hoje.")
    st.stop()

if st.button("Simular"):
    simulacoes = simulacao_monte_carlo(valor_simulado, drift_gbm, desvio_padrao_retornos_diarios, dias_simulados, 10000, limite_inferior, limite_superior)
    percentil_5  = np.percentile(simulacoes[-1], 5)
    percentil_50 = np.percentile(simulacoes[-1], 50)
    percentil_95 = np.percentile(simulacoes[-1], 95)
    prob_acima_valor  = np.mean(simulacoes[-1] > valor_simulado) * 100
    prob_abaixo_valor = np.mean(simulacoes[-1] < valor_simulado) * 100
    days = np.arange(1, dias_simulados + 1)
    p5  = np.percentile(simulacoes, 5,  axis=1)
    p25 = np.percentile(simulacoes, 25, axis=1)
    p50 = np.percentile(simulacoes, 50, axis=1)
    p75 = np.percentile(simulacoes, 75, axis=1)
    p95 = np.percentile(simulacoes, 95, axis=1)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=days, y=p95, line=dict(width=0), showlegend=False))
    fig.add_trace(go.Scatter(x=days, y=p5,  fill='tonexty', fillcolor='rgba(70,130,180,0.15)', line=dict(width=0), name='P5–P95'))
    fig.add_trace(go.Scatter(x=days, y=p75, line=dict(width=0), showlegend=False))
    fig.add_trace(go.Scatter(x=days, y=p25, fill='tonexty', fillcolor='rgba(70,130,180,0.30)', line=dict(width=0), name='P25–P75'))
    fig.add_trace(go.Scatter(x=days, y=p50, line=dict(color='steelblue', width=2), name='Mediana (P50)'))
    fig.update_layout(
        title=f'Simulação Monte Carlo — {tipo_ativo}',
        xaxis_title='Dias Úteis',
        yaxis_title='Preço',
        separators=",.",
    )
    st.plotly_chart(fig)

    delta_p5  = percentil_5  - preco_atual
    delta_p50 = percentil_50 - preco_atual
    delta_p95 = percentil_95 - preco_atual

    st.subheader("Resultados da Simulação")
    col1, col2, col3, col4, col5 = st.columns(5)
    col1.metric(
        "P5 (pessimista)", _br(percentil_5),
        delta=f"{'-' if delta_p5 < 0 else '+'}{_br(abs(delta_p5))} vs atual",
        delta_color="normal",
    )
    col2.metric(
        "P50 (mediana)", _br(percentil_50),
        delta=f"{'+' if delta_p50 >= 0 else ''}{_br(delta_p50)} vs atual",
        delta_color="normal",
    )
    col3.metric(
        "P95 (otimista)", _br(percentil_95),
        delta=f"+{_br(delta_p95)} vs atual",
        delta_color="normal",
    )
    col4.metric(
        f"Prob. acima de {_br(valor_simulado)}",
        f"{_br(prob_acima_valor, 1)}%",
    )
    col5.metric(
        f"Prob. abaixo de {_br(valor_simulado)}",
        f"{_br(prob_abaixo_valor, 1)}%",
    )

    st.caption(f"Preço atual ({tipo_ativo}): **{_br(preco_atual)}** | Horizonte: **{dias_simulados}** dias úteis")

    # Exportar para uso no Teste de Estresse
    st.session_state["mc_resultado"] = {
        "tipo": tipo_ativo,
        "p5": percentil_5,
        "p50": percentil_50,
        "p95": percentil_95,
        "preco_atual": preco_atual,
    }
    if tipo_ativo == "Dólar":
        st.info("Valores P5/P50/P95 disponíveis para importar na página **Teste de Estresse**.")

    if valor_posicao > 0:
        st.subheader("Impacto Financeiro da Posição")
        imp_p5  = (percentil_5  - preco_atual) / preco_atual * valor_posicao
        imp_p50 = (percentil_50 - preco_atual) / preco_atual * valor_posicao
        imp_p95 = (percentil_95 - preco_atual) / preco_atual * valor_posicao
        c1, c2, c3 = st.columns(3)
        c1.metric("Impacto P5",  f"R$ {_br(imp_p5)}",  delta_color="inverse" if imp_p5 < 0 else "normal")
        c2.metric("Impacto P50", f"R$ {_br(imp_p50)}", delta_color="normal")
        c3.metric("Impacto P95", f"R$ {_br(imp_p95)}", delta_color="normal")

    hist_data = simulacoes[-1]
    fig_hist = go.Figure()
    fig_hist.add_trace(go.Histogram(
        x=hist_data, nbinsx=100, histnorm='probability',
        marker_color='rgba(0,128,128,0.6)', opacity=0.75,
    ))
    fig_hist.add_vline(x=percentil_5,  line_dash="dash", line_color="red",       annotation_text="P5")
    fig_hist.add_vline(x=percentil_50, line_dash="dash", line_color="steelblue", annotation_text="P50")
    fig_hist.add_vline(x=percentil_95, line_dash="dash", line_color="green",     annotation_text="P95")
    fig_hist.update_layout(
        title="Distribuição dos Preços Simulados no Horizonte",
        xaxis_title="Preço Simulado",
        yaxis_title="Frequência Relativa",
        separators=",.",
    )
    st.plotly_chart(fig_hist)

    # CSV export — percentile series
    df_export = pd.DataFrame({
        'Dia': days,
        'P5': p5,
        'P25': p25,
        'P50': p50,
        'P75': p75,
        'P95': p95,
    })
    csv_mc = df_export.to_csv(index=False, sep=';', decimal=',').encode('utf-8-sig')
    st.download_button(
        label="Baixar CSV da Simulação",
        data=csv_mc,
        file_name=f"monte_carlo_{tipo_ativo.lower()}.csv",
        mime="text/csv",
    )
