-- Risco operational Monte Carlo simulations
CREATE TABLE IF NOT EXISTS public.risco_simulations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  inputs       JSONB NOT NULL,
  fat_media    NUMERIC NOT NULL,
  custo_media  NUMERIC NOT NULL,
  ebitda_media NUMERIC NOT NULL,
  results      JSONB NOT NULL,
  label        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risco_simulations_user_id ON public.risco_simulations (user_id);

ALTER TABLE public.risco_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "risco_simulations: users see own rows"
  ON public.risco_simulations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "risco_simulations: users insert own rows"
  ON public.risco_simulations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "risco_simulations: users delete own rows"
  ON public.risco_simulations FOR DELETE USING (auth.uid() = user_id);


-- Cenários breakeven simulations
CREATE TABLE IF NOT EXISTS public.cenarios_simulations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  opcao                TEXT NOT NULL,
  ny                   NUMERIC,
  moagem               NUMERIC,
  cambio               NUMERIC,
  preco_etanol         NUMERIC,
  breakeven            NUMERIC NOT NULL,
  probabilidade_abaixo NUMERIC NOT NULL,
  media                NUMERIC NOT NULL,
  std                  NUMERIC NOT NULL,
  label                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cenarios_simulations_user_id ON public.cenarios_simulations (user_id);

ALTER TABLE public.cenarios_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cenarios_simulations: users see own rows"
  ON public.cenarios_simulations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cenarios_simulations: users insert own rows"
  ON public.cenarios_simulations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cenarios_simulations: users delete own rows"
  ON public.cenarios_simulations FOR DELETE USING (auth.uid() = user_id);
