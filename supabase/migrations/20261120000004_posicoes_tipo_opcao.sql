-- Tipo da opção em posicoes (posicoes-fixacoes v2, POS-V2-10). Nullable: NULL em opção = put (linhas do MVP).
-- Strike já é preco_fixado e prêmio já é premio; só faltava o tipo.

ALTER TABLE public.posicoes ADD COLUMN IF NOT EXISTS tipo_opcao TEXT;

ALTER TABLE public.posicoes DROP CONSTRAINT IF EXISTS posicoes_tipo_opcao_check;
ALTER TABLE public.posicoes ADD CONSTRAINT posicoes_tipo_opcao_check CHECK (
  tipo_opcao IS NULL
  OR (tipo_opcao IN ('call', 'put') AND instrumento IN ('opcao_acucar', 'opcao_dolar'))
);
