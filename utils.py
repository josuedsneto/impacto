import streamlit as st
import yfinance as yf


def require_login():
    """Show login form and stop execution if not authenticated."""
    if "logged_in" not in st.session_state:
        st.session_state.logged_in = False
    if not st.session_state.logged_in:
        try:
            st.image("ibea.png", use_container_width=True)
        except Exception:
            pass
        st.title("Login")
        st.text_input("Login", key="username")
        st.text_input("Senha", type="password", key="password")
        expected_user = st.secrets.get("login_username", "")
        expected_pass = st.secrets.get("login_password", "")
        if st.button("Entrar"):
            if (st.session_state.get("username") == expected_user and
                    st.session_state.get("password") == expected_pass):
                st.session_state.logged_in = True
                st.rerun()
            else:
                st.error("Login ou senha incorretos.")
        st.stop()


def show_logo(width=500):
    try:
        st.image("./ibea.png", width=width)
    except Exception:
        pass


@st.cache_data(ttl=300)
def get_prices_title():
    try:
        dolar = yf.Ticker("USDBRL=X").history(period="2d")["Close"].iloc[-1]
        acucar = yf.Ticker("SB=F").history(period="2d")["Close"].iloc[-1]
        petroleo = yf.Ticker("CL=F").history(period="2d")["Close"].iloc[-1]
        return dolar, acucar, petroleo
    except Exception:
        return None, None, None
