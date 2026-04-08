import streamlit as st
import numpy as np
import pandas as pd
import plotly.express as px
import yfinance as yf

from utils import require_login, show_logo

st.set_page_config(page_title="Volatilidade", page_icon="📈", layout="wide")
require_login()
show_logo()


@st.cache_data(ttl=3600)
def get_historical_data(symbol, start_date, end_date):
    from arch import arch_model
    data = yf.download(symbol, start=start_date, end=end_date, multi_level_index=False, auto_adjust=True, progress=False)
    if 'Close' in data.columns:
        data['Price'] = data['Close']
    else:
        raise KeyError("Coluna 'Close' não encontrada.")
    data['Log Returns'] = np.log(data['Price'] / data['Price'].shift(1))
    data['Daily Returns'] = data['Price'].pct_change()
    data['EWMA Volatility'] = data['Daily Returns'].ewm(span=20).std()
    data['Abs Daily Returns'] = data['Daily Returns'].abs()
    data.dropna(inplace=True)
    scaled_log_returns = data['Log Returns'] * 100
    model = arch_model(scaled_log_returns, vol='Garch', p=1, q=1)
    model_fit = model.fit(disp="off")
    data['GARCH Volatility'] = model_fit.conditional_volatility / 100
    data['EWMA Volatility Anualizada'] = data['EWMA Volatility'] * np.sqrt(252)
    data['GARCH Volatility Anualizada'] = data['GARCH Volatility'] * np.sqrt(252)
    return data, model_fit


def save_to_excel(data, filename):
    data.to_excel(filename, index=True)


st.title("Volatilidade de Preços - Açúcar e Dólar")
st.info("Volatilidade diária calculada a partir de retornos diários. Anualizada = Diária × √252 (dias úteis/ano).")
variable = st.selectbox("Escolha a variável para estudar:", ["Açúcar", "Dólar"])
start_date = st.date_input("Data inicial:", value=pd.to_datetime("2013-01-01"), min_value=pd.to_datetime("2000-01-01"), max_value=pd.Timestamp.today())
end_date = st.date_input("Data final:", value=pd.Timestamp.today(), min_value=pd.to_datetime("2000-01-01"), max_value=pd.Timestamp.today())

if end_date <= start_date:
    st.error("A data final deve ser posterior à data inicial.")
    st.stop()

symbol = "SB=F" if variable == "Açúcar" else "USDBRL=X"

if st.button("Calcular"):
    data, model_fit = get_historical_data(symbol, start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d'))
    if not data.empty:
        ewma_vol_mean = data['EWMA Volatility'].mean()
        ewma_vol_anual = data['EWMA Volatility Anualizada'].mean()
        garch_vol_mean = data['GARCH Volatility'].mean()
        garch_vol_anual = data['GARCH Volatility Anualizada'].mean()

        fig1 = px.line(data, x=data.index, y='EWMA Volatility', title=f'Volatilidade EWMA - {variable} (Diária)')
        st.plotly_chart(fig1)
        st.write(f"- **Volatilidade Média EWMA (Diária):** {ewma_vol_mean:.4%}")

        fig1b = px.line(data, x=data.index, y='EWMA Volatility Anualizada', title=f'Volatilidade EWMA - {variable} (Anualizada)')
        st.plotly_chart(fig1b)
        st.write(f"- **Volatilidade Média EWMA (Anualizada):** {ewma_vol_anual:.4%}")

        fig2 = px.line(data, x=data.index, y='GARCH Volatility', title=f'Volatilidade Condicional GARCH - {variable} (Diária)')
        st.plotly_chart(fig2)
        st.write(f"- **Volatilidade Média GARCH (Diária):** {garch_vol_mean:.4%}")

        fig2b = px.line(data, x=data.index, y='GARCH Volatility Anualizada', title=f'Volatilidade Condicional GARCH - {variable} (Anualizada)')
        st.plotly_chart(fig2b)
        st.write(f"- **Volatilidade Média GARCH (Anualizada):** {garch_vol_anual:.4%}")
        st.subheader("Parâmetros do Modelo GARCH")
        conf_int = model_fit.conf_int()
        lower_col, upper_col = conf_int.columns[0], conf_int.columns[1]
        st.write(f"**Omega:** {model_fit.params['omega']:.4e} (Intervalo: [{conf_int.loc['omega', lower_col]:.4e}, {conf_int.loc['omega', upper_col]:.4e}])")
        st.write(f"**Alpha[1]:** {model_fit.params['alpha[1]']:.4f} (Intervalo: [{conf_int.loc['alpha[1]', lower_col]:.4f}, {conf_int.loc['alpha[1]', upper_col]:.4f}])")
        st.write(f"**Beta[1]:** {model_fit.params['beta[1]']:.4f} (Intervalo: [{conf_int.loc['beta[1]', lower_col]:.4f}, {conf_int.loc['beta[1]', upper_col]:.4f}])")
        excel_filename = f'{variable.lower()}_bi.xlsx'
        save_to_excel(data, excel_filename)
        with open(excel_filename, "rb") as file:
            st.download_button(label="Baixar Excel", data=file, file_name=excel_filename, mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    else:
        st.error("Não há dados disponíveis para a data selecionada.")
