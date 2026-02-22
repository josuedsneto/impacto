import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import plotly.subplots as sp
import matplotlib.pyplot as plt
import seaborn as sns

from utils import require_login, show_logo

st.set_page_config(page_title="Regressão Dólar", page_icon="📈", layout="wide")
require_login()
show_logo()


def load_and_transform_data(file_path):
    from sklearn.preprocessing import MinMaxScaler
    df = pd.read_excel(file_path)
    df['Oferta Moeda Brasileira - M2'] = df['Oferta Moeda Brasileira - M2'] / 1000
    df['Juros Brasileiros(%)'] = df['Juros Brasileiros(%)'] / 100
    df['Juros Americanos(%)'] = df['Juros Americanos(%)'] / 100
    df_transformed = df.copy()
    df_transformed['Razao_Juros'] = df['Juros Americanos(%)'] / df['Juros Brasileiros(%)']
    df_transformed['Log_Razao_Juros'] = np.log(df_transformed['Razao_Juros'])
    df_transformed['Dif_Prod_Industrial'] = df['Prod Industrial Americana'] - df['Prod Industrial brasileira']
    df_transformed['Dif_Oferta_Moeda'] = df['Oferta Moeda Americana - M2'] - df['Oferta Moeda Brasileira - M2']
    df_transformed = df_transformed[['Data', 'Log_Razao_Juros', 'Dif_Prod_Industrial', 'Dif_Oferta_Moeda', 'Taxa de Câmbio']]
    df_transformed.set_index('Data', inplace=True)
    return df_transformed


def prever_taxa_cambio(model, juros_br, juros_eua, prod_ind_br, prod_ind_eua, oferta_moeda_br, oferta_moeda_eua):
    razao_juros = juros_eua / juros_br
    log_razao_juros = np.log(razao_juros)
    dif_prod_industrial = prod_ind_eua - prod_ind_br
    dif_oferta_moeda = oferta_moeda_eua - (oferta_moeda_br / 1000)
    X_novo = pd.DataFrame({'Log_Razao_Juros': [log_razao_juros], 'Dif_Prod_Industrial': [dif_prod_industrial], 'Dif_Oferta_Moeda': [dif_oferta_moeda]})
    return model.predict(X_novo)[0]


st.title("Previsão da Taxa de Câmbio")
st.write("Insira as premissas abaixo e clique em 'Gerar Regressão' para prever a taxa de câmbio.")

juros_br_proj = st.number_input("Taxa de Juros Brasileira (%)", value=10.56) / 100
juros_eua_proj = st.number_input("Taxa de Juros Americana (%)", value=5.33) / 100
prod_ind_br_proj = st.number_input("Produção Industrial Brasileira", value=103.8)
prod_ind_eua_proj = st.number_input("Produção Industrial Americana", value=103.3)
oferta_moeda_br_proj = st.number_input("Oferta de Moeda Brasileira - M2 (em milhões)", value=5014000)
oferta_moeda_eua_proj = st.number_input("Oferta de Moeda Americana - M2 (em bilhões)", value=20841)

if st.button("Gerar Regressão"):
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import mean_squared_error, r2_score
    import statsmodels.api as sm

    df_transformed = load_and_transform_data('dadosReg.xls')
    X = df_transformed[['Log_Razao_Juros', 'Dif_Prod_Industrial', 'Dif_Oferta_Moeda']]
    y = df_transformed['Taxa de Câmbio']
    model = LinearRegression()
    model.fit(X, y)
    y_pred = model.predict(X)
    mse = mean_squared_error(y, y_pred)
    r2 = r2_score(y, y_pred)
    coefficients = model.coef_
    taxa_cambio_prevista = prever_taxa_cambio(model, juros_br_proj, juros_eua_proj, prod_ind_br_proj, prod_ind_eua_proj, oferta_moeda_br_proj, oferta_moeda_eua_proj)
    st.write(f'Taxa de câmbio prevista: {taxa_cambio_prevista:.4f}')
    st.write(f"Erro Quadrático Médio (MSE): {mse:.4f}")
    st.write(f"Coeficiente de Determinação (R²): {r2:.4f}")
    df_with_target = X.copy()
    df_with_target['Taxa de Câmbio'] = y
    corr_matrix = df_with_target.corr()
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', fmt='.2f', linewidths=0.5, ax=ax)
    st.pyplot(fig)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df_transformed.index, y=y, mode='lines', name='Valor Real'))
    fig.add_trace(go.Scatter(x=df_transformed.index, y=y_pred, mode='lines', name='Valor Predito'))
    fig.update_layout(title='Valor Real vs Valor Predito', xaxis_title='Data', yaxis_title='Taxa de Câmbio')
    st.plotly_chart(fig)
