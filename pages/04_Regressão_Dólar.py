import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
from datetime import date, timedelta

from utils import require_login, show_logo

st.set_page_config(page_title="Regressão Dólar", page_icon="📈", layout="wide")
require_login()
show_logo()

# ── Constantes ────────────────────────────────────────────────────────────────
_BCB_SERIES = {"selic": 432, "m2_bcb": 1837, "prod_industrial": 21859}
_FRED_SERIES = {"fed_funds": "FEDFUNDS", "m2_fred": "M2SL", "indpro": "INDPRO"}
_FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"
_FEATURE_COLS = ["selic", "m2_bcb", "prod_industrial", "fed_funds", "m2_fred", "indpro"]


# ── Funções de fetch ──────────────────────────────────────────────────────────
@st.cache_data(ttl=3600)
def fetch_dados_dolar(meses: int = 72) -> pd.DataFrame:
    """
    Busca histórico mensal: BCB SGS (Selic, M2, ProdInd) + FRED (FedFunds, M2SL, INDPRO)
    + USDBRL=X via yfinance. Retorna DataFrame com colunas:
    taxa_dolar, selic, m2_bcb, prod_industrial, fed_funds, m2_fred, indpro
    """
    import yfinance as yf
    import requests as req

    today = date.today()
    start = today - timedelta(days=meses * 31)
    start_str = start.strftime("%Y-%m-%d")

    # BCB
    bcb_df = pd.DataFrame()
    try:
        from bcb import SGS
        sgs = SGS()
        raw = sgs.get(list(_BCB_SERIES.values()), start=start, end=today)
        for key, code in _BCB_SERIES.items():
            if code in raw.columns:
                series = raw[code].dropna().resample("ME").last()
                series.index = series.index.strftime("%Y-%m")
                bcb_df[key] = series
    except Exception as e:
        st.warning(f"BCB indisponível: {e}")

    # FRED
    fred_api_key = st.secrets.get("FRED_API_KEY", "")
    fred_df = pd.DataFrame()
    if fred_api_key:
        for key, sid in _FRED_SERIES.items():
            try:
                resp = req.get(_FRED_BASE, params={
                    "series_id": sid, "api_key": fred_api_key,
                    "observation_start": start_str, "frequency": "m", "file_type": "json"
                }, timeout=15)
                obs = resp.json().get("observations", [])
                records = [{"period": o["date"][:7], "value": float(o["value"])}
                           for o in obs if o.get("value", ".") != "."]
                if records:
                    s = pd.DataFrame(records).set_index("period")["value"]
                    fred_df[key] = s
            except Exception as e:
                st.warning(f"FRED {sid} indisponível: {e}")
    else:
        st.info("FRED_API_KEY não configurada — variáveis FRED não incluídas no modelo.")

    # yfinance USDBRL=X
    usdbrl_df = pd.DataFrame()
    try:
        raw_usdbrl = yf.download("USDBRL=X", start=start_str,
                                 interval="1mo", progress=False, auto_adjust=True)
        if not raw_usdbrl.empty:
            close = raw_usdbrl["Close"].dropna()
            close.index = pd.DatetimeIndex(close.index).strftime("%Y-%m")
            usdbrl_df["taxa_dolar"] = close
    except Exception as e:
        st.warning(f"yfinance USDBRL=X indisponível: {e}")

    merged = usdbrl_df.copy()
    for df in [bcb_df, fred_df]:
        if not df.empty:
            merged = merged.join(df, how="left")
    return merged.dropna()


@st.cache_data(ttl=3600)
def obter_defaults_atuais() -> dict:
    """Busca últimos valores das séries para pré-preencher inputs."""
    try:
        from bcb import SGS
        sgs = SGS()
        today = date.today()
        start = today - timedelta(days=120)
        raw = sgs.get(list(_BCB_SERIES.values()), start=start, end=today)
        defaults = {}
        for key, code in _BCB_SERIES.items():
            if code in raw.columns:
                col = raw[code].dropna()
                defaults[key] = float(col.iloc[-1]) if not col.empty else None
            else:
                defaults[key] = None
        return defaults
    except Exception:
        return {k: None for k in _BCB_SERIES}


# ── Página principal ──────────────────────────────────────────────────────────
st.title("Previsão da Taxa de Câmbio (USD/BRL)")
st.write("Modelo OLS treinado em dados históricos BCB + FRED. Insira as premissas e clique em **Gerar Regressão**.")

# Pré-preencher com defaults atuais
with st.spinner("Buscando valores atuais das séries..."):
    defaults = obter_defaults_atuais()

col1, col2, col3 = st.columns(3)
with col1:
    selic_proj = st.number_input("Selic (% a.a.)", value=float(defaults.get("selic") or 13.75), step=0.25)
    m2_bcb_proj = st.number_input("M2 BCB (R$ bi)", value=float(defaults.get("m2_bcb") or 5200.0), step=10.0)
with col2:
    prod_ind_br_proj = st.number_input("Prod. Industrial BCB (índice)", value=float(defaults.get("prod_industrial") or 105.0), step=0.1)
    fed_funds_proj = st.number_input("Fed Funds (% a.a.)", value=4.33, step=0.25)
with col3:
    m2_fred_proj = st.number_input("M2 EUA (bi USD)", value=21000.0, step=100.0)
    indpro_proj = st.number_input("Prod. Industrial EUA (índice)", value=103.0, step=0.1)

if st.button("Gerar Regressão"):
    import statsmodels.api as sm
    from sklearn.metrics import mean_squared_error

    with st.spinner("Buscando dados históricos e treinando modelo..."):
        df = fetch_dados_dolar(meses=72)

    if len(df) < 24:
        st.error(f"Dados insuficientes: {len(df)} meses após merge (mínimo 24 necessário).")
        st.stop()

    # Determinar features disponíveis (FRED pode estar ausente se sem API key)
    feature_cols = [c for c in _FEATURE_COLS if c in df.columns]
    y = df["taxa_dolar"].values
    X = df[feature_cols].values

    X_const = sm.add_constant(X, has_constant="add")
    fitted = sm.OLS(endog=y, exog=X_const).fit()
    y_pred = fitted.fittedvalues
    r2 = float(fitted.rsquared)
    rmse = float(np.sqrt(mean_squared_error(y, y_pred)))

    # Previsão com inputs do usuário
    input_dict = {
        "selic": selic_proj, "m2_bcb": m2_bcb_proj,
        "prod_industrial": prod_ind_br_proj, "fed_funds": fed_funds_proj,
        "m2_fred": m2_fred_proj, "indpro": indpro_proj,
    }
    input_row = pd.DataFrame([[input_dict[c] for c in feature_cols]], columns=feature_cols)
    input_const = sm.add_constant(input_row, has_constant="add")
    taxa_prevista = float(fitted.predict(input_const)[0])

    def _br(v, dec=4): return f"{v:.{dec}f}".replace(".", ",")
    st.success(f"**Taxa de câmbio prevista: R$ {_br(taxa_prevista)}**")
    col_m1, col_m2, col_m3 = st.columns(3)
    col_m1.metric("R²",   _br(r2))
    col_m2.metric("RMSE", _br(rmse))
    col_m3.metric("Obs. de treino", str(len(df)))

    # Heatmap de correlação
    corr_df = df[["taxa_dolar"] + feature_cols]
    corr = corr_df.corr()
    text = [[f"{v:.2f}".replace(".", ",") for v in row] for row in corr.values]
    fig_corr = go.Figure(go.Heatmap(
        z=corr.values,
        x=corr.columns.tolist(),
        y=corr.index.tolist(),
        colorscale="RdBu",
        zmin=-1, zmax=1,
        text=text,
        texttemplate="%{text}",
    ))
    fig_corr.update_layout(title="Matriz de Correlação")
    st.plotly_chart(fig_corr, use_container_width=True)

    # Gráfico real vs previsto
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=list(df.index), y=list(y), mode="lines", name="Real"))
    fig.add_trace(go.Scatter(x=list(df.index), y=list(y_pred), mode="lines", name="Previsto", line=dict(dash="dash")))
    fig.update_layout(title="Taxa de Câmbio: Real vs Previsto", xaxis_title="Período", yaxis_title="USD/BRL")
    st.plotly_chart(fig, use_container_width=True)

    # Coeficientes do modelo
    st.subheader("Coeficientes do Modelo OLS")
    coef_names = ["const"] + feature_cols
    coef_df = pd.DataFrame({
        "Variável": coef_names,
        "Coeficiente": [round(float(c), 6) for c in fitted.params],
        "P-valor": [round(float(p), 4) for p in fitted.pvalues],
    })
    st.dataframe(coef_df, use_container_width=True)
