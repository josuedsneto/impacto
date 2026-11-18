-- Análises salvas (VaR, Breakeven, Risco do EBITDA, Opções). Tabelas antigas não são migradas.
CREATE TABLE IF NOT EXISTS public.analises (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  ferramenta        TEXT NOT NULL CHECK (ferramenta IN ('var', 'breakeven', 'risco', 'opcoes')),
  titulo            TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 120),
  parametros        JSONB NOT NULL,
  resultado_resumo  JSONB NOT NULL,
  data_referencia   DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analises_user_created
  ON public.analises (user_id, created_at DESC);

ALTER TABLE public.analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analises: users see own rows"
  ON public.analises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "analises: users insert own rows"
  ON public.analises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analises: users update own rows"
  ON public.analises FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analises: users delete own rows"
  ON public.analises FOR DELETE
  USING (auth.uid() = user_id);
