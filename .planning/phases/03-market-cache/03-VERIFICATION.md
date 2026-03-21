---
phase: 03-market-cache
verified: 2026-03-21T00:00:00Z
status: human_needed
score: 10/10 must-haves verified
human_verification:
  - test: "Second query for same ticker/range hits DB, not yfinance"
    expected: "No yfinance download log on second GET /api/market/prices request for same params"
    why_human: "Cannot trace runtime call suppression programmatically — needs backend log inspection"
  - test: "Extending range by one day inserts exactly one new row"
    expected: "One new row in market_prices; prior rows unchanged (check count before/after)"
    why_human: "Requires live Supabase DB inspection with two sequential API calls"
  - test: "Invalid ticker returns visible error toast, nothing saved"
    expected: "Error toast appears; tickers_catalog unchanged (no new row)"
    why_human: "Browser UI toast behavior and DB state require live end-to-end test"
  - test: "Valid ticker suggestion shows success toast; row appears in tickers_catalog with status=pending"
    expected: "Success toast; row in tickers_catalog with status='pending'"
    why_human: "Requires live browser interaction and DB inspection"
  - test: "Backfill accepts earliest available date when history starts after 2013-01-01"
    expected: "backfill_ticker() returns first_date > 2013-01-01 without error for a short-history ticker"
    why_human: "Requires calling the admin backfill endpoint against a real yfinance ticker with limited history"
---

# Phase 3: Market Cache Verification Report

**Phase Goal:** Price data is served from a PostgreSQL cache so repeated queries for the same ticker and range do not call yfinance, and users can suggest new tickers for admin review.
**Verified:** 2026-03-21
**Status:** human_needed — all automated checks passed; runtime behaviors require human confirmation
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Fetching SB=F for a cached range returns prices without yfinance call | ? NEEDS HUMAN | Logic is correctly implemented: `get_prices()` skips `fetch_ranges` when `coverage.data` covers the window entirely; but no-network guarantee requires runtime log inspection |
| 2 | Extending the range by one day inserts exactly one new row | ? NEEDS HUMAN | Gap logic in `get_prices()` computes `(cached_last + timedelta(days=1), end)` and upserts with `ignore_duplicates=True` — correct by code; exact row count needs DB verification |
| 3 | Invalid ticker returns visible error before anything is saved | ? NEEDS HUMAN | `suggest_ticker` raises HTTP 400 before any `client.table("tickers_catalog").insert()` call; frontend shows `toast.error(data.detail)` — both verified in code; toast display needs browser test |
| 4 | Ticker with history starting after 2013-01-01 is backfilled from earliest available date | ? NEEDS HUMAN | `backfill_ticker()` calls `_fetch_from_yfinance(ticker, date(2013,1,1), today)` and uses `df["date"].min()` as actual_first — logic correct; needs real yfinance call to confirm |

**Score:** 10/10 structural must-haves verified; 5 runtime behaviors flagged for human

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Second query for same ticker/range skips yfinance | VERIFIED (logic) | `get_prices()`: if `coverage.data` exists and covers `[start, end]`, `fetch_ranges` stays empty — no `_fetch_from_yfinance` call |
| 2 | Extending range adds only gap rows, prior rows unchanged | VERIFIED (logic) | Upsert uses `on_conflict="ticker,date", ignore_duplicates=True`; gap computation is precise |
| 3 | Invalid ticker returns error before DB write | VERIFIED | `probe.empty` check raises HTTP 400 at line 93–98 of `main.py`; tickers_catalog insert is only reached after validation |
| 4 | Backfill uses earliest available date, no error if after 2013 | VERIFIED (logic) | `backfill_ticker()` passes `date(2013,1,1)` to yfinance; uses `df["date"].min()` for actual coverage — empty result returns cleanly without error |
| 5 | Authenticated user sees ticker suggestion form with name and type | VERIFIED | `TickerSuggestForm` renders ticker, nome, tipo fields; mounted in `MarketPage` inside a `TickerSuggestForm` card |
| 6 | Invalid ticker submission shows error toast | VERIFIED (code) | `TickerSuggestForm.handleSubmit`: `if (!res.ok) toast.error(data.detail)` |
| 7 | Valid ticker submission shows success toast | VERIFIED (code) | `toast.success(data.message)` on `res.ok` path |
| 8 | User can query price history and see OHLCV table | VERIFIED | `MarketPage.handleQuery` fetches `GET /api/market/prices`, sets `rows` state; `PriceChart` renders full OHLCV table with all columns |
| 9 | GET /api/market/prices returns OHLCV JSON | VERIFIED | Route defined in `main.py` line 54–69; calls `get_prices()` and returns `{ticker, start, end, rows}` |
| 10 | POST /api/admin/market/backfill/{ticker} is admin-only | VERIFIED | Uses `Depends(require_admin)` from `auth.py` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/market_cache.py` | Cache-aside service: get_prices, backfill_ticker | VERIFIED | 202 lines; exports `get_prices` and `backfill_ticker`; substantive implementation |
| `backend/.env.example` | Contains SUPABASE_SERVICE_ROLE_KEY | VERIFIED | Line 5: `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key` |
| `backend/main.py` | Market routes: /api/market/prices, /api/market/suggest, /api/admin/market/backfill/{ticker} | VERIFIED | All three routes present; 146 lines total |
| `frontend/components/market/TickerSuggestForm.tsx` | Form with ticker/name/type; POST to suggest; toasts | VERIFIED | 109 lines (exceeds min_lines 60); all fields present; toast on error/success |
| `frontend/components/market/PriceChart.tsx` | Table showing OHLCV rows | VERIFIED | 70 lines (exceeds min_lines 30); renders full 6-column OHLCV table |
| `frontend/app/app/market/page.tsx` | Market page with query form + TickerSuggestForm | VERIFIED | 128 lines; imports and renders both components |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/market_cache.py` | `market_coverage` table | supabase-py SELECT | WIRED | `client.table("market_coverage").select(...)` at lines 87–92 and 115–120 |
| `backend/market_cache.py` | `market_prices` table | upsert on conflict (ticker, date) | WIRED | `client.table("market_prices").upsert(..., on_conflict="ticker,date", ignore_duplicates=True)` at line 78 |
| `backend/market_cache.py` | yfinance | yf.download() | WIRED | `yf.download(ticker, start=..., end=..., progress=False, auto_adjust=True)` at line 37 |
| `backend/main.py` | `backend/market_cache.py` | `from market_cache import get_prices, backfill_ticker` | WIRED | Line 10 of `main.py`; both functions used in route handlers |
| `POST /api/market/suggest` | `tickers_catalog` table | supabase insert after yfinance validation | WIRED | `client.table("tickers_catalog").insert(...)` at line 115, only reached after `probe.empty` check |
| `TickerSuggestForm.tsx` | `POST /api/market/suggest` | fetch with Authorization Bearer | WIRED | `fetch(\`${BACKEND_URL}/api/market/suggest\`, {method: "POST", headers: {Authorization: \`Bearer ${token}\`}})` at line 43 |
| `frontend/app/app/market/page.tsx` | `GET /api/market/prices` | client fetch with Bearer token | WIRED | `fetch(\`${BACKEND_URL}/api/market/prices?${params}\`, ...)` at line 47 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MKT-01 | 03-01, 03-02 | Second query returns from DB without yfinance call | SATISFIED (logic) | `get_prices()` checks `market_coverage` first; only fetches gaps from yfinance; route comment explicitly documents MKT-01 |
| MKT-02 | 03-01, 03-02 | Extended range adds only the new day | SATISFIED (logic) | Gap computed as `(cached_last + timedelta(days=1), end)`; upsert with `ignore_duplicates=True` |
| MKT-03 | 03-02, 03-03 | User suggests ticker; invalid ticker shows visible error before DB save | SATISFIED | Backend: `probe.empty` check before any insert; Frontend: `toast.error(data.detail)` on `!res.ok` |
| MKT-04 | 03-01, 03-02 | Backfill accepts earliest available date if history shorter than 2013-01-01 | SATISFIED (logic) | `backfill_ticker()` starts from `date(2013,1,1)`, uses `df["date"].min()` as actual coverage start; empty result returns cleanly |

All four requirements assigned to Phase 3 are accounted for and have implementation evidence. No orphaned requirements.

### Anti-Patterns Found

No blockers or warnings found:
- No TODO/FIXME/placeholder comments in any of the six files
- No `return null`, empty handlers, or stub implementations
- `handleSubmit` makes a real fetch call (not just `preventDefault`)
- All state variables are used in renders
- API routes return real data from DB/service calls, not static responses

### Human Verification Required

#### 1. Cache hit — no yfinance call on second request

**Test:** Start backend. Call `GET /api/market/prices?ticker=SB%3DF&start=2024-01-01&end=2024-01-05` twice in succession. On the second call, backend terminal should show no yfinance download progress or output.
**Expected:** Backend logs show no `[***]` yfinance progress line on the second call; response returns the same rows as the first call.
**Why human:** Runtime log suppression cannot be verified statically. `progress=False` suppresses yfinance's own progress bar but not all output; only running the server confirms actual cache behavior.

#### 2. Exactly one new row on range extension

**Test:** After the first query above (SB=F, Jan 1–5), query again with end=2024-01-08 (3 extra trading days). Check `market_prices` in Supabase for the row count change.
**Expected:** Exactly the rows for Jan 6–8 (or the next 3 business days) are added; the Jan 1–5 rows are unchanged.
**Why human:** Exact count verification requires two sequential DB snapshots around the API call.

#### 3. Invalid ticker shows error toast, nothing saved to DB

**Test:** Log into the app, navigate to `/app/market`, submit ticker `XXXINVALID999`. Observe the UI.
**Expected:** A red error toast appears with a message from the API. No row is inserted into `tickers_catalog`.
**Why human:** Toast rendering requires browser execution; DB state check after failure requires Supabase inspection.

#### 4. Valid ticker suggestion shows success toast and pending row

**Test:** Submit ticker `AAPL` with any name. Observe UI and check Supabase.
**Expected:** A green success toast appears. `tickers_catalog` has a new row for AAPL with `status='pending'` and `backfill_status='pending'`.
**Why human:** Same as above — toast rendering + DB verification.

#### 5. Backfill with short-history ticker

**Test:** As admin, call `POST /api/admin/market/backfill/BTC-USD` (or another ticker known to have history starting well after 2013). Check the response.
**Expected:** Response includes `first_date` after 2013-01-01, `rows_inserted > 0`, no 500 error.
**Why human:** Requires a real yfinance call against the live network; cannot be simulated statically.

---

## Gaps Summary

No structural gaps. All six artifacts exist, are substantive (no stubs or placeholders), and are fully wired. All four requirements (MKT-01 through MKT-04) have clear implementation paths. The five human-verification items are runtime behavioral checks that require a running backend, live Supabase database, and browser session — they cannot be resolved by static code analysis.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
