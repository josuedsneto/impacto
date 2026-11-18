# Cache Yahoo — Validação

## Checks

| Verificação | Comando | Resultado |
|---|---|---|
| Backend (pytest) | `cd backend && .venv/Scripts/python -m pytest tests -q` | 35 passed (ambiente: venv da checkout principal, Python do Windows; última rodada após a correção da chave do negativo) |
| Backend (cálculos) | `python test_calcs.py` | OK |
| Backend (mensagens) | `python test_mensagens.py` | OK |
| Frontend (unit) | `npm test` | 259 passed, 15 arquivos (rodado na worktree antes da instrução de encerrar o npm) |
| Frontend (lint) | `npm run lint` | **pendente: coordenadora roda após integração** |
| Frontend (build) | `npm run build` | **pendente: coordenadora roda após integração** |
| Frontend (tsc) | `npx tsc --noEmit` | **pendente: coordenadora roda após integração** |

`node_modules` da worktree foi removido depois dos testes; a coordenadora roda os checks do frontend na branch integrada.

## Requisitos

| Requisito | Evidência | Status |
|---|---|---|
| YAH-01 Sessão do Yahoo | `test_yf_download_nao_recebe_sessao_requests` (market_cache) | PASS (pytest) |
| YAH-02 Negativo com TTL | `test_resposta_vazia_nao_marca_cobertura`, `test_resposta_vazia_nao_busca_de_novo_dentro_do_ttl` | PASS (pytest) |
| YAH-03 Ajustes de cache | Suíte existente de upsert e cobertura (`test_market_cache.py`) | PASS (pytest) |
| YAH-04 Status do pregão | `test_estado_pregao_*`, `test_market_status_*` (test_cache_yahoo) | PASS (pytest) |
| YAH-05 Status no front | `frontend/lib/mercado.test.ts` (3 testes) | PASS (npm test) |
| YAH-06 Aquecimento | `test_job_*` (secret, 503, 401, aquecimento, falha parcial); `cron-aquecer.test.ts` (5 testes) | PASS (pytest + npm test) |
| YAH-07 Health profundo | `test_health_*` | PASS (pytest) |
| YAH-08 Timeouts e logs | `test_noticias_com_timeout_e_url_codificada`; log do Focus sem teste dedicado | PASS (notícias); Focus: verificado por leitura |

Não testado: concorrência de duas instâncias recebendo o job ao mesmo tempo (edge case da spec; upsert idempotente por desenho).

## UAT (passo a passo para o usuário)

1. **Status do mercado:** abrir o app em dia útil entre 03:30 e 13:00 (Nova York). O chip deve mostrar "Mercado aberto". Fora desse horário, "Mercado fechado".
2. **Status indisponível:** com o backend fora do ar (ou com a variável ausente), o chip deve mostrar "Status indisponível", não "Mercado fechado".
3. **Aquecimento manual:** `curl -X POST <backend>/api/jobs/aquecer-cache -H "X-Job-Secret: <JOBS_SECRET>"` deve responder 200 com uma entrada por ativo. Sem o header, 401.
4. **Cron:** na Vercel, conferir em Settings → Cron Jobs que `/api/cron/aquecer-cache` aparece com `0 6 * * 1-5`. Depois de um disparo, o log da função deve mostrar 200.
5. **Health:** `GET <backend>/api/health` responde `{"status":"ok"}`; `?deep=1` responde `"supabase":"ok"`.
6. **Configuração necessária:** `JOBS_SECRET` no backend (Railway) e na Vercel; `CRON_SECRET` na Vercel (a Vercel envia o bearer sozinha); `NEXT_PUBLIC_API_URL` apontando para o backend.

## Decisões a confirmar com o usuário

1. Horário do sugar nº 11 na ICE (03:30–13:00 NY) e se feriados devem contar como fechado.
2. `SBK26.NYB` venceu em maio de 2026. Remover de `frontend/lib/ativos.ts` e de `TICKERS_AQUECIMENTO`?
3. `tzdata` foi adicionado a `backend/requirements.txt` (usado pelo `zoneinfo` no Windows).
