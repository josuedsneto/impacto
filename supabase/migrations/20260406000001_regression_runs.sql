CREATE TABLE IF NOT EXISTS public.regression_runs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('dolar', 'acucar')),
  inputs     JSONB NOT NULL,
  resultado  JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regression_runs_user_id ON public.regression_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_regression_runs_tipo    ON public.regression_runs (tipo);

-- RLS: users see and manage only their own rows
ALTER TABLE public.regression_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regression_runs: users see own rows"
  ON public.regression_runs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "regression_runs: users insert own rows"
  ON public.regression_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
