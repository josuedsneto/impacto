-- Hedge cambial entra nas análises salvas. O CHECK inline da 20261118000004 recebe nome padrão do Postgres.
ALTER TABLE public.analises DROP CONSTRAINT IF EXISTS analises_ferramenta_check;
ALTER TABLE public.analises ADD CONSTRAINT analises_ferramenta_check
  CHECK (ferramenta IN ('var', 'breakeven', 'risco', 'opcoes', 'hedge_cambial'));
