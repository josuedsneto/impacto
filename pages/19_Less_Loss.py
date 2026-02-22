import streamlit as st
import pandas as pd
import plotly.express as px

from utils import require_login, show_logo

st.set_page_config(page_title="Less Loss", page_icon="📈", layout="wide")
require_login()
show_logo()


@st.cache_data
def load_data():
    df = pd.read_excel('df_final.xlsx', usecols=['serial_medidor', 'data_hora_leitura', 'Cluster'])
    df['data_hora_leitura'] = pd.to_datetime(df['data_hora_leitura'])
    return df


st.title('Análise de Medidores')
df = load_data()
data_selecionada = st.selectbox('Selecione a data', df['data_hora_leitura'].dt.date.unique())
serial_selecionado = st.selectbox('Selecione o serial do medidor', df['serial_medidor'].unique())

if st.button('Visualizar'):
    df_filtrado = df[(df['data_hora_leitura'].dt.date == data_selecionada) & (df['serial_medidor'] == serial_selecionado)]
    fig = px.line(df_filtrado, x='data_hora_leitura', y='Cluster', title='Cluster do Medidor ao Longo do Dia')
    st.plotly_chart(fig)
