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

st.set_page_config(page_title="Fixações", page_icon="📈", layout="wide")
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


def _br(v, dec=2):
    return f"{abs(v):,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")


st.title("Fixações")
ativo = st.selectbox("Selecione o ativo", ["SBK26.NYB", "USDBRL=X", "SB=F", "CL=F"])
start_date = date(2014, 1, 1)
today = date.today()
data = yf.download(ativo, start=start_date, end=today.strftime('%Y-%m-%d'), auto_adjust=True, multi_level_index=False, progress=False)
filtro_datas = st.date_input("Selecione um intervalo de datas:", value=[pd.to_datetime('2023-01-01'), pd.to_datetime('2025-01-01')])
filtro_datas = [pd.Timestamp(d) for d in filtro_datas]
indicador_selecionado = st.selectbox("Selecione o indicador", ["EWMA", "CCI", "Estocástico Lento", "Bandas de Bollinger", "MACD", "RSI"])
quantidade_total = st.number_input(
    "Quantidade a fixar (lotes/unidades):",
    min_value=0.0, step=100.0, value=1000.0,
    help="Informe a quantidade total do ativo para simular o resultado financeiro se as fixações do indicador fossem obedecidas.",
)
sobrecompra = 100
if indicador_selecionado == "CCI":
    sobrecompra = st.slider("Nível de sobrecompra do CCI", 100, 250, step=50, value=100)

# Parâmetros configuráveis por indicador
if indicador_selecionado == "Estocástico Lento":
    with st.sidebar:
        st.subheader("Parâmetros — Estocástico Lento")
        periodo_k = st.number_input("Período %K", min_value=1, max_value=100, value=14, step=1)
        periodo_d = st.number_input("Período %D (suavização)", min_value=1, max_value=20, value=3, step=1)
elif indicador_selecionado == "RSI":
    with st.sidebar:
        st.subheader("Parâmetros — RSI")
        periodo_rsi = st.number_input("Período RSI", min_value=1, max_value=100, value=14, step=1)
elif indicador_selecionado == "Bandas de Bollinger":
    with st.sidebar:
        st.subheader("Parâmetros — Bandas de Bollinger")
        janela_bb = st.number_input("Janela (períodos)", min_value=2, max_value=200, value=20, step=1)
        desvios_bb = st.number_input("Desvios padrão", min_value=0.5, max_value=5.0, value=2.0, step=0.5)

if st.button("Calcular"):
    data_filtrado = data[(data.index >= filtro_datas[0]) & (data.index <= filtro_datas[1])].copy()
    quantidade_entradas = 0

    if indicador_selecionado == "EWMA":
        data_filtrado['Daily Returns'] = data_filtrado['Close'].pct_change()
        data_filtrado['EWMA Volatility'] = calcular_volatilidade_ewma_percentual(data_filtrado['Daily Returns'])
        data_filtrado.dropna(subset=['Daily Returns', 'EWMA Volatility'], inplace=True)
        data_filtrado['Abs Daily Returns'] = data_filtrado['Daily Returns'].abs() * 100
        data_filtrado['Entry Points'] = data_filtrado['Daily Returns'] * 100 > data_filtrado['EWMA Volatility']
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Abs Daily Returns'], mode='lines', name='Retornos Diários Absolutos'))
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['EWMA Volatility'], mode='lines', name='Volatilidade EWMA'))

    elif indicador_selecionado == "CCI":
        data_filtrado['CCI'] = calcular_CCI(data_filtrado)
        data_filtrado['Entry Points'] = (data_filtrado['CCI'] > sobrecompra) & (data_filtrado['CCI'].shift(-1) < data_filtrado['CCI']) & (data_filtrado['CCI'].shift(1) < data_filtrado['CCI'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['CCI'], mode='lines', name='CCI'))

    elif indicador_selecionado == "Estocástico Lento":
        data_filtrado['Estocástico Lento'] = calcular_estocastico_lento(data_filtrado, window=periodo_k, smooth_k=periodo_d)
        data_filtrado['Entry Points'] = (data_filtrado['Estocástico Lento'] > 80) & (data_filtrado['Estocástico Lento'].shift(-1) < data_filtrado['Estocástico Lento']) & (data_filtrado['Estocástico Lento'].shift(1) < data_filtrado['Estocástico Lento'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Estocástico Lento'], mode='lines', name='Estocástico Lento'))

    elif indicador_selecionado == "Bandas de Bollinger":
        data_filtrado = calcular_bollinger_bands(data_filtrado, window=janela_bb, num_std_dev=desvios_bb)
        data_filtrado['Entry Points'] = (data_filtrado['Close'] > data_filtrado['Bollinger High']) & (data_filtrado['Close'].shift(-1) < data_filtrado['Close'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure(data=[go.Candlestick(x=data_filtrado.index, open=data_filtrado['Open'], high=data_filtrado['High'], low=data_filtrado['Low'], close=data_filtrado['Close'])])
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Bollinger High'], mode='lines', name='Bollinger High'))
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Bollinger Low'], mode='lines', name='Bollinger Low'))

    elif indicador_selecionado == "MACD":
        data_filtrado = calcular_MACD(data_filtrado)
        data_filtrado['Entry Points'] = (data_filtrado['MACD'] > data_filtrado['Signal Line']) & (data_filtrado['MACD'].shift(-1) < data_filtrado['Signal Line'].shift(-1))
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['MACD'], mode='lines', name='MACD'))
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['Signal Line'], mode='lines', name='Signal Line'))

    elif indicador_selecionado == "RSI":
        data_filtrado['RSI'] = calcular_RSI(data_filtrado, window=periodo_rsi)
        data_filtrado['Entry Points'] = (data_filtrado['RSI'] > 70) & (data_filtrado['RSI'].shift(-1) < data_filtrado['RSI'])
        quantidade_entradas = data_filtrado['Entry Points'].sum()
        fig = go.Figure()
        fig.add_trace(go.Scatter(x=data_filtrado.index, y=data_filtrado['RSI'], mode='lines', name='RSI'))

    # Compute signal metrics (common to all indicators)
    soma_fechamentos_entradas = 0.0
    if quantidade_entradas > 0:
        soma_fechamentos_entradas = float(data_filtrado[data_filtrado['Entry Points']]['Close'].mean())
    media_fechamentos = float(data_filtrado['Close'].mean())

    # Gather signal rows for coverage tab
    sinais_df = data_filtrado[data_filtrado['Entry Points']][['Close']].copy()
    sinais_df.index.name = 'Data'
    sinais_df.columns = ['Preço']
    sinais_df = sinais_df.reset_index()
    sinais_df['Data'] = sinais_df['Data'].dt.strftime('%d/%m/%Y')
    n_sinais = len(sinais_df)
    if n_sinais > 0 and quantidade_total > 0:
        lote_por_sinal = quantidade_total / n_sinais
        sinais_df['Lotes Fixados'] = lote_por_sinal
        sinais_df['Cobertura Acumulada (%)'] = (np.arange(1, n_sinais + 1) / n_sinais * 100).round(1)
    sinais_df['Preço'] = sinais_df['Preço'].map(lambda v: _br(v))

    # ── Tabs ────────────────────────────────────────────────────────────────────
    tab_ind, tab_cob = st.tabs(["Indicador", "Cobertura"])

    with tab_ind:
        st.plotly_chart(fig, use_container_width=True)

        col1, col2, col3 = st.columns(3)
        col1.metric("Quantidade de Sinais", quantidade_entradas)
        col2.metric(
            "Preço Médio dos Sinais",
            _br(soma_fechamentos_entradas),
            delta=f"{'+' if soma_fechamentos_entradas >= media_fechamentos else ''}{_br(soma_fechamentos_entradas - media_fechamentos)} vs média",
            delta_color="normal",
        )
        col3.metric("Preço Médio do Período", _br(media_fechamentos))

        if quantidade_total > 0 and quantidade_entradas > 0:
            st.subheader("Resultado Financeiro das Fixações")
            resultado_sinais  = quantidade_total * soma_fechamentos_entradas
            resultado_periodo = quantidade_total * media_fechamentos
            ganho_extra       = resultado_sinais - resultado_periodo
            c1, c2, c3 = st.columns(3)
            c1.metric(
                "Receita obedecendo os sinais",
                _br(resultado_sinais),
                help=f"{_br(quantidade_total)} unid. × preço médio {_br(soma_fechamentos_entradas)}",
            )
            c2.metric(
                "Receita ao preço médio do período",
                _br(resultado_periodo),
            )
            c3.metric(
                "Ganho adicional com os sinais",
                _br(abs(ganho_extra)),
                delta=f"{'+' if ganho_extra >= 0 else '-'}{_br(abs(ganho_extra))}",
                delta_color="normal" if ganho_extra >= 0 else "inverse",
            )

        if indicador_selecionado == "EWMA":
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine='xlsxwriter') as writer:
                data_filtrado[['Close', 'Abs Daily Returns', 'EWMA Volatility']].reset_index().to_excel(writer, sheet_name='EWMA', index=False)
            excel_buffer.seek(0)
            st.download_button(label="Baixar Arquivo Excel", data=excel_buffer, file_name="dados_ewma.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

        gerar_alerta = st.checkbox("Gerar Alerta")
        if gerar_alerta:
            email = st.text_input("Digite seu e-mail para receber o alerta")
            if email:
                enviar_alerta(email, ativo, "Normal", "Normal", "Normal", "Normal")

    with tab_cob:
        st.subheader("Cobertura de Fixações")

        if n_sinais == 0:
            st.info("Nenhum sinal gerado no período selecionado.")
        else:
            # Summary metrics
            pct_coberta = 100.0 if quantidade_total == 0 else min(100.0, n_sinais / quantidade_total * 100) if quantidade_total < n_sinais else 100.0
            ca1, ca2, ca3 = st.columns(3)
            ca1.metric("Sinais (fixações)", n_sinais)
            ca2.metric("Preço médio fixado", _br(soma_fechamentos_entradas))
            if quantidade_total > 0:
                ca3.metric("Lotes por sinal", _br(quantidade_total / n_sinais, 0))

            # Cumulative coverage chart
            sinais_raw = data_filtrado[data_filtrado['Entry Points']]['Close'].copy()
            sinais_raw = sinais_raw.reset_index()
            sinais_raw.columns = ['Data', 'Preço']
            sinais_raw['Cobertura Acumulada (%)'] = (np.arange(1, len(sinais_raw) + 1) / len(sinais_raw) * 100)

            fig_cob = go.Figure()
            fig_cob.add_trace(go.Bar(
                x=sinais_raw['Data'],
                y=sinais_raw['Preço'],
                name='Preço Fixado',
                marker_color='rgba(70,130,180,0.7)',
                yaxis='y1',
            ))
            fig_cob.add_trace(go.Scatter(
                x=sinais_raw['Data'],
                y=sinais_raw['Cobertura Acumulada (%)'],
                name='Cobertura Acumulada (%)',
                mode='lines+markers',
                line=dict(color='orange', width=2),
                yaxis='y2',
            ))
            fig_cob.update_layout(
                title=f'Fixações — {indicador_selecionado} ({ativo})',
                xaxis_title='Data',
                yaxis=dict(title='Preço Fixado', side='left'),
                yaxis2=dict(title='Cobertura Acumulada (%)', side='right', overlaying='y', range=[0, 105]),
                legend=dict(orientation='h', y=-0.2),
                separators=',.',
            )
            st.plotly_chart(fig_cob, use_container_width=True)

            # Signal table
            st.subheader("Detalhamento dos Sinais")
            st.dataframe(sinais_df, use_container_width=True, hide_index=True)

            # CSV export
            csv_sinais = sinais_df.to_csv(index=False, sep=';').encode('utf-8-sig')
            st.download_button(
                label="Baixar CSV das Fixações",
                data=csv_sinais,
                file_name=f"fixacoes_{indicador_selecionado.lower().replace(' ', '_')}_{ativo}.csv",
                mime="text/csv",
            )
