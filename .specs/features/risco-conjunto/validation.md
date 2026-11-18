# Risco conjunto da receita — Validação

## Evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| RC-01 contrato da resposta | `test_endpoint_responde_com_contrato` | PASS |
| RC-02 só `get_prices` | `risco_conjunto.py` lê via `get_prices`; `test_alinhar_*` | PASS |
| RC-03 seed reprodutível | `test_mesma_seed_mesmo_resultado` | PASS |
| RC-04 float32 | `_choques`/`_receitas` usam `dtype=np.float32` | verificado por leitura |
| RC-05 correlação estimada | `test_estimar_recupera_correlacao_conhecida` (10 000 retornos, ρ=0,6, tol 0,03) | PASS |
| RC-06 correlação simulada | `test_correlacao_simulada_bate_com_a_estimada` (200 000, tol 0,01) | PASS |
| RC-07 expõe correlacao/vols | `test_endpoint_responde_com_contrato` | PASS |
| RC-08 contribuição | `calcular` devolve `contribuicao` (3 cenários) | PASS |
| RC-09 σ_dólar=0 = univariado | `test_sem_vol_do_dolar_bate_com_univariado` (tol 0,005) | PASS |
| (AS-01) bivariado = fórmula fechada | `test_caso_bivariado_bate_com_formula_fechada` (tol 0,005) | PASS |
| RC-10 preço fixado obrigatório | `test_endpoint_exige_preco_fixado_quando_ha_percentual` (422) | PASS |
| RC-11 mistura | `test_mistura_bate_com_formula_fechada` (40%, tol 0,005) | PASS |
| RC-12 100% fixado | `test_fixado_100_por_cento_e_constante`, `test_fixado_100_com_meta_igual_ao_preco_fixado_da_zero` | PASS |
| RC-13 503 | `test_endpoint_sem_precos_responde_503`, `test_endpoint_historico_curto_responde_503` | PASS |
| RC-14 faixas 422 | `test_endpoint_valida_faixas` | PASS |
| RC-15 tela | `npm run build` lista `/app/risco-conjunto`; regras de UI e de linguagem | PASS |
| RC-16 menu | `NavLinks.tsx` | PASS |

## Comandos

- `backend`: `pytest tests -q` → 37 passed (21 existentes + 16 novos). `test_calcs.py` ok, `test_mensagens.py` ok.
- `frontend`: `npm test` → 13 arquivos, 254 testes passed. `npx tsc --noEmit` → sem erros. `npm run build` → sucesso.
- `frontend`: `npm run lint` → 1 erro em `components/ui/input.tsx` (`no-empty-object-type`), arquivo não alterado nesta feature (pré-existente).

## UAT (passo a passo para o usuário)

1. Entrar no app e abrir "Receita em R$ (açúcar × dólar)" no menu (grupo Risco).
2. Deixar meta 2.100 (digite exatamente como aparece, com o separador de milhar), horizonte 63 e % fixado 0; clicar em Simular.
3. Conferir que o cartão mostra "X% de chance de a receita ficar abaixo de R$ 2.100,00/t" e que a frase de leitura bate com ele.
4. Informar % fixado 40 e preço fixado; simular de novo e ver a probabilidade cair ou subir conforme o preço fixado.
5. Exportar CSV e abrir no Excel pt-BR.

## Decisões que o usuário precisa tomar

- AS-06: confirmar o fator 22,0462 × 1,04 (o 1,04 é prêmio?) e qual fator vale, já que `/api/breakeven` usa 1,12045 R$/saca.
- AS-07: confirmar que o preço fixado é em R$/t com câmbio travado.
- AS-02/AS-05: horizonte padrão 63 pregões e drift zero.
- Método gaussiano (AS-01): caudas finas; bootstrap é o upgrade se a equipe quiser caudas reais.
