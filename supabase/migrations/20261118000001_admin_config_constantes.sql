-- HARD-04: constantes de negócio editáveis pelo admin.
-- Valores iniciais = os que estavam fixos no código, então nada muda no dia da troca.
-- on conflict do nothing: não sobrescreve valor que o admin já tenha alterado.
insert into admin_config (key, value, description, updated_at) values
  ('fator_conversao_mtm', '22.928048',
   'Fator de conversão do valor de mercado (cents/lb → R$/t): 22,0462 × 1,04. Usado em Metas, Risco e Cenários.',
   current_date),
  ('risco_custo_fixo_1', '109212811',
   'Custo fixo 1 do Risco (R$): primeira parcela da fórmula de custo. Confirmar a rubrica.',
   current_date),
  ('risco_custo_fixo_2', '32947347',
   'Custo fixo 2 do Risco (R$): segunda parcela da fórmula de custo. Confirmar a rubrica.',
   current_date),
  ('cenarios_custo_fixo_1', '88704735',
   'Custo fixo 1 de Cenários (R$): primeira parcela da fórmula de custo. Confirmar a rubrica.',
   current_date),
  ('cenarios_custo_fixo_2', '43732035',
   'Custo fixo 2 de Cenários (R$): segunda parcela da fórmula de custo. Confirmar a rubrica.',
   current_date),
  ('cenarios_custo_fixo_3', '20286465',
   'Custo fixo 3 de Cenários (R$): terceira parcela da fórmula de custo. Confirmar a rubrica.',
   current_date)
on conflict (key) do nothing;

-- A chave do breakeven pode não existir em ambientes novos (o seed está em .planning).
insert into admin_config (key, value, description, updated_at)
values ('breakeven_fator_conversao', '1.12045',
        'Fator de conversão cents/lb → R$/saca (0,022046 × 50,802). Usado no Breakeven.',
        current_date)
on conflict (key) do nothing;
