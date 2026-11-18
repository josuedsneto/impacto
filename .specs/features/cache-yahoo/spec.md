# Cache Yahoo: correção e pré-aquecimento — Especificação

## Problem Statement

Quatro problemas no caminho de preços e status de mercado:

1. A sessão "anti-bloqueio" do Yahoo nunca funciona. `yfinance` 0.2.66 aceita só sessão `curl_cffi`; um `requests.Session` comum lança `YFDataException`. O `market_status` engole a exceção e responde `CLOSED` sempre. A `_yf_session` de `market_cache.py` nem é usada.
2. Quando o Yahoo devolve vazio, o cache não grava cobertura (de propósito). Um ticker sem histórico desde 2007 faz `/api/stress` buscar no Yahoo a cada chamada.
3. Não há aquecimento: a primeira consulta do dia paga a busca no Yahoo e a latência do usuário.
4. Chamadas HTTP sem timeout (feedparser) e exceções sem log (BCB Focus) deixam o app travado ou mudo quando externos falham.

## Goals

- [x] `yfinance` é chamado de forma que funciona no 0.2.66 (sem sessão `requests` inválida).
- [x] Um intervalo sem dados no Yahoo não é buscado de novo por 6 horas no mesmo processo.
- [x] Um job diário, antes da abertura do pregão, aquece o cache dos ativos do app.
- [x] O status do mercado reflete o horário real do pregão e, em caso de erro, diz "Status indisponível".
- [x] `/api/health?deep=1` mostra se o Supabase responde.
- [x] Nenhuma chamada HTTP de saída fica sem timeout; falhas de Focus e notícias ficam registradas.

## Out of Scope

| Item | Motivo |
|------|--------|
| Redis / armazenamento compartilhado para o negativo | Pior caso com N processos é N buscas por 6 h por intervalo; custo baixo. Ver Assumptions. |
| Feriados da ICE no status do mercado | Calendário fixo (seg–sex, 03:30–13:00 NY). Feriado mostra "aberto" errado; registrado como limite. |
| Jobs de alertas | Outra thread acrescenta em `backend/routers/jobs.py`; aqui só `require_job_secret` é reutilizável. |
| Trocar o Yahoo por outro provedor | Fora de escopo, como em `dados-mercado-cache`. |
| Migrations no Supabase | Nenhuma tabela ou coluna nova. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Sessão para o yfinance | Nenhuma passada explicitamente; `_yf_session` removida de `main.py` e `market_cache.py`. yfinance usa por padrão `curl_cffi` com `impersonate="chrome"`, que é o que o bypass precisava. | A documentação do próprio yfinance 0.2.66 diz "stop setting session, let YF handle". `requests.Session` é rejeitada. | n |
| Negativo do Yahoo | Memória do processo: `dict[(ticker, início da lacuna)] -> instante`, TTL 6 h. Sem migration. A chave não usa o fim, porque a rebusca recente corta o fim da lacuna. | Simples. Com N processos, o pior caso é N buscas por 6 h por intervalo. Coluna em `market_coverage` não serve: intervalo vazio não tem linha de cobertura e criá-la marcaria cobertura falsa. | n |
| Status do mercado | Calendário: seg–sex, 03:30–13:00 `America/New_York` (ICE Sugar No. 11) = `REGULAR`; resto = `CLOSED`. Erro = `UNKNOWN`. Sem chamada ao Yahoo. | Não depende de atributo inexistente nem de rede. Horário a confirmar com o usuário (ver Open Questions). | n |
| Ativos do aquecimento | Lista replicada em `backend/routers/jobs.py` (`TICKERS_AQUECIMENTO`) a partir de `frontend/lib/ativos.ts`, com comentário cruzado nos dois lados. | Mais simples que ler de um arquivo do frontend; a lista muda raramente. | n |
| Janela do aquecimento | `2007-01-01` até hoje, igual à janela do Stress. | Assim o aquecimento cobre o que as telas usam. | n |
| Horário do Cron | `0 6 * * 1-5` (UTC) = 03:00 EDT / 02:00 EST, antes da abertura. | Fechamento de ontem já está consolidado. Hobby do Vercel aceita cron diário. | n |
| Segredos | `JOBS_SECRET` (backend, env); `CRON_SECRET` (Vercel, enviado automaticamente como `Authorization: Bearer`); a URL do backend é a `NEXT_PUBLIC_API_URL` já usada pelo front. | Nenhuma variável nova além das duas de segredo. | n |
| Notícias | `requests.get(url, timeout=10)` com `urlencode`; `feedparser.parse(resp.content)`. | Usa `requests`, que já é dependência. | n |
| `ticker SBK26.NYB` | Mantido na lista (é o que o app mostra hoje). | Contrato de maio/2026 já venceu; o Yahoo deve responder vazio. O negativo de 6 h limita o custo. Ver Open Questions. | n |

**Open questions (para o usuário, não bloqueiam a implementação):**
1. Confirmar o horário do sugar nº 11 na ICE (03:30–13:00 NY) e se o app deve considerar feriados.
2. `SBK26.NYB` venceu em maio de 2026. Remover de `ativos.ts` e do aquecimento?

---

## User Stories

### P1: Sessão do Yahoo funcional ⭐ MVP

**User Story**: Como usuário, quero que o app consiga buscar preços no Yahoo sem depender de uma sessão quebrada.

**Acceptance Criteria**:

1. **YAH-01.1** WHEN `_fetch_from_yfinance` chama `yf.download` THEN a chamada SHALL não receber `session=` com `requests.Session`.
2. **YAH-01.2** The módulos `main.py` e `market_cache.py` SHALL não definir `_yf_session`.

**Independent Test**: monkeypatch de `yf.download` captura os kwargs; `session` não aparece. Confirma-se que `yf.Ticker("SB=F").session` é `curl_cffi` (sem rede).

### P1: Negativo com TTL ⭐ MVP

**User Story**: Como usuário, quando o Yahoo não tem histórico de um ativo, quero que a tela não espere o Yahoo a cada clique.

**Acceptance Criteria**:

1. **YAH-02.1** WHEN o Yahoo devolve vazio para o intervalo (ticker, início, fim) THEN `get_prices` SHALL registrar o aviso "Yahoo sem dados" (como hoje) e SHALL NOT marcar cobertura.
2. **YAH-02.2** WHILE o negativo para (ticker, início, fim) tem menos de 6 horas, `get_prices` SHALL NOT chamar o Yahoo para esse intervalo.
3. **YAH-02.3** WHEN o negativo tem 6 horas ou mais THEN `get_prices` SHALL buscar de novo.

**Independent Test**: duas chamadas com Yahoo vazio → uma busca; avança-se o relógio 6 h → a terceira busca acontece.

### P2: Ajustes de cache

**User Story**: Como mantenedor, quero código de cache mais simples e mais rápido na gravação.

**Acceptance Criteria**:

1. **YAH-03.1** `_upsert_prices` SHALL montar as linhas com `df.to_dict("records")`, sem `iterrows()`.
2. **YAH-03.2** A normalização de colunas de `_fetch_from_yfinance` SHALL ter um único ramo para `MultiIndex` e colunas simples.

Os testes existentes de upsert e cobertura são a verificação.

### P1: Status do mercado correto ⭐ MVP

**User Story**: Como usuário, quero ver "Mercado aberto" ou "Mercado fechado" de acordo com o pregão, e "Status indisponível" quando não der para saber.

**Acceptance Criteria**:

1. **YAH-04.1** WHEN `estado_pregao` recebe um instante em dia útil entre 03:30 e 13:00 de `America/New_York` THEN SHALL retornar `REGULAR`.
2. **YAH-04.2** WHEN recebe um instante fora dessa faixa ou em fim de semana THEN SHALL retornar `CLOSED`.
3. **YAH-04.3** IF a verificação lança exceção THEN `GET /api/market/status` SHALL responder `state: "UNKNOWN"`, `open: false`.
4. **YAH-04.4** The rota SHALL não chamar o Yahoo.
5. **YAH-05.1** WHEN o front recebe `UNKNOWN` (ou falha ao buscar) THEN o indicador SHALL mostrar "Status indisponível" com cor neutra, não "Mercado fechado".

**Independent Test**: `estado_pregao` com datas fixas (segunda 10:00 NY → REGULAR; sábado → CLOSED; segunda 14:00 → CLOSED); rota com `estado_pregao` substituído por função que lança.

### P1: Aquecimento diário ⭐ MVP

**User Story**: Como usuário, quero que os dados já estejam no cache quando abro o app de manhã.

**Acceptance Criteria**:

1. **YAH-06.1** `POST /api/jobs/aquecer-cache` SHALL exigir o header `X-Job-Secret` igual a `JOBS_SECRET`, comparado com `hmac.compare_digest`; sem o header ou com valor errado SHALL responder 401.
2. IF `JOBS_SECRET` não está configurado THEN SHALL responder 503 (falha fechada).
3. WHEN autenticado THEN SHALL chamar `get_prices` para cada ticker de `TICKERS_AQUECIMENTO` no intervalo 2007-01-01 até hoje e responder `{"aquecidos": [{"ticker", "linhas", "ultimo_dado"}]}`.
4. WHEN o Yahoo falha para um ticker THEN o job SHALL continuar com os outros e SHALL responder 200 (a falha já fica no log do `get_prices`).
5. **YAH-06.2** `frontend/app/api/cron/aquecer-cache/route.ts` (GET) SHALL responder 401 sem `Authorization: Bearer <CRON_SECRET>`, e 500 se `CRON_SECRET` ou `JOBS_SECRET` não estiver configurado.
6. WHEN autorizado THEN SHALL chamar o backend `POST /api/jobs/aquecer-cache` com `X-Job-Secret` e devolver o status e corpo do backend.
7. **YAH-06.3** `frontend/vercel.json` SHALL agendar o cron `0 6 * * 1-5` para essa rota.

**Independent Test**: `TestClient` sem header → 401; com header certo → 200 e `get_prices` chamado 4 vezes. Vitest chama o handler GET com e sem bearer.

### P2: Saúde profunda

**User Story**: Como mantenedor, quero um teste rápido de que o banco responde, sem derrubar o health simples.

**Acceptance Criteria**:

1. **YAH-07.1** `GET /api/health` SHALL continuar respondendo `{"status": "ok"}` sem query.
2. WHEN `?deep=1` e o Supabase responde THEN SHALL responder 200 `{"status": "ok", "supabase": "ok"}`.
3. IF `?deep=1` e a consulta ao Supabase falha THEN SHALL responder 503 `{"status": "degradado", "supabase": "erro"}` e registrar o erro.

### P2: Timeouts e logs

**User Story**: Como usuário, quero que notícias e Focus não travem a página quando o serviço externo está lento ou fora.

**Acceptance Criteria**:

1. **YAH-08.1** A busca de notícias SHALL usar `requests.get` com `timeout=10` e URL com query codificada (`urlencode`, `ç` e espaços corretos).
2. **YAH-08.2** WHEN a busca de Focus/BCB de um indicador falha THEN SHALL registrar `logger.warning` com o indicador e a exceção, e SHALL manter o retorno `{"value": None, "delta": None}`.

---

## Edge Cases

- IF `JOBS_SECRET` está vazio (string vazia) THEN trata-se como não configurado (503).
- WHEN o job roda com o Yahoo fora THEN responde 200 com `linhas` do que já está no cache.
- WHEN o negativo expira e o Yahoo volta a ter dados THEN a busca grava normalmente e a cobertura é marcada.
- IF duas instâncias do backend recebem o job ao mesmo tempo THEN o resultado é o mesmo (upsert idempotente).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| YAH-01 | P1: Sessão do Yahoo funcional | Execute | Verified (pytest) |
| YAH-02 | P1: Negativo com TTL | Execute | Verified (pytest) |
| YAH-03 | P2: Ajustes de cache | Execute | Verified (suíte existente) |
| YAH-04 | P1: Status do mercado correto | Execute | Verified (pytest) |
| YAH-05 | P1: Status do mercado correto (front) | Execute | Verified (npm test) |
| YAH-06 | P1: Aquecimento diário | Execute | Verified (pytest + npm test) |
| YAH-07 | P2: Saúde profunda | Execute | Verified (pytest) |
| YAH-08 | P2: Timeouts e logs | Execute | Verified (notícias); log do Focus por leitura |

**Coverage:** 8 requisitos-tronco, todos com critérios e testes (ver `validation.md`). Não testado: a concorrência de duas instâncias recebendo o job ao mesmo tempo (edge case; o upsert é idempotente por desenho).

## Success Criteria

- [ ] `GET /api/market/status` responde `REGULAR`/`CLOSED` conforme o horário; `UNKNOWN` só quando o cálculo lança exceção.
- [ ] Depois do aquecimento, `/api/var` e `/api/stress` não chamam o Yahoo para o período já coberto.
- [ ] `pytest`, `test_calcs.py`, `test_mensagens.py`, `npm test`, `npm run lint` e `npm run build` passam.
