-- market_coverage is accessed only by FastAPI via service role key (bypasses RLS).
-- Frontend never reads this table directly. No RLS needed.
CREATE TABLE IF NOT EXISTS public.market_coverage (
  ticker     TEXT PRIMARY KEY,
  first_date DATE NOT NULL,
  last_date  DATE NOT NULL
);
