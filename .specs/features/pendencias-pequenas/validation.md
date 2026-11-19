# Validação: pendencias-pequenas

## Evidências de teste

| Comando | Resultado |
|---|---|
| `backend/.venv/Scripts/python.exe -m pytest tests -q` (em `backend/`) | 268 passed, 0 failed (inclui os 12 testes novos de `test_pregao.py` e `test_pendencias_pequenas.py`) |
| `pytest tests/test_pregao.py tests/test_pendencias_pequenas.py -q` | novos testes desta frente |
| `python test_calcs.py` | ok |
| `python test_mensagens.py` | ok |
| `npm test` (frontend) | 25 arquivos, 356 testes passed (inclui `lib/hedge-reabrir.test.ts`, 3 testes) |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx next build --webpack` (com URLs fictícias) | exit 0; rota `/app/hedge-cambial` gerada |

## Requisitos

| ID | Status | Evidência |
|---|---|---|
| PEN-01 | Atendido (unitário) + UAT | `camposDeAnalise` em `lib/hedge-reabrir.test.ts`; hook `useReabrirAnalise("hedge_cambial")` em `hedge-cambial/page.tsx`. Preenchimento real da tela: UAT passo 1 |
| PEN-02 | Atendido (por desenho) + UAT | Padrão do `useEffect` agora usa `c.strikePut || ...` (só preenche vazio). Vale nas duas ordens de chegada. Sem teste de componente (o projeto não tem teste de página) |
| PEN-03 | Atendido | `test_prazo_fora_da_lista_nao_e_aplicado`, `test_campo_ausente_ou_nulo...` em `lib/hedge-reabrir.test.ts` |
| PEN-04 | Atendido | `test_lote_invalido_diz_a_linha_e_o_campo_em_portugues` (`Linha 3 (Volume): valor inválido.`); `test_lote_com_campo_obrigatorio_ausente_aponta_a_linha` |
| PEN-05 | Atendido, critério manual | `apiFetch` (`lib/api.ts`) usa `detail` string em vez de `MSG_VALIDACAO`. UAT passo 2 |
| PEN-06 | Atendido | `test_lote_insere_tudo_com_safra_do_topo` (já existente, sem mudança); `test_lote_com_erro_nao_grava_nenhuma_linha` |
| PEN-07 | Atendido | `test_metas_eixos_tem_o_ultimo_fechamento_no_centro` (pelo `TestClient`, usando o Yahoo e o Supabase simulados de `conftest.py`, sem `main.get_prices`) |
| PEN-08 | Atendido | `test_feriado_de_dia_util_em_horario_de_pregao_responde_closed`; `test_feriado_respeita_o_horario...` |
| PEN-09 | Atendido | `test_dia_util_vizinho_ao_feriado_continua_regular`; `test_regra_antiga_continua_valendo...` |
| PEN-10 | Atendido | `backend/pregao.py` criado; `main.py` só importa `estado_pregao` (linha de import no lugar das antigas definições). `test_cache_yahoo.py` (usa `main.estado_pregao`) passa |
| PEN-11 | Atendido | `test_mc_com_menos_de_100_cenarios_responde_422` (1 e 99) |
| PEN-12 | Atendido | `test_mc_com_100_cenarios_responde_200` |

## Feriados ICE (decisão de dados)

- **2026:** lista conferida no PDF oficial "ICE Futures U.S. 2026 Trading Holiday Calendar" (coluna Sugar No. 11 = closed para todos os feriados dos EUA). Fonte: `status.ice.com/publicdocs/futures/IFUS_Trading_Hours_Holiday_Calendar.pdf`.
- **2027:** só 1º de janeiro veio do PDF. O restante foi **derivado** pela regra federal dos EUA com Good Friday. Good Friday 2027 = 26/03 (Páscoa em 28/03, conferida pelo algoritmo de Meeus). **Precisa de conferência contra o calendário ICE 2027** quando for publicado.
- Pegadinha: a busca na web sugeria que o açúcar operava no Memorial Day de 2026. O PDF oficial diz closed. Vale o PDF.

## Build

- `npm run build` (Turbopack) falha nesta worktree com `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. Causa: o `node_modules` é junção para a checkout principal. Não é erro de código.
- Verificação feita com `npx next build --webpack`: `Compiled successfully`, exit 0. Para o build com Turbopack, rode na checkout principal ou com `node_modules` local.

## Desvios e limitações conhecidos

1. **Teste antigo de heatmap** (`tests/test_robustez.py::test_heatmap_centrado_no_ultimo_fechamento`, HARD-05) ainda faz `monkeypatch.setattr(main, "get_prices", ...)`. Continua verde hoje, mas quebra quando `/api/metas` sair do `main.py`. O teste novo (PEN-07) é o que sobrevive à divisão. Não removi o antigo nesta frente.
2. **Lote:** erro em `usina_id` ou `safra` continua na lista padrão do FastAPI, sem texto de linha. Fora de escopo (handler global de `RequestValidationError`, mesmo item citado em `hedge-cambial`).
3. **Lote:** `LotePosicoes.posicoes` virou `list[dict]`, então o OpenAPI não descreve mais o item. O schema real continua em `PosicaoBase`.
4. **Hedge:** a reabertura restaura os campos, mas não recalcula. O usuário ainda clica em "Comparar estratégias".

## UAT (passos para o usuário)

Pré-requisito: `backend` e `frontend` em produção com este código (ou ambiente local).

1. **Hedge cambial:** em **Minhas análises**, abrir uma análise de hedge salva. Conferir que volume, prazo, orçamento, percentual, put, K1 e K2 vêm preenchidos com os valores salvos (não os padrões de spot).
2. **Posições:** importar um CSV com uma linha de volume zero (ex.: linha 3). O aviso de erro deve dizer **"Linha 3 (Volume): valor inválido."**, e nada deve ser importado.
3. **Pregão:** no dia de um feriado da ICE (ex.: 19/jan/2026, MLK), `GET /api/market/status` deve responder `CLOSED` mesmo em horário de pregão.
4. **MC Pricer:** na tela de opções, digitar 50 em "Quantidade de cenários". O preço não deve atualizar, e a API deve responder 422 se chamada direto.
