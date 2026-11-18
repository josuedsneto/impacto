-- atr_simulacoes: a policy de UPDATE não tinha WITH CHECK, então um usuário podia
-- mover a própria simulação para outra usina (usina_id). Corrige em duas camadas:
--  1) authenticated fica só com SELECT (REVOKE ALL tira também TRUNCATE, REFERENCES
--     e TRIGGER, que o Supabase concede por padrão). Escrita é do backend (service role).
--  2) policy de UPDATE com USING e WITH CHECK fixando user_id = auth.uid().
--     Com o item 1, esta policy não tem efeito prático; fica como defesa em profundidade.
REVOKE ALL ON TABLE public.atr_simulacoes FROM authenticated;
GRANT SELECT ON TABLE public.atr_simulacoes TO authenticated;

DROP POLICY IF EXISTS "atr_simulacoes: users update own rows" ON public.atr_simulacoes;

CREATE POLICY "atr_simulacoes: users update own rows"
  ON public.atr_simulacoes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
