CREATE TABLE IF NOT EXISTS public.market_prices (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker     TEXT NOT NULL,
  date       DATE NOT NULL,
  open       NUMERIC,
  high       NUMERIC,
  low        NUMERIC,
  close      NUMERIC,
  adj_close  NUMERIC,
  volume     BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT market_prices_ticker_date_key UNIQUE (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_market_prices_ticker_date ON public.market_prices (ticker, date);
