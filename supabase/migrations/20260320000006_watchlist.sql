CREATE TABLE IF NOT EXISTS public.watchlist (
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ticker     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ticker)
);
