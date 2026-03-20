# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Multi-page Streamlit web application with modular feature pages

**Key Characteristics:**
- Dashboard-driven architecture with centralized configuration
- Lazy imports for computation-heavy libraries (arch, bcb)
- Session-state managed authentication guard on all pages
- Cached data fetching via yfinance (online-first, no CSV dependencies)
- Vectorized NumPy simulations with Plotly visualization

## Layers

**Configuration Layer:**
- Purpose: Single source of truth for asset definitions and data fetching
- Location: `config.py`
- Contains: `ATIVOS` dictionary, `carregar_dados()` cached data loader
- Depends on: yfinance, pandas, streamlit
- Used by: All pages requiring historical data or asset bounds

**Authentication & UI Layer:**
- Purpose: Login enforcement, branding, live price dashboard
- Location: `utils.py`, `Painel.py`
- Contains: `require_login()`, `show_logo()`, `get_prices_title()` functions
- Depends on: streamlit, yfinance
- Used by: Every page (guard function) and dashboard (price tiles)

**Feature Pages Layer:**
- Purpose: Specialized financial analysis modules (23 pages)
- Location: `pages/` directory (01_Introdução.py through 23_Opções.py)
- Contains: Module-specific logic (Monte Carlo, options pricing, ARIMA, VaR, etc.)
- Depends on: Configuration, utilities, domain libraries (statsmodels, scipy, arch, etc.)
- Used by: End users via Streamlit page router

**Data & Simulation Layer:**
- Purpose: Historical data retrieval, vectorized computations, pricing models
- Location: Distributed across pages and config
- Contains: yfinance calls, NumPy simulation functions, statistical models
- Depends on: yfinance, numpy, pandas, scipy, scikit-learn, arch, statsmodels
- Used by: All feature pages

**Visualization Layer:**
- Purpose: Interactive charting and metric display
- Location: Distributed across pages
- Contains: Plotly figures, Streamlit metrics and column layouts
- Depends on: plotly, streamlit
- Used by: All feature pages

## Data Flow

**Login & Session Flow:**

1. User loads any page (e.g., `pages/09_Monte_Carlo.py`)
2. `require_login()` guard executes at top of page
3. If `st.session_state.logged_in` is False:
   - Display login form (credentials from `.streamlit/secrets.toml` or env vars `LOGIN_USERNAME`, `LOGIN_PASSWORD`)
   - Store auth state in `st.session_state` on successful login
   - `st.stop()` blocks further execution
4. Page continues with authenticated user

**Data Fetch & Cache Flow:**

1. Page imports `carregar_dados()` from `config.py` or fetches directly via yfinance
2. `@st.cache_data(ttl=3600)` (or custom ttl) prevents re-fetching on every interaction
3. yfinance downloads ticker data (e.g., `SB=F`, `USDBRL=X`) with 2013-01-01 start date
4. Data normalized: `Close` price extracted, `Daily Return` calculated as `pct_change()`
5. Cached result returned to caller

**Simulation & Visualization Flow:**

1. User adjusts parameters via Streamlit widgets (inputs, sliders, radio buttons)
2. On button click, simulation function executes with current parameters
3. Vectorized NumPy operations compute outcomes (e.g., 10,000 Monte Carlo paths)
4. Results (prices, percentiles, probabilities) calculated via NumPy operations
5. Plotly figure constructed and rendered via `st.plotly_chart()`
6. Metrics displayed in columns via `st.columns()` and `st.metric()`

**Multi-Leg Options Strategy Flow (08_Payoff_Opções.py):**

1. User specifies number of legs (options contracts)
2. For each leg: position type (Buy/Sell), option type (Call/Put), strike, quantity
3. On simulation: price array generated (e.g., 0–26 ¢/lb in 0.25 increments)
4. For each leg, `calcular_receita()` computes payoff using NumPy vectorized operations
5. Payoffs summed across all legs
6. Final payoff diagram plotted with color based on final P&L sign

**European Call Pricing Flow (23_Opções.py):**

1. User selects asset from `ATIVOS` and time horizon in days
2. Historical data loaded via `carregar_dados()`: mean and std of daily returns calculated
3. For each strike (e.g., 15–35 in 0.25 increments):
   - Monte Carlo simulation run: `simulacao_monte_carlo()` generates 10,000 price paths
   - Returns sampled from normal distribution (mean, std)
   - Prices clipped to bounds, compounded via `np.cumprod`
   - European call payoff evaluated only at final day: `max(final_price - strike, 0)`
   - Fair value = mean payoff across all simulations
4. Results table and graph displayed

## State Management

**Session State:**
- `st.session_state.logged_in`: Boolean, tracks authentication status
- `st.session_state["username"]`: Captured during login
- `st.session_state["password"]`: Captured during login
- `st.session_state["valor_simulado_mc"]`: Persists user's last entered simulation price (09_Monte_Carlo.py)

**Caching:**
- `@st.cache_data(ttl=3600)`: Standard for yfinance calls (1-hour expiry)
- `@st.cache_data(ttl=1800)`: News feeds (22_Notícias.py, 30-min expiry)
- `@st.cache_data(ttl=300)`: Live price tiles (5-min expiry)
- Cache key = function + input parameters

## Key Abstractions

**Asset Configuration (`ATIVOS` dict):**
- Purpose: Centralize ticker symbols, default prices, price bounds
- Example: `ATIVOS["Açúcar"]` = `{"ticker": "SB=F", "limite_inferior": 15, "limite_superior": 35}`
- Used by: Monte Carlo, European call pricer, any page that needs bounds or tickers

**Cached Data Loader (`carregar_dados()`):**
- Purpose: Fetch and normalize historical price data with caching
- Signature: `carregar_dados(tipo_ativo: str) -> (DataFrame, valor_minimo_padrao, limite_inferior, limite_superior)`
- Returns: Historical OHLC data with `Daily Return` column, plus config values

**Simulation Functions:**
- `simulacao_monte_carlo()` (09_Monte_Carlo.py, 23_Opções.py): Generates vectorized price paths
  - Parameters: daily return mean/std, days, simulations count, price bounds
  - Returns: 2D NumPy array (days × simulations)
  - Core: `np.cumprod(1 + returns_array)` to compound returns
- `calcular_receita()` (08_Payoff_Opções.py): Vectorized payoff calculation for options legs
  - Handles all combinations: Buy/Sell × Call/Put
  - Returns: NumPy array of payoffs

**Technical Indicator Functions:**
- `calcular_MACD()`, `calcular_RSI()`, `calcular_bollinger_bands()`, etc. (10_Mercado.py)
- Pattern: Take DataFrame with `Close` column, return DataFrame with computed columns
- Used by: Market page for technical analysis

**Black-Scholes Pricer (`black_scholes()`):**
- Location: `pages/13_Black_Scholes.py`
- Signature: `black_scholes(S, K, T, r, sigma, option_type) -> float`
- Implementation: Standard BSM formula with scipy.stats normal CDF
- Returns: Scalar option price (call or put)

## Entry Points

**Dashboard (Painel.py):**
- Location: `Painel.py`
- Triggers: `streamlit run Painel.py`
- Responsibilities:
  - Sets page config (title, icon, wide layout)
  - Guards with `require_login()`
  - Displays live prices (Dólar, Açúcar, Petróleo) via `get_prices_title()`
  - Renders index of 23 available modules with descriptions
  - Serves as user hub for navigation

**Feature Pages:**
- Location: `pages/` directory (Streamlit auto-routes based on filename)
- Triggers: User navigates via Streamlit sidebar menu
- Naming: `NN_ModuleName.py` (numbers 01–23 for ordering)
- Responsibilities: Module-specific financial analysis
- Consistent pattern:
  - `st.set_page_config()` for title/icon
  - `require_login()` and `show_logo()` guards
  - Sidebar or main area widgets for user input
  - Compute on button click
  - Render results via Plotly + Streamlit metrics

## Error Handling

**Strategy:** Try-except with graceful fallbacks, user-facing error messages via `st.error()`

**Patterns:**

1. **Logo loading** (`utils.py`, `Painel.py`):
   ```python
   try:
       st.image("./ibea.png", width=width)
   except Exception:
       pass  # Silently skip if image missing
   ```

2. **Data validation** (`09_Monte_Carlo.py`):
   ```python
   if dias_simulados <= 0:
       st.warning("A data de simulação deve ser posterior a hoje.")
       st.stop()
   ```

3. **Empty data check** (`06_Volatilidade.py`):
   ```python
   if not data.empty:
       # Process data
   else:
       st.error("Não há dados disponíveis para a data selecionada.")
   ```

4. **API failures** (`utils.py`, `get_prices_title()`):
   ```python
   try:
       dolar = yf.Ticker("USDBRL=X").history(period="2d")["Close"].iloc[-1]
       ...
       return dolar, acucar, petroleo
   except Exception:
       return None, None, None  # Caller checks for None
   ```

5. **Secrets/env fallback** (`utils.py`, `require_login()`):
   ```python
   try:
       expected_user = st.secrets.get("login_username", "")
   except FileNotFoundError:
       expected_user = os.environ.get("LOGIN_USERNAME", "")
   ```

6. **Lazy imports** (multiple pages):
   ```python
   @st.cache_data(ttl=3600)
   def get_historical_data(symbol, start_date, end_date):
       from arch import arch_model  # Import only when called
       ...
   ```

## Cross-Cutting Concerns

**Logging:** No centralized logging. `st.write()`, `st.error()`, `st.warning()` used for user-facing messages.

**Validation:** Widget constraints (min/max values) + explicit checks (e.g., date ranges, numeric bounds).

**Authentication:** Session-state guard via `require_login()`, credentials from `.streamlit/secrets.toml` or env vars.

**Caching:** Streamlit `@st.cache_data()` decorator with TTL, parameterized by input values. No invalidation logic — TTL only.

**Internationalization:** All UI text in Portuguese. Hardcoded (no i18n framework).

**Configuration:** Centralized in `config.py` (ATIVOS) and scattered hardcoded values (e.g., `SBK26.NYB` expiry in 13_Black_Scholes.py).

---

*Architecture analysis: 2026-03-20*
