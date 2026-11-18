# Validação — backend-robustez

## Evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| HARD-01 | `tests/test_robustez.py::test_indicador_fora_da_faixa_responde_422`, `test_macd_rapido_maior_responde_422`, `test_mais_de_cinco_medias_responde_422` | PASS |
| HARD-02 | `test_excecao_nao_tratada_vira_500_em_portugues_com_cors` (500 em português, request-id, CORS), `test_breakeven_ignora_fechamento_nulo`, `test_risco_com_p15_maior_que_p85_responde_422`, `test_risco_responde_valores_finitos`, `test_payoff_sem_pernas_responde_422` | PASS |
| HARD-03 | `test_todos_usuarios_percorre_todas_as_paginas` (2005 usuários em 3 páginas cheias/parcial + página vazia; ordenados por e-mail) | PASS |
| HARD-04 | `test_constante_ausente_ou_invalida_usa_valor_do_codigo`, `test_constante_lida_do_banco_aceita_virgula`, `test_put_constante_nao_numerica_responde_422`, `test_put_constante_com_dois_separadores_responde_422`, `test_put_constante_numerica_grava_com_ponto` | PASS |
| HARD-05 | `test_heatmap_centrado_no_ultimo_fechamento`, `test_metas_sem_precos_recentes_responde_503` | PASS |
| HARD-06 | `test_periodo_acima_de_25_anos_responde_422`, `test_limit_zero_responde_422`, `test_confianca_do_var_fora_da_faixa_responde_422`, `test_opcao_de_cenario_invalida_responde_422` | PASS |
| HARD-07 | `main.py` sem `async def` e sem `asyncio` (verificado por grep) | PASS |
| HARD-08 | 51 das 52 rotas têm `@limiter.limit`; só `/api/health` não tem (intencional) | PASS (inspeção) |
| HARD-09 | `test_409_so_para_conflito_de_unicidade` (23505 → 409; outro código → 500) | PASS |
| HARD-10 | `test_health_devolve_request_id`; `configurar_logs` com `LOG_LEVEL` e formato com data/nível/request-id | PASS |
| HARD-11 | `regression.py` usa `market_cache.serie_fechamentos`; `_serie_cache` removido; `get_sector_defaults` removido do import | PASS |
| HARD-12 | `test_jump_diffusion_sem_saltos_segue_o_drift_em_log` (média de log(P_T/P_0) ≈ T·mu em 300 execuções) | PASS |

### Comandos e resultados

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q
44 passed in 94.02s            (EXIT 0)

cd backend && .venv/Scripts/python.exe test_calcs.py        → ok
cd backend && .venv/Scripts/python.exe test_mensagens.py    → ok

cd frontend && node node_modules/vitest/vitest.mjs run
Test Files 13 passed (13), Tests 251 passed (251)

cd frontend && node node_modules/eslint/bin/eslint.js
✖ 1 problem (1 error): components/ui/input.tsx:4 no-empty-object-type
   → PRÉ-EXISTENTE: arquivo não alterado (git diff HEAD vazio). Fora do escopo.

cd frontend && node node_modules/next/dist/bin/next build
✓ Compiled successfully · TypeScript OK · 28/28 páginas geradas (EXIT 0)
```

Observação sobre o ambiente: `npm ci` concluiu (exit 0), mas não criou `node_modules/.bin`. Os checks foram rodados chamando os entrypoints do `node` diretamente.

## Mudanças de comportamento (para o changelog)

- **Jump-diffusion:** o drift em log não subtrai mais `σ²/2` (contava duas vezes, cerca de −5%/ano no centro). Agora `inc = (mu − λ_d·μ_salto) + σZ + saltos`. Os saltos continuam com a média histórica compensada.
- **Risco:** o NY é truncado em zero (antes, NY abaixo de 0,19 gerava faturamento negativo). Moagem e ATR deixam de ser sorteados porque se cancelam na fórmula de custo. O resultado é o mesmo, sem NaN.
- **VaR:** parâmetros fora da faixa passam de 400 para 422.
- **Heatmap de Metas:** 11 colunas de dólar (antes 10); eixos centrados no último fechamento.
- **Admin:** `PUT /api/admin/config/{key}` aceita vírgula decimal nas constantes e grava com ponto.

## Fora de escopo / dívidas

- Nomes de negócio dos custos fixos (`risco_custo_fixo_1` etc.): a descrição marca "Confirmar a rubrica".
- Rate limit do `RateLimitExceeded` continua em inglês (o slowapi responde 429 antes do handler global).
- Contexto do request-id não é repassado às threads do `/api/focus`, então esses logs saem com `-`.
- `main.py` não foi quebrado em routers (pedido da coordenação).
- `components/ui/input.tsx` tem erro de lint pré-existente.

## Roteiro de UAT (usuário)

1. **Erros viram mensagem:** em Simulação > Análise técnica, digite período 0 ou SMA 0 e confirme a mensagem em português (não erro genérico).
2. **Metas:** abra Metas e confirme que a célula central do mapa aparece destacada e que o valor de açúcar e de câmbio do centro são os de hoje.
3. **Admin > Configurações:** confira que aparecem as seis constantes novas com descrição em português. Altere `fator_conversao_mtm` (use vírgula, ex.: `22,928048`) e salve; o MTM de Metas deve mudar na mesma proporção.
4. **Admin > Configurações:** tente salvar um custo com texto (ex.: `abc`); deve aparecer "O valor de <chave> precisa ser numérico."
5. **Risco:** informe P15 maior que P85 em Moagem; deve aparecer "Moagem: é preciso P15 < média < P85."
6. **Admin > Usuários:** confira que a lista traz todos os usuários, em ordem de e-mail.
7. **Migração:** rode `supabase/migrations/20261118000001_admin_config_constantes.sql` no Supabase antes do deploy. Ele é idempotente (`on conflict do nothing`).
8. **Variável de ambiente:** opcional, defina `LOG_LEVEL` (padrão INFO) no Railway.
