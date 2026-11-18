-- atr_simulacoes: a policy de UPDATE não tinha WITH CHECK, então um usuário podia
-- mover a própria simulação para outra usina (usina_id). Corrige em duas camadas:
--  1) policy com USING e WITH CHECK fixando user_id = auth.uid();
--  2) authenticated perde INSERT/UPDATE/DELETE. O frontend não escreve direto no banco;
--     toda escrita de ATR passa pelo backend (service role). Assim usina_id não muda.
DROP POLICY IF EXISTS "atr_simulacoes: users update own rows" ON public.atr_simulacoes;

CREATE POLICY "atr_simulacoes: users update own rows"
  ON public.atr_simulacoes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.atr_simulacoes FROM authenticated;
