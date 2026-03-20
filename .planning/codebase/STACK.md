# Technology Stack

**Analysis Date:** 2025-03-20

## Languages

**Primary:**
- Python 3.11 - All application code, data processing, and financial modeling
  - Pinned to 3.11 for Render deployment consistency

## Runtime

**Environment:**
- Python 3.11
- WSGI: Streamlit (built-in server)

**Package Manager:**
- pip
- Lockfile: `requirements.txt` (present, pinned versions)

## Frameworks

**Core:**
- Streamlit 1.42.0 - Web UI framework for multi-page dashboard application
  - Located: `.streamlit/` configuration directory

**Data Processing & Analysis:**
- pandas - Data manipulation, CSV handling, time series operations
- numpy - Numerical computations, vectorized Monte Carlo simulations
- scipy - Statistical functions (scipy.stats for distributions, interpolation)

**Machine Learning & Time Series:**
- scikit-learn - Regression models (Regressão Dólar, Regressão Açúcar pages)
- statsmodels - ARIMA modeling (`pages/20_ARIMA_Açúcar.py`, `pages/21_ARIMA_Dólar.py`)
- xgboost - Gradient boosting for predictive models

**Visualization:**
- plotly - Interactive charts and graphs (all pages using `go.Figure()`)
- matplotlib - Static plotting
- seaborn - Statistical visualization
- altair - Declarative visualization

**Finance & Data:**
- yfinance - Real-time ticker data fetching (SB=F, USDBRL=X, CL=F)
  - Cached with `@st.cache_data(ttl=3600)` to minimize API calls
- python-bcb - Brazilian Central Bank API access (`pages/16_Relatorio_Focus.py`, `pages/17_Expectativa_Focus.py`)
  - Lazy imported inside functions, not top-level
- arch - ARCH/GARCH volatility modeling (`pages/06_Volatilidade.py`)
  - Lazy imported inside functions

**Web & Data Formats:**
- requests - HTTP requests (news feeds in `pages/22_Notícias.py`)
- beautifulsoup4 - HTML/XML parsing
- xlrd - Reading Excel files
- xlsxwriter - Writing Excel files (`openpyxl` also present for multi-engine support)
- pydeck - Geospatial visualization

## Key Dependencies

**Critical:**
- yfinance - Fetches live market data for sugar (SB=F), USD/BRL (USDBRL=X), WTI crude (CL=F)
  - Single source for all historical and current price data
  - Caching strategy: 1-hour TTL on main data loads (`carregar_dados()` in `config.py`)
  - 5-minute TTL on dashboard price tiles (`get_prices_title()` in `utils.py`)

- streamlit - Application framework, session state management, secrets handling
  - Manages login state and credential storage

- python-bcb - Brazilian macroeconomic data from Central Bank
  - Used for market expectations and economic indicators
  - Lazy-loaded to reduce import time

- arch - GARCH model for volatility forecasting
  - Optional import inside volatility pages

**Infrastructure:**
- pandas - Core data transformation for CSV normalization and time series operations
- numpy - Vectorized Monte Carlo simulations (10,000 paths per run)
- scipy.stats - Normal distribution sampling, probability calculations
- statsmodels - ARIMA(p,d,q) models for price forecasting
- plotly - Interactive charting across all 23 pages

## Configuration

**Environment:**
- Streamlit secrets: `.streamlit/secrets.toml`
  - Contains: `login_username`, `login_password`, `smtp_email`, `smtp_password`
  - Fallback: Environment variables `LOGIN_USERNAME`, `LOGIN_PASSWORD`
  - Used in `utils.py:require_login()` for authentication

- Render deployment: `render.yaml`
  - Python 3.11 pinned
  - Build command: `pip install -r requirements.txt`
  - Start command: `streamlit run Painel.py --server.port $PORT --server.address 0.0.0.0`

**Build:**
- `render.yaml` - Infrastructure-as-code for Render platform
- No Docker, no build configuration files beyond render.yaml

## Platform Requirements

**Development:**
- Python 3.11+
- pip with access to PyPI

**Production:**
- Render.com - Platform-as-a-Service hosting
  - Retrieves secrets from environment variables at startup
  - Serves on dynamic port `$PORT` with `0.0.0.0` binding
  - Static assets: `ibea.png` logo file

## Key Technical Notes

**Data Loading Strategy:**
- All market data from yfinance (no CSV dependencies)
- European number format handling removed (was in legacy code)
- Caching decorators prevent redundant API calls:
  - `@st.cache_data(ttl=3600)` on `carregar_dados()` - 1 hour
  - `@st.cache_data(ttl=300)` on `get_prices_title()` - 5 minutes
  - `@st.cache_data(ttl=1800)` on news fetching - 30 minutes

**Simulation Design:**
- Monte Carlo: Vectorized with numpy.cumprod, 10,000 simulations per run
- Price clipping: Applied daily to maintain `[limite_inferior, limite_superior]` bounds
- Returns: Normal distribution parameterized by historical daily mean and std

**Email Integration:**
- SMTP via Gmail (`smtp.gmail.com:587`)
- Credentials: `smtp_email`, `smtp_password` from secrets or env vars
- Used in market alert functionality (`pages/10_Mercado.py`)

---

*Stack analysis: 2025-03-20*
