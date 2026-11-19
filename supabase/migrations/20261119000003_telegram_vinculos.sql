-- Vínculo do Telegram por usuário (alertas-v2, ALE-09 / DEC-23).
-- Escrita é do backend (service role): gera código, grava chat_id, apaga o vínculo via API.
CREATE TABLE IF NOT EXISTS public.telegram_vinculos (
  user_id        uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  chat_id        bigint UNIQUE,
  codigo         text,
  codigo_expira  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telegram_vinculos: select own" ON public.telegram_vinculos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "telegram_vinculos: delete own" ON public.telegram_vinculos
  FOR DELETE USING (auth.uid() = user_id);
