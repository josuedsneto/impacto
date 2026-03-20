# External Integrations

**Analysis Date:** 2025-03-20

## APIs & External Services

**Market Data (yfinance):**
- Yahoo Finance API via yfinance library
  - Fetches live prices for assets: SB=F (sugar), USDBRL=X (USD/BRL), CL=F (crude oil), SBK26.NYB (sugar contract)
  - Historical data from 2013-01-01 to present
  - Used in: `config.py:carregar_dados()`, `utils.py:get_prices_title()`, all pages
  - Caching: 1-hour TTL on historical data, 5-minute TTL on dashboard prices
  - SDK/Client: yfinance (Python package)
  - No authentication required (public data)

**Brazilian Central Bank (BCB) API:**
- python-bcb client for macroeconomic data
  - Fetches market expectations: Expectativas Anuais, Expectativas Mensais
  - Indicators: Câmbio (exchange rate), Selic (reference rate)
  - Used in: `pages/16_Relatorio_Focus.py`, `pages/17_Expectativa_Focus.py`
  - SDK/Client: python-bcb
  - Auth: None (public API)
  - Lazy imported (inside functions, not top-level)

**Google News RSS:**
- Multiple Google News RSS feeds for financial news
  - Feeds configured in `pages/22_Notícias.py` with 6 categories:
    - Açúcar — Internacional (sugar market futures)
    - Açúcar — Brasil (Brazilian sugar)
    - Etanol — Brasil (ethanol prices)
    - Dólar / Câmbio (USD/BRL exchange)
    - Agronegócio Brasil (agricultural news)
    - Commodities Globais (global commodities)
  - Fetching: HTTP GET with User-Agent header
  - Parsing: XML ElementTree (`xml.etree.ElementTree`)
  - Caching: 30-minute TTL
  - SDK/Client: requests + stdlib XML parser
  - Auth: None (public RSS)

## Data Storage

**Databases:**
- Not used - stateless application

**File Storage:**
- Local filesystem only
  - `ibea.png` - Logo image displayed on login and pages
  - No persistent data storage between sessions

**Caching:**
- Streamlit session state (`st.session_state`) - In-memory, per-user
  - Login state: `logged_in` boolean
  - Username/password inputs: `username`, `password` keys
  - TTL: Session duration
- yfinance result caching: 1-3600 seconds depending on endpoint

## Authentication & Identity

**Auth Provider:**
- Custom implementation via `utils.py:require_login()`
  - Credentials: `login_username`, `login_password` from Streamlit secrets
  - Fallback: Environment variables `LOGIN_USERNAME`, `LOGIN_PASSWORD`
  - Session state: `st.session_state.logged_in` boolean
  - Every page imports and calls `require_login()` to enforce authentication
  - No password hashing, plain-text comparison
  - Execution stops if not authenticated: `st.stop()`

**Implementation:**
- Streamlit secrets stored in `.streamlit/secrets.toml` (development)
- Environment variables on Render (production)
- No database or external identity provider

## Email & Notifications

**Outgoing Email:**
- SMTP via Gmail
  - Server: `smtp.gmail.com` port 587
  - TLS enabled
  - Credentials: `smtp_email`, `smtp_password` from secrets or env vars
  - Used in: `pages/10_Mercado.py:enviar_alerta()` for market alerts
  - Format: MIMEText emails with technical indicator status
  - Error handling: Try/except with Streamlit error display

## Monitoring & Observability

**Error Tracking:**
- Not configured - errors logged to console/stderr only

**Logs:**
- Streamlit default logging (stdout/stderr)
- No centralized logging, log aggregation, or error tracking service

## CI/CD & Deployment

**Hosting:**
- Render.com (Platform-as-a-Service)
  - Web service configuration: `render.yaml`
  - Runtime: Python 3.11
  - Port: Dynamic `$PORT` environment variable
  - Address: `0.0.0.0` (all interfaces)

**CI Pipeline:**
- Not configured (no GitHub Actions, no pre-commit hooks)
- Manual deployment: Push to main branch triggers Render redeploy

## Environment Configuration

**Required env vars (Production on Render):**
- `LOGIN_USERNAME` - Application login username
- `LOGIN_PASSWORD` - Application login password
- `PYTHON_VERSION` - Set to "3.11" in render.yaml

**Optional env vars:**
- `smtp_email` - Gmail address for sending alerts
- `smtp_password` - Gmail app password for SMTP
- `STREAMLIT_SERVER_PORT` - Overridden by `$PORT` in Render
- `STREAMLIT_SERVER_ADDRESS` - Set to `0.0.0.0` in Render command

**Secrets location (Development):**
- `.streamlit/secrets.toml` file (Streamlit convention)
- Contents: `login_username`, `login_password`, `smtp_email`, `smtp_password`
- Not committed to git (in `.gitignore`)

**Secrets location (Production):**
- Render environment variables
- Set via Render dashboard or `.env` file in project root

## Webhooks & Callbacks

**Incoming:**
- None (stateless Streamlit app, no webhook endpoints)

**Outgoing:**
- None (unidirectional API calls only)

## Rate Limiting & Quotas

**yfinance:**
- Public API, no authentication required
- Subject to Yahoo Finance rate limits (typically 2000 requests/hour)
- Mitigated by aggressive caching: 1-hour TTL on historical data, 5-minute TTL on latest prices

**python-bcb:**
- Brazilian Central Bank public API
- No explicit rate limit documented
- Data endpoint queries are synchronous, no batch operations

**Google News RSS:**
- RSS feeds are public, no rate limiting observed
- User-Agent header included to identify application

---

*Integration audit: 2025-03-20*
