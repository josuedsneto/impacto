# Configuração centralizada dos ativos disponíveis na simulação.
# Importado por MonteCarlo.py e pages/Opções.py para evitar duplicação.
# Dados carregados online via yfinance (sem dependência de CSVs).

from datetime import date

import pandas as pd
import streamlit as st
import yfinance as yf

ATIVOS = {
    "Açúcar": {
        "ticker": "SB=F",
        "valor_minimo_padrao": 20.0,
        "limite_inferior": 15,
        "limite_superior": 35,
    },
    "Dólar": {
        "ticker": "USDBRL=X",
        "valor_minimo_padrao": 5.0,
        "limite_inferior": 4,
        "limite_superior": 6,
    },
}


@st.cache_data(ttl=3600)
def carregar_dados(tipo_ativo: str):
    config = ATIVOS[tipo_ativo]
    data = yf.download(
        config["ticker"],
        start=date(2013, 1, 1),
        multi_level_index=False,
        auto_adjust=True,
        progress=False,
    )
    data = data[["Close"]].dropna()
    data["Daily Return"] = data["Close"].pct_change()
    return data, config["valor_minimo_padrao"], config["limite_inferior"], config["limite_superior"]
