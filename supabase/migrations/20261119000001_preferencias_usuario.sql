-- Preferências por usuário (alertas-v2, BRF-01): opt-in do briefing diário por e-mail.
CREATE TABLE IF NOT EXISTS public.preferencias_usuario (
  user_id        uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  briefing_email boolean NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.preferencias_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "preferencias_usuario: select own" ON public.preferencias_usuario
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "preferencias_usuario: insert own" ON public.preferencias_usuario
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preferencias_usuario: update own" ON public.preferencias_usuario
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "preferencias_usuario: delete own" ON public.preferencias_usuario
  FOR DELETE USING (auth.uid() = user_id);
