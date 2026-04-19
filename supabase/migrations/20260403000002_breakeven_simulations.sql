CREATE TABLE IF NOT EXISTS public.breakeven_simulations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  preco_acucar_cents_lb NUMERIC NOT NULL,
  preco_dolar_brl       NUMERIC NOT NULL,
  fator_conversao       NUMERIC NOT NULL,
  breakeven_brl_saca    NUMERIC NOT NULL,
  label                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_breakeven_simulations_user_id
  ON public.breakeven_simulations (user_id);

-- RLS: users see and manage only their own rows
ALTER TABLE public.breakeven_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "breakeven_simulations: users see own rows"
  ON public.breakeven_simulations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "breakeven_simulations: users insert own rows"
  ON public.breakeven_simulations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "breakeven_simulations: users delete own rows"
  ON public.breakeven_simulations FOR DELETE
  USING (auth.uid() = user_id);
