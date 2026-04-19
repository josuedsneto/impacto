import streamlit as st
import numpy as np
import pandas as pd
import plotly.graph_objs as go
import matplotlib.pyplot as plt
import seaborn as sns

from utils import require_login, show_logo

st.set_page_config(page_title="Regressão Açúcar", page_icon="📈", layout="wide")
require_login()
show_logo()

# ── Dados USDA anuais (safras 2014–2025) ─────────────────────────────────────
# Valores USDA PSD para açúcar global. O inner join com yfinance anual
# excluirá automaticamente o ano 2025 se yfinance ainda não tiver fechamento
# anual para SB=F (comportamento esperado enquanto a safra está em andamento).
_USDA_ANNUAL = {
    "year": [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    "estoque_inicial": [35.2, 38.1, 39.8, 47.5, 55.4, 53.5, 53.0, 48.4, 45.0, 44.7, 46.5, 47.0],
    "producao":        [178.4, 168.9, 172.6, 185.1, 185.5, 187.3, 176.8, 183.4, 183.8, 185.0, 186.0, 188.0],
    "demanda":         [166.5, 163.7, 165.4, 168.3, 171.4, 174.6, 172.9, 177.5, 179.5, 178.0, 178.5, 180.5],
    "estoque_final":   [38.1, 39.8, 47.5, 55.4, 53.5, 53.0, 48.4, 45.0, 44.7, 46.5, 47.0, 48.5],
}


@st.cache_data(ttl=3600)
def fetch_dados_acucar() -> pd.DataFrame:
    """
    Baixa fechamentos anuais de SB=F, USDBRL=X e CL=F via yfinance (2014-hoje)
    e faz merge inner com dados USDA anuais. Retorna DataFrame indexado por ano.
    """
    import yfinance as yf

    tickers = {"sb_f": "SB=F", "usdbrl": "USDBRL=X", "cl_f": "CL=F"}
    price_data = {}

    for key, ticker in tickers.items():
        try:
            raw = yf.download(ticker, start="2014-01-01", interval="1y",
                              progress=False, auto_adjust=True)
            if raw.empty:
                price_data[key] = pd.Series(dtype=float)
                continue
            close = raw["Close"].dropna()
            close.index = pd.DatetimeIndex(close.index).year
            close = close.groupby(close.index).last()
            # Flatten multi-level columns if present (yfinance sometimes returns MultiIndex)
            if isinstance(close, pd.DataFrame):
                close = close.iloc[:, 0]
            price_data[key] = close.astype(float)
        except Exception as e:
            st.warning(f"yfinance {ticker} indisponível: {e}")
            price_data[key] = pd.Series(dtype=float)

    price_df = pd.DataFrame(price_data)

    usda_df = pd.DataFrame(_USDA_ANNUAL).set_index("year")
    usda_df["estoque_uso_pct"] = usda_df["estoque_final"] / usda_df["demanda"] * 100

    merged = price_df.join(usda_df, how="inner").dropna()
    return merged


st.title("Previsão do Preço do Açúcar (SB=F)")
st.write(
    "Modelo Ridge/XGBoost treinado em dados anuais USDA + yfinance. "
    "Insira as premissas e clique em **Gerar Previsão**."
)

# ── Inputs do usuário (valores padrão: projeção USDA 2025/26) ────────────────
col1, col2, col3 = st.columns(3)
with col1:
    estoque_inicial_proj = st.number_input("Estoque Inicial (Mt)", value=48.5, step=0.5)
    producao_proj = st.number_input("Produção (Mt)", value=190.0, step=1.0)
with col2:
    demanda_proj = st.number_input("Demanda (Mt)", value=182.0, step=1.0)
    estoque_final_proj = st.number_input("Estoque Final (Mt)", value=48.5, step=0.5)
with col3:
    estoque_uso_proj = st.number_input(
        "Estoque/Uso (%)",
        value=round(48.5 / 182.0 * 100, 1),
        step=0.5,
    )
    usd_brl_proj = st.number_input("USD/BRL (USDBRL=X)", value=5.85, step=0.05)
    cl_f_proj = st.number_input("Petróleo CL=F (USD/bbl)", value=72.0, step=1.0)

model_type = st.selectbox("Modelo", ["Ridge", "XGBoost"], index=0)

if st.button("Gerar Previsão"):
    from sklearn.linear_model import RidgeCV
    from sklearn.metrics import mean_squared_error, r2_score

    with st.spinner("Buscando dados históricos e treinando modelo..."):
        df = fetch_dados_acucar()

    if len(df) < 6:
        st.error(f"Dados insuficientes: {len(df)} anos após merge (mínimo 6 necessário).")
        st.stop()

    feature_cols = [
        "estoque_inicial", "producao", "demanda", "estoque_final",
        "estoque_uso_pct", "usdbrl", "cl_f",
    ]
    y = df["sb_f"].values
    X = df[feature_cols].values

    if model_type == "XGBoost":
        import xgboost as xgb
        model = xgb.XGBRegressor(
            n_estimators=100, max_depth=3,
            learning_rate=0.1, random_state=42, n_jobs=1,
        )
    else:
        model = RidgeCV(alphas=[0.1, 1.0, 10.0, 100.0])

    model.fit(X, y)
    y_pred_train = model.predict(X)
    residuals = y - y_pred_train
    std_res = float(np.std(residuals))
    rmse = float(np.sqrt(mean_squared_error(y, y_pred_train)))
    r2 = float(r2_score(y, y_pred_train))

    # ── Previsão com inputs do usuário ────────────────────────────────────────
    input_array = np.array([[
        estoque_inicial_proj, producao_proj, demanda_proj,
        estoque_final_proj, estoque_uso_proj,
        usd_brl_proj, cl_f_proj,
    ]])
    sb_f_previsto = float(model.predict(input_array)[0])
    sb_f_min = sb_f_previsto - 1.96 * std_res
    sb_f_max = sb_f_previsto + 1.96 * std_res

    st.success(
        f"**Preço previsto SB=F: {sb_f_previsto:.2f} ¢/lb**"
        f"  |  Intervalo 95%: [{sb_f_min:.2f}, {sb_f_max:.2f}]"
    )

    col_m1, col_m2, col_m3 = st.columns(3)
    col_m1.metric("R²", f"{r2:.4f}")
    col_m2.metric("RMSE", f"{rmse:.4f} ¢/lb")
    col_m3.metric("Anos de treino", str(len(df)))

    # ── Heatmap de correlação ─────────────────────────────────────────────────
    corr_df = df[["sb_f"] + feature_cols]
    fig_corr, ax = plt.subplots(figsize=(10, 7))
    sns.heatmap(corr_df.corr(), annot=True, cmap="coolwarm", fmt=".2f",
                linewidths=0.5, ax=ax)
    ax.set_title("Matriz de Correlação — Variáveis do Modelo")
    st.pyplot(fig_corr)
    plt.close(fig_corr)

    # ── Gráfico histórico real vs previsto ────────────────────────────────────
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=list(df.index), y=list(y),
        mode="lines+markers", name="Real (SB=F)",
        line=dict(color="blue"),
    ))
    fig.add_trace(go.Scatter(
        x=list(df.index), y=list(y_pred_train),
        mode="lines+markers", name="Previsto",
        line=dict(dash="dash", color="orange"),
    ))
    fig.update_layout(
        title="SB=F: Real vs Previsto (treino)",
        xaxis_title="Ano",
        yaxis_title="Preço (¢/lb)",
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Tabela histórico detalhado ────────────────────────────────────────────
    st.subheader("Histórico de Treino")
    hist_df = pd.DataFrame({
        "Ano": list(df.index),
        "SB=F Real": [round(float(v), 4) for v in y],
        "SB=F Previsto": [round(float(v), 4) for v in y_pred_train],
        "Resíduo": [round(float(r), 4) for r in residuals],
    })
    st.dataframe(hist_df, use_container_width=True)
