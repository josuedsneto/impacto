# Validação — posicoes-fixacoes

## Evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| POS-01 (criar, 201, criado_por do servidor) | `pytest tests/test_posicoes.py` → `test_criar_grava_criado_por_do_servidor` | PASS |
| POS-01 (403 usina alheia) | `test_criar_em_usina_alheia_responde_403` | PASS |
| POS-02 (422 instrumento, volume, preço, safra, limite de volume e infinito) | `test_validacao_responde_422` (4 casos), `test_volume_fora_do_limite_ou_infinito_responde_422` | PASS |
| POS-03 (editar/apagar; 404 em posição alheia; RLS) | `test_editar_e_apagar_posicao_alheia_responde_404`, `test_editar_e_apagar_posicao_propria`. RLS: revisada no SQL, não executada contra Postgres | PASS (API) / não testado no banco |
| POS-04 (MTM, preço médio, preços de fechamento) | `test_mtm_venda_acucar_bate_com_conta_a_mao` (229.280,48), `test_mtm_put_fora_do_dinheiro_e_so_o_premio`, `test_mtm_ndf_dolar_vendido`, `test_preco_medio_ignora_opcao_e_posicao_sem_cambio`, `test_resumo_com_posicao_marca_contra_fechamento` | PASS |
| POS-05 (status, sem_politica, sem_producao, 503) | `test_pct_fixado_so_conta_acucar_e_status_abaixo`, `test_status_dentro_e_acima`, `test_sem_politica_ou_sem_producao`, `test_resumo_sem_preco_responde_503` | PASS |
| POS-06 (tela, cartões, entrada no menu) | `npm run build` gera `/app/posicoes`; `npm test` (regras de UI: cor por token, `toFixed`, `<h1>`); uso em navegador: **pendente (UAT)** | PASS (build/regras) / UAT pendente |
| POS-07 (importação CSV) | `lib/posicoes.test.ts`: número pt-BR, aspas, rótulo ou código, data dd/mm/aaaa, data inexistente, safra diferente, coluna ausente, limite de 500, reimportação do CSV exportado | PASS |
| POS-08 (exportação CSV) | `gerarCsvPosicoes` com BOM, `;`, vírgula decimal, aspas em texto com `;` | PASS |
| POS-09 (política; min > max = 422; upsert) | `test_politica_upsert_substitui_e_valida_faixa` | PASS |
| POS-10 (edge cases) | `test_resumo_sem_posicoes_nao_busca_preco`, `test_sem_posicoes_preco_medio_nulo`, `test_id_que_nao_e_uuid_responde_422_e_nao_500` | PASS |

## Comandos e resultados

```
cd backend && <venv>/Scripts/python.exe -m pytest tests -q
→ 45 passed, 5 warnings

cd backend && python test_calcs.py      → exit 0
cd backend && python test_mensagens.py  → exit 0

cd frontend && npm test
→ Test Files 14 passed (14), Tests 266 passed (266)

cd frontend && npx tsc --noEmit -p .    → sem erros
cd frontend && npx eslint app/app/posicoes lib/posicoes.ts lib/posicoes.test.ts components/layout/NavLinks.tsx → sem erros

cd frontend && npm run build            → Compiled successfully; rota /app/posicoes gerada
```

`npm run lint` no projeto inteiro **falha** por um erro que já existia e não é desta feature: `components/ui/input.tsx:4` (interface vazia, `@typescript-eslint/no-empty-object-type`). Não alterado aqui.

## Revisão do advisor Opus

Duas revisões (spec e diff final). Aplicado: opções só put (R1), média só com fixação e futuro (R3), escala em pontos percentuais (R2), RLS completo e `criado_por` com SET NULL (R5/R6), 404 em posição alheia (R7), produção nullable (R8), CHECKs no banco (R9), resumo sem posição sem chamar Yahoo (R11), UUID nas rotas (422, não 500), `allow_inf_nan` e limites de tamanho, ordenação estável, validação de data real, separação de milhar só para volume e produção (correção de `5.250` virar 5250), reset de importação/edição ao trocar usina ou safra, safra só busca quando completa, formulário e política continuam visíveis mesmo com 503 de preço.

## Lacunas conhecidas (não feitas)

- **R15, mapeamento de erro do lote no backend:** **resolvido** em `pendencias-pequenas` (PEN-04 a PEN-06). O 422 traz `Linha n (Campo): valor inválido.` e a tela mostra no toast. O frontend continua validando antes de enviar.
- **`limiter` importado de `main`:** import circular. Funciona com `uvicorn main:app` (Procfile e railway.toml). Importar `routers.posicoes` antes de `main` quebra com AttributeError; os testes importam `main` primeiro. Correção definitiva: mover o `limiter` para um módulo próprio. Não feito para não tocar em `main.py` além da linha de include.
- **Fator de conversão:** `FATOR = 22.0462 * 1.04` repetido em `routers/posicoes.py`. Confirmar com a trading (ver Open questions da spec, incluindo a diferença de ~1% para o faturamento de `main.py`).
- **Vencimento:** MTM marcado contra o SB=F da frente, sem ajuste por mês. Aviso fixo na tela.
- **RLS não executada:** o banco de teste não foi usado. Só a API foi testada, com fake do Supabase.
- **Resumo com 503:** a tela mantém formulário e política, mas os cartões e a tabela somem enquanto o preço não estiver disponível.

## Passo a passo de UAT (usuário)

1. Aplicar a migration `supabase/migrations/20261118000005_posicoes_fixacoes.sql` no Supabase.
2. Entrar no app, abrir **Mercado → Posições da safra**. Escolher a usina (a sua associada) e a safra `2026/27`.
3. Na seção **Política de hedge**, preencher mínimo 40, máximo 60 e produção estimada em toneladas. Clicar em **Salvar política**.
4. Em **Nova posição**, registrar uma fixação de açúcar de 1.000 t a 20 ¢/lb com câmbio fixado 5,10. Conferir que o cartão de % fixado, o preço médio e o MTM aparecem, com a data do preço.
5. Editar a posição (botão **Editar**), mudar o volume e salvar. Apagar outra posição de teste e confirmar a caixa de diálogo.
6. Importar uma planilha CSV numa safra vazia. A importação só **insere**: importar o mesmo arquivo de novo duplica as posições. Para testar, use uma safra sem posições, por exemplo `2027/28`, e apague as linhas de teste depois.
7. Testar uma linha inválida no CSV (data 31/02/2027): a tela deve mostrar o número da linha e não importar nada.
8. Em celular de 360px, conferir a tela de posições (cartões empilhados e tabela com rolagem horizontal).
