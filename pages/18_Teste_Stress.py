import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go

from utils import require_login, show_logo


def _br(v, dec=2):
    return f"{abs(v):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")

st.set_page_config(page_title="Teste de Stress", page_icon="📈", layout="wide")
require_login()
show_logo()

st.title("Teste de Estresse: Impacto Financeiro vs. Dólar")

# ── Importar P50 do Monte Carlo se disponível ─────────────────────────────────
_mc = st.session_state.get("mc_resultado", {})
if _mc.get("tipo") == "Dólar" and "p50" in _mc:
    if "stress_venda_media" not in st.session_state:
        st.session_state["stress_venda_media"] = 0.0
    col_info, col_btn = st.columns([4, 1])
    col_info.caption(
        f"Monte Carlo (Dólar) disponível — P5: {_br(_mc['p5'])} | "
        f"P50: {_br(_mc['p50'])} | P95: {_br(_mc['p95'])}"
    )
    if col_btn.button(f"Importar P50 ({_br(_mc['p50'])})"):
        st.session_state["stress_venda_media"] = _mc["p50"]
        st.rerun()

if "stress_venda_media" not in st.session_state:
    st.session_state["stress_venda_media"] = 0.0

venda_media = st.number_input(
    "Valor da venda média do Dólar (R$):",
    min_value=0.0, step=0.01, format="%.2f",
    key="stress_venda_media",
)
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

    # ── Métricas de resumo ─────────────────────────────────────────────────────
    max_ganho = float(impactos.max())
    max_perda = float(impactos.min())
    n_positivos = int(np.sum(impactos > 0))
    n_total = len(impactos)
    # Break-even: valor hipotético onde impacto = 0 → venda_media
    breakeven = venda_media

    st.subheader("Resumo do Estresse")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Ganho máximo", f"R$ {_br(max_ganho)}", help=f"Dólar em R$ {_br(min_hipotetico)}")
    c2.metric("Perda máxima",  f"R$ {_br(abs(max_perda))}", delta=f"-R$ {_br(abs(max_perda))}", delta_color="inverse", help=f"Dólar em R$ {_br(max_hipotetico)}")
    c3.metric("Break-even (Dólar)", f"R$ {_br(breakeven)}", help="Dólar igual à venda média — impacto zero")
    c4.metric("Cenários favoráveis", f"{n_positivos}/{n_total}", help="Número de cenários com impacto positivo")

    def fmt_brl(x):
        return f"R$ {_br(x)}"

    df = pd.DataFrame({'Valor Hipotético (R$)': valores_hipoteticos, 'Impacto (R$)': impactos})
    st.dataframe(
        df.style.format({'Valor Hipotético (R$)': fmt_brl, 'Impacto (R$)': fmt_brl}),
        use_container_width=True,
    )
    fig = go.Figure(go.Bar(
        x=df['Impacto (R$)'],
        y=[f'R$ {_br(x)}' for x in df['Valor Hipotético (R$)']],
        orientation='h',
        marker=dict(color=df['Impacto (R$)'], colorscale='RdYlGn_r'),
    ))
    fig.update_layout(
        title='Teste de Estresse: Impacto Financeiro vs. Dólar',
        xaxis_title='Impacto Financeiro (R$)',
        yaxis_title='Valor do Dólar (R$)',
        template="plotly_white",
        separators=",.",
    )
    st.plotly_chart(fig)
