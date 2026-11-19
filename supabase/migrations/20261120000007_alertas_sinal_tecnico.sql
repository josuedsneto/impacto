-- alertas-v3 (ALE-12): tipo sinal_tecnico. Mesmo padrão da 20261119000002 (troca o CHECK de tipo).
ALTER TABLE public.alert_rules DROP CONSTRAINT IF EXISTS alert_rules_tipo_check;
ALTER TABLE public.alert_rules ADD CONSTRAINT alert_rules_tipo_check
  CHECK (tipo IN ('preco_cruza', 'variacao_diaria', 'vol_acima', 'prob_cruzar', 'posicao_limite', 'sinal_tecnico'));
