CREATE TABLE IF NOT EXISTS public.user_parameters (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ticker               TEXT NOT NULL,
  volatilidade_custom  NUMERIC CHECK (volatilidade_custom BETWEEN 0 AND 5),
  taxa_livre_risco     NUMERIC CHECK (taxa_livre_risco BETWEEN -0.5 AND 1),
  pct_bound_preferido  NUMERIC CHECK (pct_bound_preferido BETWEEN 0.05 AND 2),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_parameters_user_ticker_key UNIQUE (user_id, ticker)
);
