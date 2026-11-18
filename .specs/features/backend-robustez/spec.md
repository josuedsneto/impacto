# Robustez do backend — Especificação

## Problem Statement

Pontos menores da auditoria que geram erro 500 ou números desatualizados: a lista de usuários do admin só traz a primeira página do Supabase Auth; parâmetros de indicadores técnicos e de paginação não têm limites (período 0 derruba a requisição; `limit=0` quebra a rota); constantes de negócio (fator de conversão, custos fixos de Risco e Cenários) estão fixas no código; o mapa de calor de Metas usa faixas de preço fixas (dólar 4,80–5,25) que já não cobrem o mercado. Além disso: handler global de exceções inexistente, `async def` com I/O síncrono contrariando o `CLAUDE.md`, rate limit ausente em endpoints sensíveis, logging sem configuração e código morto.

## Goals

- [ ] Nenhuma entrada do usuário gera erro 500.
- [ ] Qualquer exceção não tratada vira 500 com mensagem genérica em português, sem detalhes internos, e é registrada no log.
- [ ] O admin altera as constantes de negócio sem deploy.
- [ ] O mapa de calor de Metas sempre contém o preço atual, no centro.
- [ ] Endpoints com I/O bloqueante são `def`; endpoints sensíveis têm rate limit.

## Out of Scope

| Item | Motivo |
|------|--------|
| Limitador de requisições compartilhado entre workers (Redis) | Com 20–100 usuários internos, o limite por worker basta. Registrado como dívida. |
| Revisar as fórmulas de Risco e Cenários | São regras de negócio da usina; aqui só alguns custos e o fator de conversão saem do código para a configuração. |
| Cache de notícias compartilhado entre workers | Mesmo motivo do limitador. |
| Quebrar `main.py` em routers | Fica para depois da integração das outras threads (`backend/routers/` não é criado agora). |
| Externalizar receitas fixas e rendimentos de Risco/Cenários | Só os custos fixos e o fator de conversão foram pedidos. Os demais números seguem no código. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Onde ficam as constantes | Tabela `admin_config` existente, uma chave por constante, com descrição em português | Já existe tela de admin para ela | y |
| Valores iniciais | Os valores hoje no código, gravados por migração (`on conflict do nothing`) | Comportamento não muda no dia da troca | y |
| Constantes incluídas | `fator_conversao_mtm` (22,0462 × 1,04, usado em Metas, Risco e Cenários), `risco_custo_fixo_1/2`, `cenarios_custo_fixo_1/2/3`. `breakeven_fator_conversao` já existe. | Pedido: custos fixos e fator de conversão. Nomes genéricos (`_1`, `_2`) porque a rubrica de cada custo não está no código; **o usuário deve dar nomes de negócio** | n |
| Aceite de valor no admin | Aceita vírgula decimal (pt-BR); grava com ponto. Rejeita NaN, infinito e não numérico. | Usuário da usina digita `1,12` | n |
| Limites dos indicadores | Períodos inteiros de 2 a 250; desvio do Bollinger de 0,5 a 5; até 5 médias SMA e 5 EMA | Cobrem qualquer uso prático | n |
| Limites de paginação | `limit` de 1 a 200; `offset` de 0 a 100 000 (mensagem "O limite deve estar entre 1 e 200.") | Evita `range(0, -1)` | n |
| Período máximo | 25 anos (9 131 dias) em `/api/market/prices` e `/api/market/analysis` | Evita downloads de séculos de histórico | n |
| Limites do VaR | Confiança de 0,5 a 0,999; horizonte de 1 a 252 dias úteis. Erro passa de 400 para 422. | Cobre o uso prático | n |
| Tamanho de JSON livre | `inputs`/`results` de risco até 64 KB; `value` do admin até 2 000 caracteres | Teto testável | n |
| Rate limit | `/api/me` 60/min; suggestions GET/PATCH 20/min; backfill 5/min; admin config GET/PUT 20/min; payoff 30/min; bs-price 60/min | Uso interno; `/api/me` roda a cada página | n |
| Lista de usuários | Páginas de 1 000, até 50 páginas; ordenação por e-mail (`e-mail or ""`) | Teto evita laço infinito | n |
| Faixas do mapa de calor | 11 pontos por eixo, centro no último fechamento (índice 5). Açúcar ±25% (passo 5%, linhas decrescentes); dólar ±10% (passo 2%, colunas crescentes). Heatmap calculado a partir dos eixos já arredondados. "10 passos" lido como 10 intervalos, ou seja 11 pontos. Dólar passa de 10 para 11 colunas: conferir o front. | Sempre inclui o preço atual, no centro | n |
| Limites de risco | Exige P15 < média < P85 em cada variável (422, rótulos em português). NY truncado em zero. Moagem e ATR não entram no cálculo: na fórmula de custo moagem × ATR × atr_mtm = 0,6 × (faturamento − CBIO), então se cancelam; deixam de ser amostrados. Custo passa a ser `custo_fixo_1 + custo_fixo_2 + 0,6 × (fat − CBIO)`: mesmo valor, sem divisão por zero. Dúvida de negócio: a fórmula subtrai o preço do CBIO, não a receita `cbios × 31616`. | Desvio-padrão positivo; sem NaN na resposta | n |
| Merton (jump-diffusion) | Parecer Opus: `mu` é drift em log, então `σ²/2` extra contava duas vezes (≈ −5%/ano no centro). Corrigido: `inc = (mu − λ_d·μ_salto) + σZ + saltos`, com `saltos` vetorizado (soma de N saltos N(m,s²) ~ N(Nm, Ns²)). Vol segue diária. Mudança de efeito visível: informar no changelog. | Parecer do advisor Opus (revisão de spec) | y |
| Logging | Nível por `LOG_LEVEL` (padrão INFO); formato com data, nível, logger e `request_id`; `X-Request-ID` na resposta | Diagnóstico em produção sem dependência nova | n |

**Open questions:**
- Nomes de negócio dos custos fixos de Risco e Cenários (`risco_custo_fixo_1` etc.). Não bloqueia: a descrição em português já explica o valor.
- Nomes de negócio para os custos fixos (já sinalizados na tela). Não bloqueia.

---

## User Stories

### P1: Entradas inválidas viram mensagem, não erro 500 ⭐ MVP

**User Story**: Como usuário, quando digito um parâmetro fora do normal, quero saber o que corrigir.

**Acceptance Criteria**:

1. IF `/api/market/analysis` recebe período fora de 2–250, desvio do Bollinger fora de 0,5–5 ou mais de 5 médias THEN o backend SHALL responder 422 com "<parâmetro> deve estar entre <mín> e <máx>." (HARD-01)
2. IF MACD rápido ≥ MACD lento THEN o backend SHALL responder 422 com "O MACD rápido deve ser menor que o lento." (HARD-01)
3. The backend SHALL ter um handler que transforma qualquer exceção não tratada em 500 com "Erro inesperado. Se persistir, informe o código <request_id>." (ninguém é notificado automaticamente, então a mensagem não promete isso), registra o traceback no log e inclui CORS na resposta. (HARD-02)
4. IF `/api/breakeven` tem fechamento nulo ou valor de `admin_config` não numérico THEN o backend SHALL usar o último fechamento válido, ou o valor do código, sem responder 500. (HARD-02)
5. IF uma variável de Risco tem P15 ≥ média ou média ≥ P85 THEN `/api/risco` SHALL responder 422 com "<variável>: é preciso P15 < média < P85." (HARD-02)
6. IF `/api/options/payoff` recebe lista de pernas vazia THEN SHALL responder 422 (não 500). (HARD-02)

**Independent Test**: chamadas com `sma_periods=0`, `rsi_period=-1`, `macd_fast=30&macd_slow=26` respondem 422 com a mensagem; fechamento `None` em `/api/breakeven` não gera 500.

### P1: Lista completa de usuários no admin ⭐ MVP

**User Story**: Como admin, quero associar qualquer usuário a uma usina.

**Acceptance Criteria**:

1. WHEN `/api/admin/usuarios` é chamado THEN o backend SHALL percorrer todas as páginas do Supabase Auth (`page`/`per_page`) e retornar todos os usuários ordenados por e-mail. (HARD-03)
2. IF a página devolve menos usuários que `per_page` THEN a paginação para. Há um teto de páginas de segurança. (HARD-03)

**Independent Test**: com o cliente simulado retornando 3 páginas (2 cheias e 1 parcial), a resposta contém a soma das 3, em ordem de e-mail.

### P2: Constantes de negócio configuráveis

**User Story**: Como admin, quero atualizar fatores e custos da usina sem pedir deploy.

**Acceptance Criteria**:

1. The constantes usadas em `/api/metas`, `/api/risco`, `/api/cenarios` e `/api/breakeven` SHALL ser lidas de `admin_config`. (HARD-04)
2. WHEN uma constante não existe em `admin_config` (ou o valor não é número) THEN o backend SHALL usar o valor atual do código e registrar um aviso no log. (HARD-04)
3. IF o valor enviado a `PUT /api/admin/config/{key}` não é número (para chaves de constante) THEN SHALL responder 422 com "O valor de <chave> precisa ser numérico." (HARD-04)
4. The tela de admin SHALL mostrar cada constante com a descrição em português vinda de `admin_config`. (HARD-04)

**Independent Test**: alterar `fator_conversao_mtm` no banco e ver o MTM mudar na mesma proporção.

### P2: Mapa de calor de Metas sempre atual

**User Story**: Como trader, quero o mapa de calor em torno do preço de hoje.

**Acceptance Criteria**:

1. WHEN `/api/metas` roda THEN as faixas de açúcar e dólar SHALL ser centradas no último fechamento de SB=F e USDBRL=X com as amplitudes definidas em Assumptions. (HARD-05)
2. The célula correspondente ao preço atual (centro do mapa) SHALL ser destacada na tela. (HARD-05)

**Independent Test**: com fechamentos simulados de 18,00 ¢/lb e R$ 5,60, a faixa central de açúcar é 18,00 e a de dólar é 5,60, e a célula central é destacada.

### P2: Entradas de tamanho e período com teto

**User Story**: Como usuário, quero que pedidos grandes demais sejam recusados com clareza.

**Acceptance Criteria**:

1. IF `limit` está fora de 1–200 ou `offset` fora de 0–100 000 THEN o backend SHALL responder 422 com "O limite precisa estar entre 1 e 200." (ou o equivalente para o offset). (HARD-06)
2. IF o período de `/api/market/prices` ou `/api/market/analysis` passa de 25 anos THEN SHALL responder 422. (HARD-06)
3. IF `confidence` está fora de 0,5–0,999 ou `horizon` fora de 1–252 THEN `/api/var` SHALL responder 422. (HARD-06)
4. `opcao` em `POST /api/cenarios/save` SHALL ser `Literal` com os mesmos valores de `/api/cenarios`. (HARD-06)
5. IF `inputs`/`results` de risco ou o `value` de `admin_config` passam do limite de tamanho THEN SHALL responder 422. (HARD-06)

### P2: Endpoints de I/O bloqueante e rate limit

**User Story**: Como operador, quero o servidor sem bloquear o loop de eventos e sem abuso nos endpoints sensíveis.

**Acceptance Criteria**:

1. The endpoints `dolar_run`, `acucar_run`, `atr_simulate`, `dolar_defaults`, `acucar_defaults` e `get_focus` SHALL ser `def`; nenhum `asyncio.get_event_loop()` nem `import asyncio` dentro de endpoint. (HARD-07)
2. `/api/me`, `/api/admin/suggestions` (GET e PATCH), `/api/admin/market/backfill/{ticker}`, `/api/admin/config` (GET e PUT), `/api/options/payoff` e `/api/options/bs-price` SHALL ter `@limiter.limit`. (HARD-08)

### P2: Conflito só quando é conflito

1. IF a inserção de usina ou de associação falha por violação de unicidade (código 23505) THEN SHALL responder 409. Qualquer outra falha SHALL seguir para o handler global (500). (HARD-09)

### P3: Logs e código limpo

1. The backend SHALL configurar logging na inicialização, com nível vindo de `LOG_LEVEL` e formato com data, nível, logger e `request_id`. (HARD-10)
2. Cada requisição SHALL ter `request_id` (aceita `X-Request-ID` ou gera um) e devolver `X-Request-ID`. (HARD-10)
3. Não há import sem uso nem import no meio do arquivo em `main.py`. `fechamentos()` e `_serie_cache()` SHALL ser uma implementação só, em `market_cache.py`. (HARD-11)
4. The simulação de salto (jump-diffusion) SHALL ser vetorizada, mantendo a vol diária e a distribuição dos saltos. (HARD-12)

---

## Edge Cases

- IF não há fechamento recente de SB=F ou USDBRL=X THEN `/api/metas` SHALL responder 503 com "Sem preços recentes para montar o mapa de metas."
- IF `/api/breakeven` não tem preço recente THEN continua 503 como hoje.
- IF `per_page` do Supabase Auth retorna lista vazia na primeira página THEN a lista é vazia (200).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| HARD-01 | P1: Entradas inválidas (validação de indicadores) | Execute | Pending |
| HARD-02 | P1: Entradas inválidas (handler global e 500 de entradas) | Execute | Pending |
| HARD-03 | P1: Lista completa de usuários | Execute | Pending |
| HARD-04 | P2: Constantes configuráveis | Execute | Pending |
| HARD-05 | P2: Mapa de calor atual | Execute | Pending |
| HARD-06 | P2: Limites de tamanho e período | Execute | Pending |
| HARD-07 | P2: `def` em vez de `async` com I/O | Execute | Pending |
| HARD-08 | P2: Rate limit | Execute | Pending |
| HARD-09 | P2: 409 só para conflito | Execute | Pending |
| HARD-10 | P3: Logging e request-id | Execute | Pending |
| HARD-11 | P3: Código morto e fechamentos unificado | Execute | Pending |
| HARD-12 | P3: Jump-diffusion vetorizado | Execute | Pending |

**Coverage:** 12 total, 12 mapeados em `tasks.md`.

## Success Criteria

- [ ] Zero erro 500 nos logs causado por parâmetro de usuário.
- [ ] `pytest tests -q` e `test_calcs.py`/`test_mensagens.py` passam.
- [ ] Heatmap de Metas com o preço atual no centro.
