import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
from plotly.subplots import make_subplots

from utils import require_login, show_logo

st.set_page_config(page_title="ATR", page_icon="📈", layout="wide")
require_login()
show_logo()


@st.cache_data
def load_dados():
    df = pd.read_excel('Historico Impurezas.xlsx')
    df = df.dropna()
    df['Impureza Total'] = df['Impureza Vegetal'] + df['Impureza Mineral']
    return df


def treinar_modelos(df):
    from sklearn.linear_model import LinearRegression, Ridge
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.metrics import mean_squared_error, r2_score
    X = df[['Impureza Total', 'Pureza', 'Preciptação']]
    y = df['ATR']
    models = {
        "Regressão Linear": LinearRegression(),
        "Random Forest": RandomForestRegressor(n_estimators=100, random_state=42),
        "Ridge": Ridge(alpha=1.0)
    }
    resultados = {}
    for nome, model in models.items():
        model.fit(X, y)
        y_pred = model.predict(X)
        r2 = r2_score(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        resultados[nome] = {'model': model, 'R²': r2, 'RMSE': rmse, 'y_pred': y_pred}
    return resultados


def calcular_pureza_necessaria(ATR_desejado, estimativa_precipitacao, estimativa_impurezas, model):
    coef = model.coef_
    intercept = model.intercept_
    pureza_necessaria = (ATR_desejado - intercept - coef[0] * estimativa_impurezas - coef[2] * estimativa_precipitacao) / coef[1]
    return pureza_necessaria


def plotar_graficos_dispersao(df):
    fig = make_subplots(rows=1, cols=3, subplot_titles=('Impureza Total vs ATR', 'Pureza vs ATR', 'Preciptação vs ATR'))
    fig.add_trace(go.Scatter(x=df['Impureza Total'], y=df['ATR'], mode='markers', marker=dict(color='blue'), name='Impureza Total vs ATR'), row=1, col=1)
    fig.add_trace(go.Scatter(x=df['Pureza'], y=df['ATR'], mode='markers', marker=dict(color='red'), name='Pureza vs ATR'), row=1, col=2)
    fig.add_trace(go.Scatter(x=df['Preciptação'], y=df['ATR'], mode='markers', marker=dict(color='green'), name='Preciptação vs ATR'), row=1, col=3)
    fig.update_layout(title_text='Gráficos de Dispersão Comparativos', height=600, width=1200, showlegend=False)
    st.plotly_chart(fig)


def plotar_heatmap_atr(df):
    cols = ['ATR', 'Impureza Total', 'Pureza', 'Preciptação']
    corr = df[cols].corr()
    text = [[f"{v:.2f}".replace(".", ",") for v in row] for row in corr.values]
    fig = go.Figure(go.Heatmap(
        z=corr.values,
        x=corr.columns.tolist(),
        y=corr.index.tolist(),
        colorscale='RdBu',
        zmin=-1, zmax=1,
        text=text,
        texttemplate="%{text}",
        showscale=True,
    ))
    fig.update_layout(title="Matriz de Correlação — ATR")
    st.plotly_chart(fig)


st.title("Análise de ATR e Impurezas")
df = load_dados()
ATR_desejado = st.number_input("ATR Desejado:", min_value=0.0, value=130.0)
estimativa_precipitacao = st.number_input("Estimativa de Preciptação:", min_value=0.0, value=100.0)
estimativa_impurezas = st.number_input("Estimativa de Impurezas Totais:", min_value=0.0, value=18.0)

if st.button("Calcular"):
    resultados = treinar_modelos(df)
    st.subheader("Resultados dos Modelos")
    for nome, resultado in resultados.items():
        r2_fmt   = f"{resultado['R²']:.2f}".replace(".", ",")
        rmse_fmt = f"{resultado['RMSE']:.2f}".replace(".", ",")
        st.write(f"**{nome}** — R²: {r2_fmt}, RMSE: {rmse_fmt}")
    model_lr = resultados["Regressão Linear"]['model']
    pureza_necessaria = calcular_pureza_necessaria(ATR_desejado, estimativa_precipitacao, estimativa_impurezas, model_lr)
    pureza_fmt = f"{pureza_necessaria:.2f}".replace(".", ",")
    st.write(f'Para alcançar um ATR de {ATR_desejado}, com preciptação de {estimativa_precipitacao} e impurezas totais de {estimativa_impurezas}, é necessário uma pureza de aproximadamente {pureza_fmt}.')
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df.index, y=df['ATR'], mode='lines', name='Real', line=dict(color='blue')))
    fig.add_trace(go.Scatter(x=df.index, y=resultados['Random Forest']['y_pred'], mode='lines', name='Predito Random Forest', line=dict(dash='dash')))
    fig.update_layout(title='Valores Reais vs Preditos do ATR', xaxis_title='Índice', yaxis_title='ATR')
    st.plotly_chart(fig)
    st.subheader("Gráficos de Dispersão Comparativos")
    plotar_graficos_dispersao(df)
    st.subheader("Heatmap de Correlação")
    plotar_heatmap_atr(df)
    st.subheader("Explicabilidade das Variáveis")
    st.markdown("""
    <span style='color: red'>Explicabilidade de 'Impureza Total': baixa</span><br>
    <span style='color: green'>Explicabilidade de 'Pureza': alta</span><br>
    <span style='color: yellow'>Explicabilidade de 'Preciptação': moderada</span>
    """, unsafe_allow_html=True)
