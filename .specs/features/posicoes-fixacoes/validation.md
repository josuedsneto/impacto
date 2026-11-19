# Validação: posicoes-fixacoes v2 (rodada 3)

## Requisitos e evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| POS-V2-01 Black-76 no açúcar | `backend/tests/test_mtm_opcoes.py::test_black76_bate_com_options_py`, `::test_call_usa_a_call_do_black76` | PASS |
| POS-V2-02 GK no dólar | `backend/tests/test_mtm_opcoes.py::test_gk_bate_com_options_py_e_com_a_paridade_do_hedge` | PASS |
| POS-V2-03 call e put | `test_call_usa_a_call_do_black76`, `test_intrinseco_de_call_no_dolar` | PASS |
| POS-V2-04 fallback sem erro | `test_acucar_sem_dado_cai_no_intrinseco_com_aviso` (4 casos), `test_dolar_sem_selic_cai_no_intrinseco`, `test_vol_zero_ou_nan_cai_no_intrinseco_sem_erro`, `test_resumo_com_opcao_sem_vencimento_cai_no_intrinseco_sem_500` | PASS |
| POS-V2-05 detalhes do modelo | `test_black76_bate_com_options_py` (vol, taxas, anos) e `test_resumo_com_opcao...` (modelo e aviso na linha) | PASS |
| POS-V2-06 endpoint de exposição | `backend/tests/test_exposicao.py::test_exposicao_endpoint_usa_a_conta_unica`, `::test_exposicao_de_usina_alheia_responde_403`; `test_contrato_rotas.py` com a rota nova | PASS |
| POS-V2-07 função pura única | `test_exposicao.py::test_carteira_sintetica_bate_com_a_conta_a_mao` (valores calculados à mão), `::test_sem_producao...`, `::test_sem_posicoes...`, `::test_produção_menor...`, `::test_sem_sb...` | PASS |
| POS-V2-08 botão risco conjunto | `frontend/lib/posicoes.test.ts` (`valoresParaRisco`: % com câmbio, limite 100, sem câmbio, nada fixado, sem produção) | PASS (lógica); UAT pendente (clique) |
| POS-V2-09 botão hedge cambial | `frontend/lib/posicoes.test.ts` (`valorParaHedge`: arredondado, zero, sem produção) | PASS (lógica); UAT pendente |
| POS-V2-10 migration, form e CSV | `test_exposicao.py::test_tipo_opcao_em_fixacao_responde_422`, `::test_tipo_opcao_invalido_responde_422`, `::test_opcao_com_tipo_call_e_gravada`; `posicoes.test.ts` (`tipo da opção`, CSV com coluna Tipo) | PASS |

## Comandos e resultados

Backend (venv da checkout principal, dentro de `backend/`):

```
python -m pytest tests -q        -> 320 passed, 5 warnings
python test_calcs.py             -> ok
python test_mensagens.py         -> ok
```

Frontend (junção de `node_modules` para a checkout principal):

```
npx vitest run                   -> 25 files, 374 tests passed
npx tsc --noEmit                 -> sem erros
npm run lint                     -> sem erros
npx next build --webpack         -> Compiled successfully (com NEXT_PUBLIC_* fictícios)
```

Observação: `npm run build` (Turbopack) falha neste ambiente com `Symlink [project]/node_modules is invalid`, causado pela junção apontar para fora da raiz do projeto. Não é erro do código. A verificação de build foi feita com `--webpack`. Na CI (`npm ci`), o Turbopack deve passar.

## Migrations

- `supabase/migrations/20261120000004_posicoes_tipo_opcao.sql`: aplicar **antes** do deploy do backend. O `model_dump` envia `tipo_opcao` mesmo nulo; sem a coluna, POST, lote e PUT de posições dão erro no PostgREST.

## UAT (passos para o usuário)

1. Aplicar `20261120000004_posicoes_tipo_opcao.sql` no Supabase.
2. Em **Posições da safra**, escolher uma usina e a safra 2026/27. Registrar uma opção de dólar com vencimento futuro, tipo put, strike 5,20 e prêmio 0,05. A linha da tabela deve mostrar "Garman-Kohlhagen · vol …% · taxa …% · … anos".
3. Registrar uma opção de açúcar sem vencimento. A linha deve mostrar "Valor intrínseco" com o aviso "Sem vencimento".
4. Importar um CSV com a coluna "Tipo da opção" (call e vazio). Conferir que as linhas entram e que um tipo inválido aponta a linha.
5. Exportar o CSV. Conferir as colunas "Tipo da opção", "Modelo do MTM" e "Vol anual".
6. Em **Risco conjunto**, escolher a usina e a safra e clicar em "Usar minhas posições da safra". O % fixado deve bater com a fixação e o futuro com câmbio ÷ produção. O preço médio deve preencher o campo.
7. Em **Hedge cambial**, clicar em "Usar o dólar a receber em aberto da safra". O volume deve preencher com o dólar em aberto. Se não houver nada em aberto, deve aparecer o aviso.
8. Testar em 360px as duas telas e a tela de posições.

## Decisões que o usuário precisa confirmar

- Receita em US$ usa SB=F spot para a produção não fixada, e a fixação sem câmbio a preço fixado. Se a trading usar preço de embarque, a conta muda.
- Dólar protegido soma o nocional de NDF e de put de dólar. Call de dólar não reduz o aberto.
- Percentual mandado ao risco conjunto é só a fixação **com câmbio** (é a parte que tem preço em R$/t).
- O botão de posições e as telas leem `GET /api/posicoes/exposicao`. Os routers `risco_conjunto.py` e `hedge_cambial.py` não ganharam conta própria, para não duplicar a regra.
- Taxa do açúcar: Fed funds em ln(1+i). Dólar: convenção de `hedge_cambial.py` (Selic, paridade coberta, du/252).
- Vol do açúcar: 252 retornos de SB=F com limpeza de `cambio.limpar`. Rolagem de contrato ainda pode distorcer a vol; isso não foi tratado.

## Pendências conhecidas

- Opção de açúcar vencendo na segunda após um fim de semana pode mostrar "vencida ou vencendo hoje", porque `busday_count` dá 0 no sábado ou domingo. Não quebra o cálculo do fallback, mas o aviso fica impreciso.
- Os routers de alertas e o dashboard não foram tocados, como pedido.
