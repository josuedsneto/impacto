-- alertas-v2 (ALE-08): tipo posicao_limite. Troca o CHECK de tipo (o nome padrão é alert_rules_tipo_check).
ALTER TABLE public.alert_rules DROP CONSTRAINT IF EXISTS alert_rules_tipo_check;
ALTER TABLE public.alert_rules ADD CONSTRAINT alert_rules_tipo_check
  CHECK (tipo IN ('preco_cruza', 'variacao_diaria', 'vol_acima', 'prob_cruzar', 'posicao_limite'));
