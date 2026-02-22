import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import plotly.subplots as sp

from utils import require_login, show_logo

st.set_page_config(page_title="Regressão Açúcar", page_icon="📈", layout="wide")
require_login()
show_logo()


def revert_log_diff(base_value, log_diff_value):
    return base_value * np.exp(log_diff_value)


@st.cache_data
def load_and_transform_data_sugar(file_path):
    df = pd.read_excel(file_path)
    if 'Ano safra' in df.columns:
        df['Ano safra'] = df['Ano safra'].astype(str).str[-4:]
        df['Ano safra'] = pd.to_datetime(df['Ano safra'], format='%Y', errors='coerce')
        if df['Ano safra'].isna().any():
            df = df.dropna(subset=['Ano safra'])
    df['Log_Diferencial_Estoque'] = np.log(df['Estoque Final (mi)'] / df['Estoque Inicial(mi)'])
    df['Log_Diferencial_Oferta_Demanda'] = np.log(df['Produção (mi)'] / df['Demanda(mi)'])
    df['Log_Estoque_Uso'] = np.log(df['Estoque Uso(%)'])
    df['Dif_Log_USDBRL'] = np.log(df['USDBRL=X']).diff()
    df['Dif_Log_SB_F'] = np.log(df['SB=F']).diff()
    df['Dif_Log_CL_F'] = np.log(df['CL=F']).diff()
    df = df.dropna()
    return df


st.title("Previsão do Preço do Açúcar")
st.write("Modelo de regressão para prever o preço futuro do açúcar (SB=F).")

estoque_inicial_proj = st.number_input("Estoque Inicial (mi)", value=45000)
estoque_final_proj = st.number_input("Estoque Final (mi)", value=40000)
oferta_proj = st.number_input("Oferta/Production (mi)", value=160000)
demanda_proj = st.number_input("Demanda (mi)/Human Dom. Consumption", value=150000)
estoque_uso_proj = st.number_input("Estoque/Uso (%) Estoque final/Demanda * 100", value=20)
usd_brl_proj = st.number_input("USDBRL=X", value=6.0)
cl_f_proj = st.number_input("CL=F", value=75.0)

if st.button("Gerar Previsão"):
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.metrics import mean_squared_error, r2_score

    df = load_and_transform_data_sugar('dadosRegSugar.xlsx')
    X = df[['Log_Diferencial_Estoque', 'Log_Diferencial_Oferta_Demanda', 'Log_Estoque_Uso', 'Dif_Log_USDBRL', 'Dif_Log_CL_F']]
    y = df['Dif_Log_SB_F']
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X, y)
    y_pred = model.predict(X)
    mse = mean_squared_error(y, y_pred)
    rmse = np.sqrt(mse)
    r2 = r2_score(y, y_pred)
    st.write(f"**MSE:** {mse:.6f} | **RMSE:** {rmse:.6f} | **R²:** {r2:.2f}")
    log_dif_estoque = np.log(estoque_final_proj / estoque_inicial_proj)
    log_dif_oferta_demanda = np.log(oferta_proj / demanda_proj)
    log_estoque_uso = np.log(estoque_uso_proj)
    dif_log_usd_brl = np.log(usd_brl_proj) - np.log(df['USDBRL=X'].iloc[-1])
    dif_log_cl_f = np.log(cl_f_proj) - np.log(df['CL=F'].iloc[-1])
    X_novo = pd.DataFrame([[log_dif_estoque, log_dif_oferta_demanda, log_estoque_uso, dif_log_usd_brl, dif_log_cl_f]],
                          columns=['Log_Diferencial_Estoque', 'Log_Diferencial_Oferta_Demanda', 'Log_Estoque_Uso', 'Dif_Log_USDBRL', 'Dif_Log_CL_F'])
    dif_log_sb_f_previsto = model.predict(X_novo)[0]
    sb_f_previsto = revert_log_diff(df['SB=F'].iloc[-1], dif_log_sb_f_previsto)
    sb_f_min = revert_log_diff(df['SB=F'].iloc[-1], dif_log_sb_f_previsto - rmse)
    sb_f_max = revert_log_diff(df['SB=F'].iloc[-1], dif_log_sb_f_previsto + rmse)
    st.write(f"### Preço previsto de SB=F: {sb_f_previsto:.2f} (Min: {sb_f_min:.2f}, Max: {sb_f_max:.2f})")
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df['Ano safra'], y=df['SB=F'], mode='lines', name='Valor Real (SB=F)'))
    fig.update_layout(title="Preços Reais do Açúcar", xaxis_title="Ano Safra", yaxis_title="Preço (SB=F)")
    st.plotly_chart(fig)
