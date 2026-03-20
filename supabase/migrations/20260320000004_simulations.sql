CREATE TABLE IF NOT EXISTS public.simulations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ticker             TEXT NOT NULL,
  preco_inicial      NUMERIC NOT NULL,
  dias_simulados     INT NOT NULL,
  num_simulacoes     INT NOT NULL,
  pct_bound          NUMERIC NOT NULL,
  p5                 NUMERIC,
  p20                NUMERIC,
  p25                NUMERIC,
  p50                NUMERIC,
  p75                NUMERIC,
  p80                NUMERIC,
  p95                NUMERIC,
  percentiles_series JSONB,
  label              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulations_user_id ON public.simulations (user_id);
