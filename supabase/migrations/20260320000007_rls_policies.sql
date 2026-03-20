-- simulations
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "simulations: users see own rows"
  ON public.simulations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "simulations: users insert own rows"
  ON public.simulations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "simulations: users delete own rows"
  ON public.simulations FOR DELETE
  USING (auth.uid() = user_id);

-- user_parameters
ALTER TABLE public.user_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_parameters: users see own rows"
  ON public.user_parameters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "user_parameters: users insert own rows"
  ON public.user_parameters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_parameters: users update own rows"
  ON public.user_parameters FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_parameters: users delete own rows"
  ON public.user_parameters FOR DELETE
  USING (auth.uid() = user_id);

-- watchlist
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist: users see own rows"
  ON public.watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "watchlist: users insert own rows"
  ON public.watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist: users delete own rows"
  ON public.watchlist FOR DELETE
  USING (auth.uid() = user_id);

-- tickers_catalog: readable by all authenticated users
ALTER TABLE public.tickers_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickers_catalog: authenticated users can read"
  ON public.tickers_catalog FOR SELECT
  TO authenticated
  USING (true);

-- market_prices: readable by all authenticated users
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_prices: authenticated users can read"
  ON public.market_prices FOR SELECT
  TO authenticated
  USING (true);

-- market_coverage: NO RLS — accessed only by FastAPI via service role key
