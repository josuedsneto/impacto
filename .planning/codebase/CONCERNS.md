# Codebase Concerns

**Analysis Date:** 2025-03-20

## Tech Debt

**Broad Exception Handling:**
- Issue: Multiple `except Exception:` blocks catch all exceptions without specific handling or logging, masking errors and complicating debugging
- Files: `utils.py` (lines 14, 38, 49), `pages/10_Mercado.py` (line 74), `pages/22_Notícias.py` (line 67)
- Impact: Silent failures make it difficult to diagnose why features aren't working. Users see "—" instead of prices or missing news without knowing why. Errors swallowed in image loading (`show_logo()`) make it hard to troubleshoot logo rendering
- Fix approach: Replace bare `except Exception` with specific exception types (`FileNotFoundError`, `IOError`, `requests.RequestException`). Log errors to stderr or Streamlit sidebar. For UI-critical operations like `show_logo()`, add explicit logging or use Streamlit's error display

**Hardcoded Financial Parameters:**
- Issue: Critical business logic parameters hardcoded directly in page code instead of centralized configuration
- Files: `pages/13_Black_Scholes.py` (lines 27-29: assets dict, volatilities, risk_free_rate), `pages/14_Cenários.py` (lines 16-19: magic numbers for EBITDA calculation), `pages/08_Payoff_Opções.py` (line 15: 1120 contract multiplier)
- Impact: Parameters must be updated in multiple places; changes risk inconsistency. Business logic scattered across files makes it impossible to validate calculations. No audit trail of parameter changes
- Fix approach: Move all financial parameters to `config.py`. Create a `PARAMETERS` dict with: expiry dates, volatility assumptions, risk-free rate, contract specifications (multipliers, tick sizes). Versioning optional but recommended

**Infinite Loop in Break-Even Calculation:**
- Issue: `encontrar_break_even()` in `pages/14_Cenários.py` (lines 23-39) uses unbounded `while` loops that increment in fixed steps without convergence criteria or iteration limits
- Files: `pages/14_Cenários.py` (lines 23-39)
- Impact: Can hang indefinitely if target is unreachable or if the formula is misconfigured. User has no feedback and must restart app. In production, will consume resources
- Fix approach: Add max iteration limit (`max_iterations=10000`). Use binary search instead of linear increment. Add convergence tolerance. Log final iteration count

**Unvalidated User Input in Numerical Simulations:**
- Issue: Pages accept user input via `st.number_input()` and `st.text_input()` without range validation or type checking before calculations
- Files: `pages/07_Jump_Diffusion.py` (line 30: sigma as string), `pages/14_Cenários.py` (lines 70-72: NY/Moagem/Cambio without bounds), `pages/08_Payoff_Opções.py` (lines 26-28: price ranges checked only in UI)
- Impact: Invalid/extreme values (negative sigma, prices of 1000+) pass to math functions causing NaN, inf, or nonsensical results. Users not warned. No input validation contract
- Fix approach: Add explicit validation functions. Check bounds before passing to calculations. Use `st.number_input()` with appropriate `min_value/max_value/step`. Log warnings for out-of-range inputs

**Bare `return None` Without Documentation:**
- Issue: Several functions silently return None on error without documenting expected return types
- Files: `utils.py` lines 49-50 (`get_prices_title()` returns tuple with Nones), `pages/22_Notícias.py` lines 67-68 (`buscar_noticias()` returns empty list on any exception)
- Impact: Callers must check for None/empty; inconsistent handling. Downstream code may not handle None gracefully
- Fix approach: Use proper type hints. Document return types. Consider raising exceptions instead of returning None. Ensure all callers handle None/empty cases

## Known Bugs

**yfinance Download to Future Date:**
- Issue: `pages/07_Jump_Diffusion.py` line 34 downloads data with `end="2099-01-01"` to get all available data, but this is a hack that will fail once market data advances
- Symptoms: Data fetch may fail or be unnecessarily slow; code appears buggy
- Files: `pages/07_Jump_Diffusion.py` (line 34)
- Trigger: Run page after data becomes available up to 2099
- Workaround: Use `date.today()` or `None` (yfinance default = today)
- Fix approach: Replace hardcoded future date with `pd.Timestamp.today()` or remove the parameter entirely

**Inconsistent Date Input Handling:**
- Issue: Pages use both `date()` and `pd.Timestamp()` interchangeably without consistent conversion
- Files: `pages/09_Monte_Carlo.py` (line 47: `pd.to_datetime('today')`), `pages/10_Mercado.py` (line 82: `date.today().strftime()`), `pages/20_ARIMA_Açúcar.py` and `21_ARIMA_Dólar.py` (similar pattern)
- Symptoms: Occasional type mismatch errors in date comparisons or pandas operations
- Fix approach: Standardize on `pd.Timestamp` for all date handling or on `datetime.date`

**CCI Indicator Implementation Gap:**
- Issue: `pages/10_Mercado.py` line 115 calculates CCI entry points with a peak detection condition, but `soma_fechamentos_entradas` is never updated for CCI, only initialized to 0
- Symptoms: CCI metrics always show "Média dos Fechamentos das Entradas: 0.00" even when entry points exist
- Files: `pages/10_Mercado.py` (lines 114-120)
- Fix approach: Add conditional block after line 116 to update `soma_fechamentos_entradas` like is done for EWMA (line 103)

**Email Alert Always Hardcoded:**
- Issue: `pages/10_Mercado.py` line 166 always sends alert with status "Normal, Normal, Normal, Normal" regardless of actual indicator values
- Symptoms: User receives emails with misleading information; alert system non-functional
- Files: `pages/10_Mercado.py` (line 166)
- Fix approach: Compute actual status strings from indicator values, not hardcoded

**Matplotlib Figure Not Closed:**
- Issue: `pages/06_Volatilidade.py` line 52 creates matplotlib figure but never calls `plt.close()`, causing memory leak with repeated runs
- Symptoms: Memory usage increases with each calculation; app becomes slow over time
- Files: `pages/06_Volatilidade.py` (line 52)
- Fix approach: Add `plt.close()` after `st.pyplot(fig)` or use context manager

## Security Considerations

**Credentials Retrieved Without Fallback Error Handling:**
- Risk: `utils.py` lines 20-24 attempt to load login credentials from `st.secrets`, but catch `FileNotFoundError` and fall back to env vars. If both are missing, empty strings are used silently
- Files: `utils.py` (lines 20-24)
- Current mitigation: Credentials are checked before environment is deployed (Render or local)
- Recommendations: Log a warning if both sources are missing. Use startup validation to ensure credentials are configured before app starts. Consider requiring login only for production, not local dev

**HTML Injection via Google News:**
- Risk: `pages/23_Opções.py` line 14-16 embeds external image URL directly in `unsafe_allow_html=True`
- Files: `pages/23_Opções.py` (lines 14-16)
- Current mitigation: URL is controlled by us, not user-supplied
- Recommendations: Remove `unsafe_allow_html=True` and use `st.image()` instead

**Email Credentials in Secrets:**
- Risk: SMTP credentials in `.streamlit/secrets.toml` (email alert feature)
- Files: `pages/10_Mercado.py` (lines 61-62), `.streamlit/secrets.toml` (implied)
- Current mitigation: `.streamlit/secrets.toml` not in version control (should be in .gitignore)
- Recommendations: Use environment variables on Render (already set up in `render.yaml`). Validate credentials on startup

**No Input Validation for Pandas Operations:**
- Risk: Pages use user input directly in DataFrame operations without validation
- Files: `pages/10_Mercado.py` (line 91: `data_filtrado` filters on user date range), `pages/16_Relatorio_Focus.py` (lines 30-31: user text input `data_referencia`)
- Current mitigation: Streamlit date picker prevents invalid dates; text input is unvalidated
- Recommendations: Add explicit validation for `data_referencia` format before passing to BCB API

## Performance Bottlenecks

**Repeated yfinance Downloads Without Aggregation:**
- Problem: Each page independently downloads the same ticker data (e.g., "SB=F" in 09_Monte_Carlo, 23_Opções, 06_Volatilidade, etc.) even if user navigates between pages
- Files: Across all pages (`09_Monte_Carlo.py`, `23_Opções.py`, `06_Volatilidade.py`, `20_ARIMA_Açúcar.py`, etc.)
- Cause: `@st.cache_data(ttl=3600)` caches within the page context, not globally. Different pages have different cache keys
- Improvement path: Move all yfinance calls to centralized `config.py` or create a `data.py` module with shared cache. Use longer TTL for stable data

**10,000 Simulations Without Parallelization:**
- Problem: Monte Carlo simulations run 10,000 iterations sequentially (`pages/09_Monte_Carlo.py` line 61, `pages/23_Opções.py` line 46)
- Cause: NumPy operations are vectorized but no multi-threading
- Improvement path: Acceptable for single user, but in production (Render) with multiple concurrent users, blocking on 10k sims × multiple users will cause slowness. Consider allowing user-configurable simulation count. NumPy is single-threaded; vectorization is sufficient for now

**Excel Writing in Memory:**
- Problem: `pages/10_Mercado.py` line 109 and similar write full DataFrames to Excel in memory without streaming
- Cause: Using `BytesIO()` buffer
- Improvement path: Acceptable for typical datasets. Monitor if users export large datasets. Consider chunking if needed

**CSV File Loading Deprecated (Mentioned in MEMORY but still possible):**
- Problem: Older code may reference CSV files which are no longer used (migrated to yfinance)
- Files: Likely none currently, but `SBV24.csv` appears in git status as modified
- Cause: Refactor completed per MEMORY but stray references or files may exist
- Improvement path: Clean up any CSV references. Ensure no pages attempt to load CSV

## Fragile Areas

**Login System with Session State Dependency:**
- Files: `utils.py` (lines 7-32)
- Why fragile: Relies on `st.session_state` which is reset on script reruns. If user navigates to a page directly, rerun stops at login check. No password hashing; credentials are plaintext in config
- Safe modification: Use Streamlit's experimental session state features carefully. Consider decorator pattern to enforce login before page code runs
- Test coverage: No tests; manual verification only

**Monte Carlo Simulation with Clipped Prices:**
- Files: `pages/09_Monte_Carlo.py` (lines 25-30), `pages/23_Opções.py` (lines 25-39)
- Why fragile: `np.clip()` hard limits prices to user-defined bounds. If bounds are wrong, simulation output is nonsensical but appears valid. Percentile calculations assume normal distribution but clipping violates this assumption
- Safe modification: Document why clipping is needed. Validate bounds before simulation. Consider warning user if many paths hit the clip limits
- Test coverage: No validation that outputs make sense

**Hard-Coded Financial Formulas:**
- Files: `pages/14_Cenários.py` (lines 15-20)
- Why fragile: EBITDA formula uses many magic numbers (89.45, 0.8346, 22.0462, 0.60, etc.) with no documentation of their meaning. Any typo produces wrong results silently
- Safe modification: Extract numbers to named constants with units/sources. Add formula documentation. Consider separating calculation from display
- Test coverage: No tests for formula correctness

**Exception Handlers with No Logging:**
- Files: `utils.py` (lines 14, 38, 49), `pages/22_Notícias.py` (line 67)
- Why fragile: Errors are silently swallowed. Debugging production issues impossible without user's exact steps
- Safe modification: Log all exceptions. Use structured logging with context (user, page, timestamp)
- Test coverage: No tests for error paths

## Scaling Limits

**Single-User Streaming App Without Concurrent Caching:**
- Current capacity: Designed for single user per instance; multiple users share cache but not sessions
- Limit: 5+ concurrent users on Render free tier will cause slowness due to:
  - Monte Carlo waiting on 10k simulations
  - yfinance API rate limiting (if multiple pages hit simultaneously)
  - Matplotlib/Plotly rendering blocking
- Scaling path: Deploy on Render paid plan. Add worker management. Consider async task queue for heavy computations (Celery, but adds complexity)

**BCB API Dependency Without Fallback:**
- Current capacity: `pages/16_Relatorio_Focus.py` and `17_Expectativa_Focus.py` depend on `python-bcb` library hitting BCB's API
- Limit: BCB API downtime blocks these pages entirely; no cached fallback
- Scaling path: Add local cache of historical Focus data. Implement exponential backoff for API calls

**Memory Usage on Large Historical Downloads:**
- Current capacity: Typical yfinance downloads (13 years of daily data = ~3300 rows) are fine
- Limit: If app scales to 20+ pages each downloading independently, memory could become an issue
- Scaling path: Implement data repository pattern. Share downloads across pages

## Dependencies at Risk

**python-bcb (Python-only binding):**
- Risk: Maintains unofficial Python binding to BCB API. If maintainer stops supporting or BCB changes API, pages 16 & 17 break
- Impact: 2 pages depend on it; users lose access to official market expectations
- Migration plan: Implement direct HTTP requests to BCB public API. Use `requests` library instead of `python-bcb`

**Streamlit 1.42.0 (Pinned):**
- Risk: Older version (release: early 2025). May have security vulnerabilities
- Impact: Not known to have issues, but pinned version prevents security updates
- Migration plan: Move to `streamlit>=1.42.0` to allow patch updates. Test monthly for regressions

**arch (for GARCH modeling):**
- Risk: Specialized package for volatility modeling. If unmaintained, may not work with future NumPy/SciPy versions
- Impact: Pages 06_Volatilidade breaks; conditional volatility calculation unavailable
- Migration plan: Monitor releases. Have fallback to simpler volatility models (EWMA only, already in place)

**Beautiful Soup 4 (Listed but not used):**
- Risk: In requirements.txt but no `import beautifulsoup4` found. Dead dependency
- Impact: Slows installs, adds confusion
- Migration plan: Remove from requirements.txt

## Missing Critical Features

**No Input Validation Utility:**
- Problem: Each page repeats ad-hoc validation logic. No centralized validation schema
- Blocks: Can't ensure consistent validation across app. Makes it hard to add validation rules globally
- Fix approach: Create `validation.py` with schema-based validators. Use `pydantic` or custom decorators

**No Error Logging Infrastructure:**
- Problem: Exceptions swallowed silently; no way to debug production issues
- Blocks: Impossible to monitor app health or diagnose user-reported bugs
- Fix approach: Add structured logging to every page. Use `logging` module. Optionally integrate with Sentry for error tracking

**No Data Persistence Layer:**
- Problem: All data fetched on-demand from yfinance; no app-level caching or local database
- Blocks: Can't query historical user inputs, can't provide data offline, inefficient for multi-user
- Fix approach: (Low priority) Add SQLite cache of yfinance downloads. Implement ttl-based refresh

**No Test Suite:**
- Problem: CLAUDE.md explicitly states "There are no tests"
- Blocks: Can't safely refactor; regressions undetected
- Fix approach: Start with unit tests for `config.py` and `utils.py`. Add smoke tests for each page. Use pytest + fixtures

**No Linting Configuration:**
- Problem: No ESLint, Pylint, Black config. Code style inconsistent
- Blocks: Code review harder; contributions inconsistent
- Fix approach: Add `.pylintrc` or `pyproject.toml` with Black config. Run on CI if added

## Test Coverage Gaps

**Config Module Not Tested:**
- What's not tested: `carregar_dados()` function; yfinance fallback behavior; ATIVOS dict structure
- Files: `config.py`
- Risk: Changes to yfinance parsing could break silently. Hard to validate data quality
- Priority: High (core to all pages)

**Utility Functions Not Tested:**
- What's not tested: `require_login()` session state logic, `get_prices_title()` None handling, `show_logo()` missing file fallback
- Files: `utils.py`
- Risk: Login system could silently break; pages could fail on missing logo
- Priority: High (cross-cutting)

**Monte Carlo Simulation Logic Not Tested:**
- What's not tested: `simulacao_monte_carlo()` with edge cases (negative sigma, zero returns, extreme bounds), clipping behavior, percentile calculations
- Files: `pages/09_Monte_Carlo.py`, `pages/23_Opções.py`
- Risk: Silent calculation errors; incorrect risk estimates given to users
- Priority: High (financial calculation)

**Financial Formulas Not Tested:**
- What's not tested: Black-Scholes formula against known values, EBITDA formula, payoff calculations
- Files: `pages/13_Black_Scholes.py`, `pages/14_Cenários.py`, `pages/08_Payoff_Opções.py`
- Risk: Computational errors not caught; users get wrong prices/breakevens
- Priority: Critical (directly affects user decisions)

**API Integration Not Tested:**
- What's not tested: yfinance download failures, BCB API downtime, RSS feed failures
- Files: All pages that call external APIs
- Risk: Unknown behavior when APIs are down; silent failures
- Priority: Medium (resilience)

**UI Input Validation Not Tested:**
- What's not tested: Behavior with extreme/invalid user inputs (negative prices, dates in past/future, text in number fields)
- Files: All pages with user input
- Risk: Crashes or nonsensical outputs
- Priority: Medium (user experience)

---

*Concerns audit: 2025-03-20*
