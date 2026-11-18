# Dados de mercado pelo cache — Especificação

## Problem Statement

O app tem um cache de preços no Supabase (`market_cache.get_prices`), mas VaR, Volatilidade, ARIMA, Stress e as duas regressões ignoram o cache e chamam o Yahoo Finance direto a cada requisição. Resultado: telas lentas, números que mudam conforme a hora em que o Yahoo respondeu, e falhas quando o Yahoo bloqueia o IP da VM (registrado no próprio código). Além disso, o cache tem um defeito: o fechamento do dia buscado durante o pregão é gravado com `ignore_duplicates` e nunca é corrigido, então o "fechamento" fica sendo um preço intradiário para sempre.

## Goals

- [ ] Toda leitura de preço histórico no backend passa por `get_prices`.
- [ ] O fechamento de um dia é corrigido depois que o pregão termina.
- [ ] Quando o Yahoo falha, o app usa o que já está no cache e avisa a data do último dado.

## Out of Scope

| Item | Motivo |
|------|--------|
| Trocar o Yahoo Finance por outro provedor | Mudança de contrato/custo; não pedida. |
| Dados do BCB e do FRED (Focus, regressão dólar) | Não passam pelo Yahoo; cache próprio seria outra feature. |
| Preço em tempo real (intradiário) | O app trabalha com fechamentos diários. |
| `/api/market/status` | Consulta estado do pregão, não histórico. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Janela de correção do fechamento | Toda leitura que alcança os últimos 5 dias corridos rebusca esses dias no Yahoo e sobrescreve (upsert com update) | Cobre fim de semana e feriado; custo de uma chamada pequena | n |
| Frequência dessa rebusca | No máximo uma vez a cada 30 min por ticker por processo | Evita martelar o Yahoo com 4 workers | n |
| Histórico do Stress (2008, 2020) | `get_prices` com início em 2007-01-01; o cache já busca o intervalo anterior ao coberto | Hoje o backfill começa em 2013 e a crise de 2008 nunca apareceria | n |
| Dados mensais/anuais das regressões | Reamostrados no backend a partir dos fechamentos diários do cache | Uma fonte só; mesmo número em todas as telas | n |
| Aviso de dado antigo | Respostas incluem `ultimo_dado: "AAAA-MM-DD"`; o front mostra "Dados até <data>" no `PageHeader` | O usuário sabe se está olhando dado de hoje | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Uma fonte de preços ⭐ MVP

**User Story**: Como usuário, quero que VaR, Volatilidade, ARIMA e Stress usem os mesmos preços e respondam rápido.

**Acceptance Criteria**:

1. The endpoints `/api/var`, `/api/volatility`, `/api/arima/{ticker}`, `/api/stress`, `/api/regression/acucar/*` e `/api/regression/dolar/run` SHALL obter preços históricos só por `get_prices`.
2. The arquivo `backend/main.py` e `backend/regression.py` SHALL não chamar `yf.download`.
3. WHEN o mesmo endpoint é chamado duas vezes seguidas com os mesmos parâmetros THEN a segunda chamada SHALL não fazer requisição ao Yahoo.
4. WHEN `/api/stress` roda para SB=F THEN o cenário "Crise 2008" SHALL ter datas de início e fim preenchidas.

**Independent Test**: teste com `_fetch_from_yfinance` simulado contando chamadas; segunda chamada conta 0.

### P1: Fechamento correto ⭐ MVP

**User Story**: Como usuário, quero que o preço de ontem seja o fechamento oficial, não o preço da hora em que alguém abriu o app.

**Acceptance Criteria**:

1. WHEN `get_prices` cobre algum dos últimos 5 dias corridos THEN o cache SHALL rebuscar esses dias e sobrescrever os valores gravados.
2. WHILE a última rebusca de um ticker tem menos de 30 minutos o cache SHALL não rebuscar de novo.
3. The gravação desses dias SHALL atualizar linhas existentes (upsert com update), não ignorá-las.

**Independent Test**: gravar um fechamento falso para ontem; chamar `get_prices`; o valor passa a ser o do Yahoo simulado.

### P1: Falha do Yahoo sem tela quebrada ⭐ MVP

**User Story**: Como usuário, quando o Yahoo está fora, quero ver os dados que já existem e saber até quando vão.

**Acceptance Criteria**:

1. IF a busca no Yahoo falha (exceção ou resposta vazia) THEN `get_prices` SHALL registrar um log de aviso com ticker e intervalo e SHALL retornar as linhas já gravadas no cache.
2. The respostas dos endpoints do item P1-1 SHALL incluir `ultimo_dado` com a data da última linha usada.
3. IF não há nenhuma linha no cache para o intervalo e o Yahoo falha THEN o endpoint SHALL responder 503 com "Não foi possível obter os preços de <ativo> agora. Tente novamente em alguns minutos."

**Independent Test**: com o Yahoo simulado lançando exceção e cache preenchido, `/api/var` responde 200 com `ultimo_dado`.

---

## Edge Cases

- IF dois workers rebuscam o mesmo ticker ao mesmo tempo THEN o resultado gravado SHALL ser o mesmo (upsert idempotente por `ticker,date`).
- WHEN o ticker não existia no início do intervalo pedido THEN `get_prices` SHALL retornar a partir da primeira data disponível, sem erro.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| CACHE-01 | P1: Uma fonte de preços (endpoints) | - | Pending |
| CACHE-02 | P1: Uma fonte de preços (Stress desde 2007) | - | Pending |
| CACHE-03 | P1: Fechamento correto | - | Pending |
| CACHE-04 | P1: Falha do Yahoo (fallback + ultimo_dado) | - | Pending |
| CACHE-05 | P1: Falha do Yahoo (503 sem dados) | - | Pending |

**Coverage:** 5 total, 0 mapeados (Medium).

## Success Criteria

- [ ] VaR, Volatilidade e Stress respondem em menos de 2 s com o cache aquecido.
- [ ] O fechamento de SB=F no app bate com o fechamento oficial do dia anterior.
