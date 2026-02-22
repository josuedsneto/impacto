import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import io
import yfinance as yf
import smtplib
from datetime import date
from email.mime.text import MIMEText

from utils import require_login, show_logo

st.set_page_config(page_title="Mercado", page_icon="📈", layout="wide")
require_login()
show_logo()


def calcular_MACD(data, short_window=12, long_window=26, signal_window=9):
    short_ema = data['Close'].ewm(span=short_window, min_periods=1, adjust=False).mean()
    long_ema = data['Close'].ewm(span=long_window, min_periods=1, adjust=False).mean()
    macd = short_ema - long_ema
    signal_line = macd.ewm(span=signal_window, min_periods=1, adjust=False).mean()
    data['MACD'] = macd
    data['Signal Line'] = signal_line
    data['Histograma'] = macd - signal_line
    return data

def calcular_CCI(data, window=20):
    typical_price = (data['High'] + data['Low'] + data['Close']) / 3
    mean_deviation = typical_price.rolling(window=window).apply(lambda x: np.mean(np.abs(x - np.mean(x))))
    return (typical_price - typical_price.rolling(window=window).mean()) / (0.015 * mean_deviation)

def calcular_estocastico(data, window=14):
    low_min = data['Low'].rolling(window=window).min()
    high_max = data['High'].rolling(window=window).max()
    return ((data['Close'] - low_min) / (high_max - low_min)) * 100

def calcular_estocastico_lento(data, window=14, smooth_k=3):
    return calcular_estocastico(data, window).rolling(window=smooth_k).mean()

def calcular_volatilidade_ewma_percentual(retornos_diarios_absolutos, span=20):
    return retornos_diarios_absolutos.ewm(span=span).std() * 100

def calcular_bollinger_bands(data, window=20, num_std_dev=2):
    rolling_mean = data['Close'].rolling(window=window).mean()
    rolling_std = data['Close'].rolling(window=window).std()
    data['Bollinger High'] = rolling_mean + (rolling_std * num_std_dev)
    data['Bollinger Low'] = rolling_mean - (rolling_std * num_std_dev)
    return data

def calcular_RSI(data, window=14):
    delta = data['Close'].diff()
    ganho = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    perda = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = ganho / perda
    return 100 - (100 / (1 + rs))

def enviar_alerta(email, ativo, cci_status, rsi_status, estocastico_status, bb_status):
    smtp_server = "smtp.gmail.com"
    smtp_port = 587
    sender_email = st.secrets.get("smtp_email", "")
    sender_password = st.secrets.get("smtp_password", "")
    message = f"Alerta para o ativo {ativo}:\nCCI: {cci_status}\nRSI: {rsi_status}\nEstocástico: {estocastico_status}\nBandas de Bollinger: {bb_status}"
    msg = MIMEText(message)
    msg['Subject'] = f"Alerta de Mercado - {ativo}"
    msg['From'] = sender_email
    msg['To'] = email
    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, email, msg.as_string())
        st.success(f"Alerta enviado para {email}")
    except Exception as e:
        st.error(f"Erro ao enviar o e-mail: {e}")


st.title("Mercado")
ativo = st.selectbox("Selecione o ativo", ["SBK26.NYB", "USDBRL=X", "SB=F", "CL=F"])
start_date = date(2014, 1, 1)
today = date.today()
data = yf.download(ativo, start=start_date, end=today.strftime('%Y-%m-%d'), auto_adjust=True, multi_level_index=False, progress=False)
filtro_datas = st.date_input("Selecione um intervalo de datas:", value=[pd.to_datetime('2023-01-01'), pd.to_datetime('2025-01-01')])
filtro_datas = [pd.Timestamp(d) for d in filtro_datas]
indicador_selecionado = st.selectbox("Selecione o indicador", ["EWMA", "CCI", "Estocástico", "Bandas de Bollinger", "MACD", "RSI"])
sobrecompra = 100
if indicador_selecionado == "CCI":
    sobrecompra = st.slider("Nível de sobrecompra do CCI", 100, 250, step=50, value=100)

if st.button("Calcular"):
    data_filtrado = data[(data.index >= filtro_datas[0]) & (data.index <= filtro_datas[1])].copy()
    quantidade_entradas = 0
    soma_fechamentos_entradas = 0

    if indicador_selecionado == "EWMA":
        data_filtrado['Daily Returns'] = data_filtrado['Close'].pct_change()
        data_filtrado['EWMA Volatility'] = calcular_volatilidade_ewma_percentual(data_filtrado['Daily Returns'])
        data_filtrado.dropna(subset=['Daily Returns', 'EWMA Volatility'], inplace=True)
        data_filtrado['Abs Daily Returns'] = data_filtrado['Daily Returns'].abs() * 100
        data_filtrado['Entry Points'] = data_filtrado['Daily Returns'] * 100 > data_filtrado['EWMA Volatility']
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        if quantidade_entradas > 0:
            soma_fechamentos_entradas = data_filtrado[data_filtrado['Entry Points']]['Close'].mean()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Abs Daily Returns'], mode='lines', name='Retornos Diários Absolutos'))
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['EWMA Volatility'], mode='lines', name='Volatilidade EWMA'))
        st.plotly_chart(fig)
        excel_buffer = io.BytesIO()
        with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
            data_filtrado[['Close', 'Abs Daily Returns', 'EWMA Volatility']].reset_index().to_excel(writer, sheet_name='EWMA', index=False)
        excel_buffer.seek(0)
        st.download_button(label="Baixar Arquivo Excel", data=excel_buffer, file_name="dados_ewma.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    elif indicador_selecionado == "CCI":
        data_filtrado['CCI'] = calcular_CCI(data_filtrado)
        data_filtrado['Entry Points'] = (data_filtrado['CCI'] > sobrecompra) & (data_filtrado['CCI'].shift(-1) < data_filtrado['CCI']) & (data_filtrado['CCI'].shift(1) < data_filtrado['CCI'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['CCI'], mode='lines', name='CCI'))
        st.plotly_chart(fig)

    elif indicador_selecionado == "Estocástico":
        data_filtrado['Estocástico'] = calcular_estocastico_lento(data_filtrado)
        data_filtrado['Entry Points'] = (data_filtrado['Estocástico'] > 80) & (data_filtrado['Estocástico'].shift(-1) < data_filtrado['Estocástico']) & (data_filtrado['Estocástico'].shift(1) < data_filtrado['Estocástico'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Estocástico'], mode='lines', name='Estocástico'))
        st.plotly_chart(fig)

    elif indicador_selecionado == "Bandas de Bollinger":
        data_filtrado = calcular_bollinger_bands(data_filtrado)
        data_filtrado['Entry Points'] = (data_filtrado['Close'] > data_filtrado['Bollinger High']) & (data_filtrado['Close'].shift(-1) < data_filtrado['Close'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure(data=[go.Candlestick(x=data_filtrado.index, open=data_filtrado['Open'], high=data_filtrado['High'], low=data_filtrado['Low'], close=data_filtrado['Close'])])
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Bollinger High'], mode='lines', name='Bollinger High'))
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Bollinger Low'], mode='lines', name='Bollinger Low'))
        st.plotly_chart(fig)

    elif indicador_selecionado == "MACD":
        data_filtrado = calcular_MACD(data_filtrado)
        data_filtrado['Entry Points'] = (data_filtrado['MACD'] > data_filtrado['Signal Line']) & (data_filtrado['MACD'].shift(-1) < data_filtrado['Signal Line'].shift(-1))
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['MACD'], mode='lines', name='MACD'))
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Signal Line'], mode='lines', name='Signal Line'))
        st.plotly_chart(fig)

    elif indicador_selecionado == "RSI":
        data_filtrado['RSI'] = calcular_RSI(data_filtrado)
        data_filtrado['Entry Points'] = (data_filtrado['RSI'] > 70) & (data_filtrado['RSI'].shift(-1) < data_filtrado['RSI'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['RSI'], mode='lines', name='RSI'))
        st.plotly_chart(fig)

    media_fechamentos = data_filtrado['Close'].mean()
    col1, col2, col3 = st.columns(3)
    col1.metric("Quantidade de Entradas", quantidade_entradas)
    col2.metric("Média dos Fechamentos das Entradas", f"{soma_fechamentos_entradas:.2f}")
    col3.metric("Média de Todos os Candles", f"{float(media_fechamentos):.2f}")

    gerar_alerta = st.checkbox("Gerar Alerta")
    if gerar_alerta:
        email = st.text_input("Digite seu e-mail para receber o alerta")
        if email:
            enviar_alerta(email, ativo, "Normal", "Normal", "Normal", "Normal")
