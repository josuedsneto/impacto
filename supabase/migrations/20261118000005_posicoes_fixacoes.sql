-- Posições de fixação e política de hedge por usina e safra (posicoes-fixacoes, R5/R6/R8/R9/R10)

CREATE TABLE IF NOT EXISTS public.posicoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usina_id       UUID NOT NULL REFERENCES public.usinas ON DELETE RESTRICT,
  safra          TEXT NOT NULL CHECK (safra ~ '^[0-9]{4}/[0-9]{2}$'),
  instrumento    TEXT NOT NULL CHECK (instrumento IN (
                   'fixacao_acucar', 'futuro_acucar', 'ndf_dolar', 'opcao_acucar', 'opcao_dolar')),
  volume         NUMERIC(16,2) NOT NULL CHECK (volume > 0),
  preco_fixado   NUMERIC(12,4) NOT NULL CHECK (preco_fixado > 0),
  cambio_fixado  NUMERIC(10,4) CHECK (cambio_fixado IS NULL OR cambio_fixado > 0),
  premio         NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (premio >= 0),
  vencimento     DATE,
  contraparte    TEXT,
  observacao     TEXT,
  criado_por     UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posicoes_usina_safra ON public.posicoes (usina_id, safra);

CREATE TABLE IF NOT EXISTS public.politica_hedge (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usina_id              UUID NOT NULL REFERENCES public.usinas ON DELETE RESTRICT,
  safra                 TEXT NOT NULL CHECK (safra ~ '^[0-9]{4}/[0-9]{2}$'),
  minimo_pct            NUMERIC(6,2) CHECK (minimo_pct IS NULL OR (minimo_pct >= 0 AND minimo_pct <= 100)),
  maximo_pct            NUMERIC(6,2) CHECK (maximo_pct IS NULL OR (maximo_pct >= 0 AND maximo_pct <= 100)),
  producao_estimada_t   NUMERIC(16,2) CHECK (producao_estimada_t IS NULL OR producao_estimada_t > 0),
  CHECK (minimo_pct IS NULL OR maximo_pct IS NULL OR minimo_pct <= maximo_pct),
  UNIQUE (usina_id, safra)
);

-- RLS: somente membros da usina (user_usinas), em todas as operações.
ALTER TABLE public.posicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posicoes: membros leem"
  ON public.posicoes FOR SELECT
  USING (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()));

CREATE POLICY "posicoes: membros inserem"
  ON public.posicoes FOR INSERT
  WITH CHECK (
    usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid())
    AND criado_por = auth.uid()
  );

CREATE POLICY "posicoes: membros alteram"
  ON public.posicoes FOR UPDATE
  USING (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()))
  WITH CHECK (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()));

CREATE POLICY "posicoes: membros apagam"
  ON public.posicoes FOR DELETE
  USING (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()));

ALTER TABLE public.politica_hedge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "politica_hedge: membros leem"
  ON public.politica_hedge FOR SELECT
  USING (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()));

CREATE POLICY "politica_hedge: membros inserem"
  ON public.politica_hedge FOR INSERT
  WITH CHECK (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()));

CREATE POLICY "politica_hedge: membros alteram"
  ON public.politica_hedge FOR UPDATE
  USING (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()))
  WITH CHECK (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()));

CREATE POLICY "politica_hedge: membros apagam"
  ON public.politica_hedge FOR DELETE
  USING (usina_id IN (SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()));
