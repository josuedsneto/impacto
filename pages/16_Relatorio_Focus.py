import streamlit as st
import pandas as pd
import plotly.graph_objs as go
import io

from utils import require_login, show_logo

st.set_page_config(page_title="Relatório Focus", page_icon="📈", layout="wide")
require_login()
show_logo()

st.title("Consulta às Expectativas de Mercado - Câmbio e Taxa SELIC")
st.subheader("Filtros")

endpoint = st.radio("Expectativa de mercado:", options=["ExpectativasMercadoAnuais", "ExpectativaMercadoMensais"], index=0, format_func=lambda x: "Anuais" if x == "ExpectativasMercadoAnuais" else "Mensais")
data_inicial = st.date_input("Data inicial:", value=pd.to_datetime("2020-01-01"), min_value=pd.to_datetime("2000-01-01"), max_value=pd.Timestamp.today())
data_final = st.date_input("Data final:", value=pd.Timestamp.today(), min_value=pd.to_datetime("2000-01-01"), max_value=pd.Timestamp.today())
data_referencia = st.text_input("Ano de referência (Anuais: 2025 / Mensais: 01/2025):", value="")
base_calculo = st.radio("Tipo de cálculo:", options=[0, 1], index=0, format_func=lambda x: "Respondentes Exclusivos" if x == 1 else "Todos os Respondentes")
indicador = st.radio("Indicador:", options=["Câmbio", "Selic"], index=0)

if st.button("Carregar Dados"):
    from bcb import Expectativas
    with st.spinner("Carregando dados..."):
        try:
            expec = Expectativas()
            ep = expec.get_endpoint(endpoint)
            query = ep.query().filter(ep.Indicador == indicador)
            query = query.filter(ep.Data >= str(data_inicial), ep.Data <= str(data_final))
            if data_referencia:
                query = query.filter(ep.DataReferencia == data_referencia)
            query = query.filter(ep.baseCalculo == base_calculo)
            data = query.collect()
            if data.empty:
                st.warning(f"Nenhum dado encontrado para {indicador}.")
            else:
                st.success(f"{len(data)} registros carregados.")
                st.dataframe(data)
                fig = go.Figure()
                fig.add_trace(go.Scatter(x=data["Data"], y=data["Media"], mode="lines+markers", name="Média", line=dict(color="blue")))
                fig.add_trace(go.Scatter(x=data["Data"], y=data["Maximo"], mode="lines", name="Máximo", line=dict(dash="dash", color="green")))
                fig.add_trace(go.Scatter(x=data["Data"], y=data["Minimo"], mode="lines", name="Mínimo", line=dict(dash="dot", color="red")))
                fig.update_layout(title=f"Expectativas de Mercado — {indicador}", xaxis_title="Data", yaxis_title="Valor", template="plotly_white")
                st.plotly_chart(fig, use_container_width=True)
                output = io.BytesIO()
                with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
                    data.to_excel(writer, index=False, sheet_name=f'Expectativas {indicador}')
                st.download_button(label=f"Baixar dados em Excel", data=output.getvalue(), file_name=f"expectativas_{indicador.lower()}.xlsx", mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        except Exception as e:
            st.error(f"Erro ao carregar os dados: {e}")
