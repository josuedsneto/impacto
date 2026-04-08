-- Tabela usinas: lista fixa de usinas gerenciada por admin
CREATE TABLE IF NOT EXISTS public.usinas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela user_usinas: associação admin-managed entre usuários e usinas
CREATE TABLE IF NOT EXISTS public.user_usinas (
  user_id  UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  usina_id UUID NOT NULL REFERENCES public.usinas ON DELETE CASCADE,
  PRIMARY KEY (user_id, usina_id)
);

-- Tabela atr_simulacoes: simulações ATR por usuário/usina
CREATE TABLE IF NOT EXISTS public.atr_simulacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  usina_id       UUID NOT NULL REFERENCES public.usinas ON DELETE CASCADE,
  chuva_mm       NUMERIC(8,2) NOT NULL,
  impureza_pct   NUMERIC(6,3) NOT NULL,
  atr_min        NUMERIC(8,3) NOT NULL,
  atr_esperado   NUMERIC(8,3) NOT NULL,
  atr_max        NUMERIC(8,3) NOT NULL,
  producao_total NUMERIC(14,2),
  compartilhado  BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atr_simulacoes_user_id  ON public.atr_simulacoes (user_id);
CREATE INDEX IF NOT EXISTS idx_atr_simulacoes_usina_id ON public.atr_simulacoes (usina_id);
CREATE INDEX IF NOT EXISTS idx_user_usinas_user_id     ON public.user_usinas (user_id);

-- RLS usinas: leitura aberta a autenticados; escrita apenas via service_role
ALTER TABLE public.usinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usinas: authenticated read"
  ON public.usinas FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS user_usinas: usuário vê apenas suas próprias associações
ALTER TABLE public.user_usinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_usinas: users see own rows"
  ON public.user_usinas FOR SELECT
  USING (auth.uid() = user_id);

-- RLS atr_simulacoes: usuário vê as próprias + compartilhadas da mesma usina
ALTER TABLE public.atr_simulacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atr_simulacoes: users see own rows"
  ON public.atr_simulacoes FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      compartilhado = true
      AND usina_id IN (
        SELECT usina_id FROM public.user_usinas WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "atr_simulacoes: users insert own rows"
  ON public.atr_simulacoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "atr_simulacoes: users update own rows"
  ON public.atr_simulacoes FOR UPDATE
  USING (auth.uid() = user_id);
