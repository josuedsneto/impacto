# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
impacto/
├── Painel.py                      # Entry point / dashboard home
├── config.py                      # Asset configuration & data loader
├── utils.py                       # Shared utilities (auth, branding, price fetcher)
├── requirements.txt               # Python dependencies
├── render.yaml                    # Render deployment config
├── pages/                         # Feature pages (Streamlit auto-routes)
│   ├── 01_Introdução.py           # Introduction & platform usage guide
│   ├── 02_ATR.py                  # Average True Range (volatility)
│   ├── 03_Metas.py                # Price target tracking
│   ├── 04_Regressão_Dólar.py      # USD/BRL regression forecast
│   ├── 05_Regressão_Açúcar.py     # Sugar price regression forecast
│   ├── 06_Volatilidade.py         # EWMA & GARCH volatility analysis
│   ├── 07_Jump_Diffusion.py       # Merton jump-diffusion simulation
│   ├── 08_Payoff_Opções.py        # Multi-leg options payoff diagram builder
│   ├── 09_Monte_Carlo.py          # Monte Carlo fan chart (P5–P95)
│   ├── 10_Mercado.py              # Market data & technical indicators
│   ├── 11_Risco.py                # Portfolio risk & currency exposure
│   ├── 12_Breakeven.py            # Operational breakeven calculation
│   ├── 13_Black_Scholes.py        # European option pricing (BSM)
│   ├── 14_Cenários.py             # Price scenario comparison
│   ├── 15_VaR.py                  # Value at Risk estimation
│   ├── 16_Relatorio_Focus.py      # Market expectations (BCB Focus bulletin)
│   ├── 17_Expectativa_Focus.py    # Focus bulletin forecast history
│   ├── 18_Teste_Stress.py         # Extreme market scenario testing
│   ├── 19_Less_Loss.py            # Loss mitigation strategies
│   ├── 20_ARIMA_Açúcar.py         # Sugar price ARIMA forecast
│   ├── 21_ARIMA_Dólar.py          # USD/BRL ARIMA forecast
│   ├── 22_Notícias.py             # Commodities & FX news feed (Google News RSS)
│   └── 23_Opções.py               # European call pricer (Monte Carlo) with results table
├── .streamlit/                    # Streamlit configuration
│   └── secrets.toml               # Credentials (login, SMTP) — NOT COMMITTED
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Generated architecture/structure docs
├── .devcontainer/                 # VS Code dev container setup
├── ibea.png                       # Branding logo
├── noticia1.png, noticia2.png     # News feed images
├── sbv24.csv, sbv24.xls           # Sample sugar futures data
├── (historical CSV files)         # Deprecated (superceded by yfinance)
│   ├── Dados Históricos - Açúcar NY nº11 Futuros (6).csv
│   └── USD_BRL Dados Históricos (2).csv
└── (generated files)              # Outputs from analysis pages
    ├── açúcar_bi.xlsx             # Volatility analysis export
    ├── df_final.xlsx              # Large historical dataset
    └── *.xlsx                     # Other user-exported data
```

## Directory Purposes

**Root Directory:**
- Purpose: Entry point and central configuration
- Key files: `Painel.py` (dashboard), `config.py` (asset definitions), `utils.py` (shared functions)
- Generated: Excel exports from analysis pages

**`pages/`:**
- Purpose: Feature modules auto-routed by Streamlit (one page per file)
- Contains: Financial analysis tools (23 modules total)
- Naming: `NN_ModuleName.py` where NN is 01–23 (controls sidebar order)
- Pattern: Each imports `from utils import require_login, show_logo`

**`.streamlit/`:**
- Purpose: Streamlit app configuration and secrets
- Key file: `secrets.toml` (NOT committed to git)
  - Contains: `login_username`, `login_password`, `smtp_email`, `smtp_password`
- How secrets loaded:
  1. First try: `st.secrets.get("login_username", "")`
  2. Fallback: `os.environ.get("LOGIN_USERNAME", "")` (env vars)

**`.planning/codebase/`:**
- Purpose: Generated GSD codebase documentation
- Contents: `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`
- Usage: Consumed by `/gsd:plan-phase` and `/gsd:execute-phase` commands

## Key File Locations

**Entry Points:**
- `Painel.py`: Main dashboard (run with `streamlit run Painel.py`)
- `pages/01_Introdução.py`: Platform introduction/guide

**Configuration:**
- `config.py`: `ATIVOS` dict with ticker symbols and price bounds
- `requirements.txt`: Python dependencies (21 packages)
- `.streamlit/secrets.toml`: Login credentials and email config (local only)
- `render.yaml`: Render.com deployment manifest (startup script for env vars)

**Core Logic:**
- `config.py`: `carregar_dados(tipo_ativo)` → cached yfinance data loader
- `utils.py`: `require_login()`, `show_logo()`, `get_prices_title()` functions
- Pages: Module-specific logic (simulations, indicators, pricing models)

**Testing:**
- None. No test files, test framework, or CI configuration.

## Naming Conventions

**Files:**
- **Entry point:** `Painel.py` (singular, title case, Portuguese)
- **Utility modules:** `config.py`, `utils.py` (lowercase, single word)
- **Feature pages:** `NN_ModuleName.py` (2-digit prefix for ordering, title case, underscores for spaces)
  - Examples: `09_Monte_Carlo.py`, `08_Payoff_Opções.py`, `23_Opções.py`
- **Data files:** `asset_name_descriptor.csv` or `asset_name_descriptor.xlsx`
  - Examples: `sbv24.csv`, `açúcar_bi.xlsx`

**Directories:**
- **Feature pages:** `pages/` (Streamlit convention, lowercase)
- **Configuration:** `.streamlit/` (Streamlit convention, dot-prefixed)
- **Planning:** `.planning/codebase/` (GSD convention)

**Functions:**
- Snake_case: `carregar_dados()`, `require_login()`, `get_prices_title()`, `simular_calls()`
- Descriptive Portuguese names: `calcular_MACD()`, `calcular_RSI()`, `simular_monte_carlo()`

**Variables:**
- Snake_case: `dias_simulados`, `preco_inicial`, `limite_inferior`, `media_retornos_diarios`
- Portuguese names

**Constants:**
- UPPERCASE for immutable collections: `ATIVOS`, `FEEDS` (RSS feed definitions)

## Where to Add New Code

**New Feature Page:**
- Location: `pages/NN_ModuleName.py` (pick next number in sequence)
- Template structure:
  ```python
  import streamlit as st
  from utils import require_login, show_logo

  st.set_page_config(page_title="Page Title", page_icon="📈", layout="wide")
  require_login()
  show_logo()

  st.title("Page Title in Portuguese")
  # ... page logic
  ```
- Register in `Painel.py`: Add entry to `pages` list (title + description)

**New Asset/Configuration:**
- Location: `config.py` → `ATIVOS` dictionary
- Format: `"Asset Name": {"ticker": "TICKER=F", "valor_minimo_padrao": X, "limite_inferior": Y, "limite_superior": Z}`
- Used by: Any page that imports `from config import ATIVOS, carregar_dados`

**New Shared Utility Function:**
- Location: `utils.py`
- Pattern: Decorate with `@st.cache_data(ttl=XXX)` if involves I/O
- Example: `get_prices_title()` caches for 5 minutes (ttl=300)

**New Analysis/Calculation Module:**
- Approach: Define functions within the page file or add to `utils.py` if reusable
- Pattern: Vectorized NumPy operations for performance
- Example: `calcular_MACD()` in `10_Mercado.py`

**New Data Source:**
- Primary: Fetch via yfinance (online-first, no CSV dependencies)
- Secondary: Use `carregar_dados()` from config
- If custom source required: Add cached fetcher function with `@st.cache_data()` decorator

**Tests:**
- Location: Not applicable (no test framework configured)
- For future: Consider `pytest` + `pages/test_*.py` or dedicated `tests/` directory

## Special Directories

**`__pycache__/`:**
- Purpose: Python bytecode cache
- Generated: Yes (by Python runtime)
- Committed: No (in `.gitignore`)

**`.git/`:**
- Purpose: Version control repository
- Generated: Yes (via `git init`)
- Committed: N/A (metadata directory)

**`node_modules/` or `.venv/`:**
- Purpose: Not present in this Python project
- Note: Dependencies managed via `requirements.txt` (no `package.json` or `pyproject.toml`)

**Old CSV Data Files:**
- Location: Root directory
  - `Dados Históricos - Açúcar NY nº11 Futuros (6).csv`
  - `USD_BRL Dados Históricos (2).csv`
- Status: Deprecated (superceded by yfinance in `config.py`)
- Recommendation: Can be safely removed (not referenced in current code)

**Generated Excel Exports:**
- Examples: `açúcar_bi.xlsx`, `df_final.xlsx`
- Generated by: User exports from analysis pages (e.g., 06_Volatilidade.py)
- Lifecycle: User-specific, can be deleted

---

*Structure analysis: 2026-03-20*
