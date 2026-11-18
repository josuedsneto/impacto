# Validação — cambio-previsao

**Status geral:** backend e tela implementados. Tela em `frontend/app/app/cambio/page.tsx`, `lib/cambio.ts` (horizontes, safra, níveis), `leituraCambio` em `lib/leitura.ts` e entrada "Câmbio (USD/BRL)" no menu. Checks do frontend: **pendentes, coordenadora roda após integração** (`npm test`, `npm run lint`, `npm run build`), sem `node_modules` nesta worktree. Sem `node_modules`, não foi possível rodar o build nem conferir o uso de Next.js; a tela segue o padrão de `arima/page.tsx`.

## Requisitos

| ID | Requisito | Status | Evidência |
|----|-----------|--------|-----------|
| CAM-01 | Bandas p5/p50/p95 por dia em nível de preço | Backend feito | `test_bandas_ordenadas_e_alargam_com_horizonte` passou. Endpoint sem teste HTTP. |
| CAM-02 | `horizonte` fora de 1–262 → 400 em português; histórico < 252 → 503 | Feito | `test_horizonte_fora_do_intervalo_responde_400_em_portugues`, `test_sem_precos_responde_503`. |
| CAM-03 | P(acima), P(abaixo) e P(tocar) por nível | Feito (backend e tela) | `test_prob_tocar_direcao_e_invariante` passou (direção e invariante P(tocar) ≥ P(acima)). |
| CAM-04 | `niveis` padrão spot ±5%; até 10 valores finitos em [0,5; 20] | Feito | `test_niveis_padrao_sao_spot_menos_e_mais_5_por_cento` e `test_niveis_invalidos_respondem_400` (7 casos). |
| CAM-05 | Forward por paridade coberta com aproximação explícita | Feito | `test_forward_paridade_coberta_exemplo` passou (5,00 × 1,10/1,05). |
| CAM-06 | `fetch_indicator` extraído para `focus.py`; `/api/focus` com mesmo retorno | Feito | Revisão do advisor confirmou retorno idêntico. Sem teste de regressão. |
| CAM-07 | Backtest walk-forward com as métricas da spec | Feito | `backtest.md` gerado por `backtest_cambio.py`. |
| CAM-08 | Regra de produção aplicada | Feito | Decisão em `backtest.md`: **M1**. |
| CAM-09 | Eixo do dólar no mapa de calor centrado no spot | Feito | Código em `/api/metas`. Sem teste (pendente). |
| Tela | Histórias P1 de tela: faixa, níveis, forward, Focus, cobertura de 6 meses, CSV | Feito, checks de frontend pendentes | `frontend/lib/cambio.test.ts` (dias úteis, safra, níveis, leitura) escrito, não rodado. |
| CAM-10 | Edge cases | Feito, exceto `ano_seguinte` do Focus | Ticks (`test_limpar_*`), vol zero, nan/inf, FRED/BCB ausentes (`test_sem_selic_ou_fed_o_forward_fica_nulo_e_as_bandas_continuam`). `ano_seguinte` (outubro em diante) sem teste. |

## Evidências de teste

- `python -m pytest tests/test_cambio.py -q` → **7 passed** (inclui cobertura de 90% com GBM de vol conhecida, N=1.000 origens sem overlap, 2.000 caminhos, seed fixa; a faixa 87–93% passou).
- `python -m pytest tests -q` (suíte completa do backend) → **28 passed** (47,8 s) antes dos testes HTTP do endpoint.
- `python -m pytest tests/test_endpoints_cambio.py tests/test_cambio.py -q` → **21 passed** (14 HTTP + 7 unitários).
- `python test_calcs.py` → **ok**. `python test_mensagens.py` → **ok**.
- `python backtest_cambio.py --saida ...` → **EXIT=0**, gera `backtest.md` (rodado duas vezes; a última com a decisão corrigida).
- Frontend: `npm test`, `npm run lint`, `npm run build` **não rodados** nesta worktree (sem `node_modules`; pendentes, a coordenadora roda após integração).

## Resultado do backtest (resumo)

203 origens, de 2010-02 a 2026-11, horizontes 5, 21, 63, 126 dias úteis. Detalhes e tabelas em `backtest.md`.

- **M1 contra M0 (skill em CRPS):** +0,025 em h=5 e +0,013 em h=21. Ganho pequeno.
- **Cobertura em h=5 e 21:** M1 não é rejeitado pelo Kupiec a 5% (p entre 0,30 e 0,96).
- **M1f contra M1 (Diebold-Mariano):** p=0,52 em h=5 e p=0,73 em h=21. Não substitui o M1.
- **Limitação forte:** em h=126 o M1 cobre 83% (nominal 90%) e 90% (nominal 95%). As bandas de seis meses são estreitas. A API serve até 262 dias úteis, mas só foi testado até 126.

## Decisões que o usuário precisa tomar

1. Confirmar se "fim da safra" é 31/03 (premissa da spec).
2. Aceitar que a faixa de seis meses é indicativa, ou pedir modelo mais largo para horizontes longos.
3. Decidir se a tela entra nesta rodada. Sem ela, o usuário não vê a funcionalidade.

## Passo a passo de UAT (depois da integração)

1. Backend rodando. Chamar `GET /api/cambio/previsao?horizonte=63` com token válido. Conferir: `spot` perto do último `USDBRL=X`, `bandas` com 63 itens e p5 < p50 < p95, `forward.valor` ≈ spot × (1+Selic)^(63/252) / (1+Fed×dc/360).
2. `GET /api/cambio/previsao?horizonte=0` e `horizonte=263` → 400 com mensagem em português.
3. `GET /api/cambio/previsao?niveis=nan` → 400.
4. `GET /api/cambio/previsao?niveis=5.20,5.80&horizonte=21`: conferir que `p_tocar_antes` ≥ `p_acima_vencimento` quando o nível está acima do spot.
5. `GET /api/metas`: o eixo `dolares` tem 11 valores, com o do meio perto do câmbio de hoje.
6. Abrir `backtest.md` e conferir a decisão e a limitação de h=126.
7. Frontend (coordenadora): `npm test`, `npm run lint`, `npm run build` após integrar.
