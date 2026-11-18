-- Criação de admin_config. Antes estava só em .planning/; a migration
-- 20260403000001_admin_config_rls.sql falhava num banco novo sem esta tabela.
-- Idempotente: em bancos onde a tabela já existe, não faz nada.
CREATE TABLE IF NOT EXISTS public.admin_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT,
  updated_at  DATE
);

INSERT INTO public.admin_config (key, value, description, updated_at)
VALUES (
  'breakeven_fator_conversao',
  '1.12045',
  'Fator de conversão cents/lb → R$/saca (0.022046 × 50.802)',
  current_date
)
ON CONFLICT (key) DO NOTHING;
