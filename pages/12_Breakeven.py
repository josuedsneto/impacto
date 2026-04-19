import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go

from utils import require_login, show_logo


def _br(v, dec=2):
    return f"{abs(v):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")

st.set_page_config(page_title="Breakeven", page_icon="📈", layout="wide")
require_login()
show_logo()


def faturamento(variavel_parametro, valor_parametro, outras_variaveis):
    if variavel_parametro in ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol"]:
        return ((outras_variaveis["NY"] - 0.19) * 22.0462 * 1.04 * outras_variaveis["Câmbio"] * outras_variaveis["Prod VHP"]) + ((outras_variaveis["NY"] + 1) * 22.0462 * 0.75 * outras_variaveis["Câmbio"] * 12000) + outras_variaveis["Prod Etanol"] * outras_variaveis["Preço Etanol"] + 3227430 + 22061958
    elif variavel_parametro == "ATR":
        return 22061958 + (373613190 * valor_parametro) / 125.35
    elif variavel_parametro == "Moagem":
        return 22061958 + (373613190 * valor_parametro) / 1300000


def custo(variavel_parametro, valor_parametro, outras_variaveis, gasto_fixo_total, gasto_variavel_por_unidade):
    if variavel_parametro in ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol"]:
        return 0.6 * ((outras_variaveis["Prod Etanol"] * outras_variaveis["Preço Etanol"]) + ((outras_variaveis["NY"] + 1) * 22.0462 * 0.75 * outras_variaveis["Câmbio"] * 12000) + ((outras_variaveis["NY"] - 0.19) * 22.0462 * 1.04 * outras_variaveis["Câmbio"] * outras_variaveis["Prod VHP"])) + gasto_fixo_total + gasto_variavel_por_unidade * valor_parametro
    elif variavel_parametro == "ATR":
        return (0.6 * (380767714 * valor_parametro / 125)) + gasto_fixo_total + gasto_variavel_por_unidade * valor_parametro
    elif variavel_parametro == "Moagem":
        return (0.6 * (380767714 * valor_parametro / 1300000)) + gasto_fixo_total + gasto_variavel_por_unidade * valor_parametro


st.title("Break-even Analysis")
variavel_parametro = st.selectbox("Variável:", ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol", "ATR", "Moagem"])

st.subheader("Parâmetros de Custo")
gasto_fixo_total = st.number_input(
    "Gasto Fixo Total (R$):",
    value=152723235.0,
    step=1000000.0,
    format="%.0f",
    help="Soma dos custos fixos independentes do volume produzido"
)
gasto_variavel_por_unidade = st.number_input(
    "Gasto Variável por Unidade (R$/unidade):",
    value=0.0,
    step=1000.0,
    format="%.2f",
    help="Custo adicional por unidade produzida (aplicado sobre a produção variável)"
)

outras_variaveis = {}
for variavel in ["Prod VHP", "NY", "Câmbio", "Prod Etanol", "Preço Etanol", "ATR", "Moagem"]:
    if variavel != variavel_parametro:
        outras_variaveis[variavel] = st.number_input(f"{variavel}:", value=0.0)

if st.button("Gerar Gráfico"):
    if variavel_parametro == "NY":
        valores_parametro = np.linspace(15, 25, 100)
    elif variavel_parametro == "Câmbio":
        valores_parametro = np.linspace(4, 6, 100)
    elif variavel_parametro == "Prod VHP":
        valores_parametro = np.linspace(90000, 110000, 100)
    elif variavel_parametro == "Moagem":
        valores_parametro = np.linspace(1000000, 1500000, 100)
    elif variavel_parametro == "ATR":
        valores_parametro = np.linspace(115, 145, 100)
    elif variavel_parametro == "Prod Etanol":
        valores_parametro = np.linspace(25000, 50000, 100)
    elif variavel_parametro == "Preço Etanol":
        valores_parametro = np.linspace(2000, 4000, 100)
    else:
        valores_parametro = np.linspace(0, 5000, 100)

    faturamentos = []
    custos = []
    for valor_parametro in valores_parametro:
        outras_variaveis[variavel_parametro] = valor_parametro
        faturamentos.append(faturamento(variavel_parametro, valor_parametro, outras_variaveis))
        custos.append(custo(variavel_parametro, valor_parametro, outras_variaveis, gasto_fixo_total, gasto_variavel_por_unidade))

    idx_break_even = np.argmin(np.abs(np.array(faturamentos) - np.array(custos)))
    break_even_point = valores_parametro[idx_break_even]
    st.metric(f"Break-even — {variavel_parametro}", _br(break_even_point))

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=valores_parametro, y=faturamentos, mode='lines', name='Faturamento'))
    fig.add_trace(go.Scatter(x=valores_parametro, y=custos, mode='lines', name='Custo'))
    fig.add_vline(x=break_even_point, line_dash="dashdot", line_color="red",
                  annotation_text=f"Break-even: {_br(break_even_point)}", annotation_position="top right")
    fig.update_layout(
        title="Análise de Ponto de Equilíbrio",
        xaxis_title=variavel_parametro,
        yaxis_title="Valor (R$)",
        template="plotly_white",
        separators=",.",
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Heatmap NY × Câmbio ────────────────────────────────────────────────────
    st.subheader("Sensibilidade EBITDA: NY × Câmbio")
    prod_vhp_h  = outras_variaveis.get("Prod VHP",     90000.0)
    prod_eth_h  = outras_variaveis.get("Prod Etanol",  35000.0)
    preco_eth_h = outras_variaveis.get("Preço Etanol", 2800.0)

    ny_vals  = np.arange(14.0, 25.5, 0.5)
    cam_vals = np.arange(4.5,  6.15, 0.1)
    z = np.zeros((len(ny_vals), len(cam_vals)))
    for i, ny in enumerate(ny_vals):
        for j, cam in enumerate(cam_vals):
            fat_h = (
                (ny - 0.19) * 22.0462 * 1.04 * cam * prod_vhp_h
                + (ny + 1) * 22.0462 * 0.75 * cam * 12000
                + prod_eth_h * preco_eth_h
                + 3227430 + 22061958
            )
            cst_h = (
                0.6 * (
                    prod_eth_h * preco_eth_h
                    + (ny + 1) * 22.0462 * 0.75 * cam * 12000
                    + (ny - 0.19) * 22.0462 * 1.04 * cam * prod_vhp_h
                )
                + gasto_fixo_total
            )
            z[i, j] = (fat_h - cst_h) / 1_000_000  # R$ Mi

    text_h = [[f"R$ {v:.1f}Mi".replace(".", ",") for v in row] for row in z]
    fig_h = go.Figure(go.Heatmap(
        z=z,
        x=[f"{c:.1f}".replace(".", ",") for c in cam_vals],
        y=[f"{n:.1f}".replace(".", ",") for n in ny_vals],
        colorscale="RdYlGn",
        text=text_h,
        texttemplate="%{text}",
        showscale=True,
    ))
    fig_h.update_layout(
        title="EBITDA (R$ Mi) — NY (¢/lb) × Câmbio (R$/USD)",
        xaxis_title="Câmbio (R$/USD)",
        yaxis_title="NY (¢/lb)",
        height=550,
    )
    st.plotly_chart(fig_h, use_container_width=True)
    st.caption("Demais variáveis fixas nos valores informados acima. Gasto variável por unidade não considerado nesta sensibilidade.")

    # CSV export — faturamento/custo series
    df_export = pd.DataFrame({
        variavel_parametro: valores_parametro,
        'Faturamento (R$)': faturamentos,
        'Custo (R$)': custos,
    })
    csv_be = df_export.to_csv(index=False, sep=';', decimal=',').encode('utf-8-sig')
    st.download_button(
        label="Baixar CSV do Breakeven",
        data=csv_be,
        file_name=f"breakeven_{variavel_parametro.lower().replace(' ', '_')}.csv",
        mime="text/csv",
    )
