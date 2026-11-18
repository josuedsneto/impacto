-- Alertas de mercado (.specs/features/alertas, ALE-06).
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  tipo            text NOT NULL CHECK (tipo IN ('preco_cruza', 'variacao_diaria', 'vol_acima', 'prob_cruzar')),
  ticker          text NOT NULL,
  params          jsonb NOT NULL,
  canal           text NOT NULL DEFAULT 'email' CHECK (canal IN ('email', 'telegram')),  -- telegram: v2, a API recusa
  ativo           boolean NOT NULL DEFAULT true,
  cooldown_horas  int NOT NULL DEFAULT 24 CHECK (cooldown_horas BETWEEN 24 AND 720),
  ultimo_estado   boolean,
  ultimo_disparo  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alert_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     uuid NOT NULL REFERENCES public.alert_rules ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  dia         date NOT NULL DEFAULT current_date,
  valor       numeric,
  mensagem    text NOT NULL,
  enviado     boolean NOT NULL DEFAULT false,
  erro        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, dia)
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON public.alert_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_user_id ON public.alert_events (user_id, created_at DESC);

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

-- Regras: CRUD só nas próprias linhas.
CREATE POLICY "alert_rules: select own" ON public.alert_rules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "alert_rules: insert own" ON public.alert_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alert_rules: update own" ON public.alert_rules
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alert_rules: delete own" ON public.alert_rules
  FOR DELETE USING (auth.uid() = user_id);

-- Eventos: só leitura das próprias linhas. Escrita é do backend (service role).
CREATE POLICY "alert_events: select own" ON public.alert_events
  FOR SELECT USING (auth.uid() = user_id);
