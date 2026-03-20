# Coding Conventions

**Analysis Date:** 2025-02-20

## Naming Patterns

**Files:**
- Entry point: `Painel.py` (PascalCase for main file)
- Pages: `XX_PageName.py` where XX is a two-digit number (01–23) and PageName is PascalCase with spaces/special chars in filenames (e.g., `08_Payoff_Opções.py`, `09_Monte_Carlo.py`)
- Modules: `config.py`, `utils.py` (snake_case)
- Example files: `23_Opções.py`, `22_Notícias.py`, `20_ARIMA_Açúcar.py`

**Functions:**
- snake_case naming convention (e.g., `simulacao_monte_carlo()`, `carregar_dados()`, `buscar_noticias()`)
- Descriptive names in Portuguese for domain functions (e.g., `calcular_MACD()`, `calcular_pureza_necessaria()`)
- Helper functions use snake_case (e.g., `calcular_dias_uteis()`, `decompor_serie()`, `arima_previsao()`)

**Variables:**
- snake_case for local variables and parameters (e.g., `dias_simulados`, `limite_inferior`, `numero_simulacoes`)
- UPPERCASE for constants (e.g., `ATIVOS`, `MAX_ITEMS`)
- Descriptive Portuguese names (e.g., `media_retornos_diarios`, `desvio_padrao_retornos_diarios`, `valor_strike`)
- Temporary variables use short but clear names (e.g., `col`, `idx`, `n` for loops)

**Types:**
- Type hints used in function signatures (e.g., `def carregar_dados(tipo_ativo: str)`, `def buscar_noticias(url: str) -> list[dict]`)
- Return type annotations present in key functions (e.g., `-> float`, `-> list[dict]`, `-> pd.DataFrame`)

## Code Style

**Formatting:**
- No formatter configured (`.prettierrc` or similar not detected)
- Lines vary in length; no strict limit enforced
- Indentation: 4 spaces (Python standard)
- Comments use `#` for single-line comments, HTML comments in Streamlit markdown strings

**Linting:**
- No ESLint or Flake8 config detected
- No pre-commit hooks or code quality gates
- Coding style is informal with mixed conventions across pages

## Import Organization

**Order:**
1. Standard library imports (`os`, `io`, `datetime`, `xml.etree.ElementTree`, `smtplib`, `email.mime`, `requests`)
2. Third-party imports (`streamlit`, `numpy`, `pandas`, `yfinance`, `scipy`, `scikit-learn`, `plotly`, `matplotlib`, `seaborn`, `statsmodels`, `arch`, `beautifulsoup4`, `python-bcb`)
3. Local imports from `utils` and `config` (e.g., `from utils import require_login, show_logo`)

**Path Aliases:**
- No path aliases detected; imports use relative module names (e.g., `from utils import ...`, `from config import ATIVOS, carregar_dados`)

## Error Handling

**Patterns:**
- Broad exception handling with `except Exception:` is common (seen in `utils.py`, `pages/22_Notícias.py`)
- Specific exception handling occasionally used (e.g., `except FileNotFoundError:` in `utils.py`, `except ET.ParseError:` in `pages/22_Notícias.py`)
- User-facing errors via `st.error()` for error conditions (e.g., in `pages/13_Black_Scholes.py`, `pages/09_Monte_Carlo.py`)
- Warnings via `st.warning()` for validation failures (e.g., in `pages/09_Monte_Carlo.py`)
- Errors raised with descriptive messages (e.g., `raise ValueError("Tipo de opção inválido. Use 'call' ou 'put'.")` in `pages/13_Black_Scholes.py`)
- Silent failures (returning None or empty list) when external calls fail (e.g., `except Exception: return None, None, None` in `utils.py`)

## Logging

**Framework:** Console output via Streamlit UI (no explicit logging framework)

**Patterns:**
- `st.write()` for general display
- `st.error()` for errors
- `st.warning()` for warnings
- `st.info()` for informational messages
- `st.success()` for success confirmations
- `st.spinner()` for long-running operations (e.g., `with st.spinner("Calculando preços das calls...")`)
- No structured logging to files detected

## Comments

**When to Comment:**
- Section headers using `# ---` dividers (e.g., `# --- Live price tiles ---`, `# --- RSS feed definitions ---`)
- Inline comments for non-obvious logic
- Minimal documentation comments in most files

**JSDoc/TSDoc:**
- Basic docstrings used in `utils.py` (e.g., `"""Show login form and stop execution if not authenticated."""` on `require_login()`)
- Most functions lack docstrings; only `utils.py` has documentation on `require_login()`
- No comprehensive docstring standard observed

## Function Design

**Size:** Functions range from ~5 to ~40 lines; most are under 30 lines

**Parameters:**
- Functions accept explicit parameters rather than globals
- Caching decorator `@st.cache_data(ttl=...)` used for expensive operations
- Type hints present in newer functions (e.g., `tipo_ativo: str`, `url: str`, `return: list[dict]`)

**Return Values:**
- Functions return tuples (e.g., `return dolar, acucar, petroleo` from `get_prices_title()`)
- DataFrame returns common (e.g., `return data` from `carregar_dados()`)
- List of dicts returned from parsing (e.g., `return items` from `buscar_noticias()`)
- Void functions common in page-level code (no explicit return)

## Module Design

**Exports:**
- `config.py` exports: `ATIVOS` dict, `carregar_dados()` function
- `utils.py` exports: `require_login()`, `show_logo()`, `get_prices_title()` functions
- Pages are entry points (run via Streamlit)

**Barrel Files:**
- No barrel files detected; imports pull directly from source modules

## Caching Strategy

**Patterns:**
- `@st.cache_data(ttl=...)` decorator used for data-fetching functions to avoid re-fetching on Streamlit reruns
- TTL values vary: 300s (5min) for `get_prices_title()`, 1800s (30min) for `buscar_noticias()`, 3600s (60min) for `carregar_dados()`, `baixar_dados_mc()`
- Cache clearing on manual refresh (e.g., `buscar_noticias.clear()` when "Atualizar notícias" button clicked)
- No session state caching detected; uses Streamlit's built-in `st.session_state` for form inputs

## Code Organization in Pages

**Structure:**
1. Imports at top
2. `st.set_page_config()` call
3. `require_login()` and `show_logo()` calls
4. Function definitions (helpers, calculators, data loaders)
5. Sidebar controls (if applicable)
6. Main Streamlit UI code

**Examples:**
- `pages/23_Opções.py`: Sidebar controls for asset selection and simulation, main content displays results
- `pages/22_Notícias.py`: Feed definitions as constants, fetcher function, then rendering loop
- `pages/09_Monte_Carlo.py`: Data download, simulation function, user input widgets, then visualization

---

*Convention analysis: 2025-02-20*
