-- Briefing idempotente: registra o dia do último envio por usuário (revisão da rodada 2).
ALTER TABLE public.preferencias_usuario ADD COLUMN IF NOT EXISTS briefing_ultimo_envio date;
