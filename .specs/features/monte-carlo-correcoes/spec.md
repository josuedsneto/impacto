# Correções do Monte Carlo — Especificação

## Problem Statement

A simulação de preços (`backend/simulation.py`, rota `POST /api/simulations`) tem cinco problemas que afetam o número que o usuário lê:

1. **O teto distorce os percentis.** O `np.clip` é aplicado à matriz inteira depois do `cumsum` e do `exp`. Com o teto padrão de ±50% e a volatilidade do açúcar, o P95 de 1 ano sai truncado. A docstring diz "clipped each step", o que é falso.
2. **Memória sem teto.** A matriz `dias × sims` é alocada inteira em float64: 1260 × 50.000 ≈ 500 MB por requisição. Não há garantia de RAM no backend.
3. **Validação incompleta.** O ticker da criação de simulação não passa por `validate_ticker` e o `PUT /api/params/{ticker}` também não, então qualquer usuário grava tickers arbitrários. `preco_inicial` aceita zero ou negativo.
4. **Fechamentos inválidos.** `closes` é logaritmizado sem filtrar `None` e `NaN`, o que contamina `mu` e `sigma`.
5. **Dados insuficientes viram 500.** `ValueError` com menos de 20 linhas vira erro 500 em vez de mensagem clara.

Além disso: não há seed (testes de `test_calcs.py` podem falhar ao acaso), e o limite de cenários diverge entre `SimulationForm.tsx` (50.000) e `MCPricer.tsx` (100.000). O preço inicial começa vazio, sem referência ao último fechamento.

## Goals

- [ ] Os percentis reportados são os da distribuição simulada, sem truncamento.
- [ ] O pico de memória por simulação não cresce com o número de dias.
- [ ] Nenhum ticker não validado é gravado no cache ou em `user_parameters`.
- [ ] Dados ruins (`None`, `NaN`, ≤ 0) não entram na estimativa; dados insuficientes respondem 422 com mensagem em português.
- [ ] Testes com seed fixa são determinísticos.
- [ ] Um único limite de cenários no frontend.
- [ ] A tela de simulação começa com o último fechamento e mostra a data.

## Out of Scope

| Item | Motivo |
|------|--------|
| Trocar GBM por outro modelo (Heston, bootstrap de retornos) | Mudança de metodologia, não correção. Fica como ideia futura. |
| Recalcular simulações já salvas no histórico | Dados salvos são registros; só as novas usam a regra nova. |
| Rate limit compartilhado entre workers | Já registrado como dívida em `backend-robustez`. |
| Mudar a fórmula de Monte Carlo de opções (`mc_call_price`) além do limite de cenários | Não há bug reportado nessa parte. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Teto (`pct_bound`) | **Não limita os cenários.** Vira limite de referência: a resposta traz `pct_passou_limite` (fração dos cenários que, em algum dia do prazo, saíram de ±pct_bound do preço inicial). A tela mostra "X% dos cenários saíram da faixa de ±Y% em algum dia do prazo." Com `pct_bound ≥ 1` a banda de baixo não existe (só a de cima). | Percentis do modelo, não de um GBM cortado. Advisor Opus confirmou. `pct_bound` continua existindo (params, UI). | y (advisor); **D1 pendente de confirmação do usuário** |
| Memória | Simulação por **blocos de dias** com `n` cenários fixos. O log acumulado (`carry`) passa de um bloco para o outro; `blk[0] += carry` antes do `cumsum`; `carry = blk[-1].copy()` antes do `exp`. Dias por bloco = `max(1, 5_000_000 // n)`. | Percentis diários são entre cenários, então ficam exatos. Blocos sequenciais dão a mesma stream do RNG que um bloco único, e a mesma ordem de somas: o teste usa igualdade exata. Bloco por cenários quebraria isso. | y (advisor) |
| Dtype | float64 | Blocos de ~40 MB bastam. | y |
| Seed | Parâmetro `seed: int | None = None` em `run_simulation`, repassado a `default_rng`. **Não exposto na API nem na tela.** | Testes reproduzíveis sem mudar contrato. | y (advisor) |
| Dados válidos | Preços `None`/NaN/≤0/infinitos viram NaN; depois `np.diff(np.log(...))`; depois descarta retornos não finitos. Exige ≥ 20 **retornos** válidos. | Filtrar antes do diff juntaria dois dias num retorno e inflaria sigma. | y (advisor) |
| Banda em log | `lo = -inf se pct_bound ≥ 1, senão log1p(-b)`; `hi = log1p(b)`. Comparação contra o preço inicial (banda fixa), OR acumulado por cenário, feito antes do `exp`. | Evita NaN para b ≥ 1. | y (advisor) |
| Erro de dados insuficientes | Exceção `DadosInsuficientesError(ValueError)` → HTTP 422 com "Não há dados históricos suficientes para {ticker}. Tente outro ativo ou tente mais tarde." | Mensagem clara, sem 500. | y |
| Validação | `validate_ticker` em `POST /api/simulations` e `PUT /api/params/{ticker}`; `preco_inicial` com `gt=0, le=100_000` | Igual à faixa da tela. | y |
| Limite de cenários | Duas constantes nomeadas em `frontend/lib/simulacao.ts`: `LIMITE_CENARIOS_SIMULACAO = {100, 50_000}` e `LIMITE_CENARIOS_OPCOES = {100, 100_000}`. Backend de opções **não muda**. | `mc_call_price` é O(n) de memória (~800 KB para 100k). Telas e custos diferentes justificam dois limites. Advisor recomendou não baixar o backend. | y (advisor); D2 registrado |
| Preço inicial | Ao escolher o ativo, busca o último fechamento em `/api/market/prices` (últimos 10 dias) e preenche o campo com a data ao lado | Pedido do usuário. | y |
| Coluna nova | `simulations.pct_passou_limite numeric` (nullable), migração nova | Para o histórico mostrar o mesmo número. Simulações antigas ficam sem o valor. | y |

**Open questions:** D1 e D2 (acima). Ambas ficam registradas como decisão do usuário no relatório.

---

## User Stories

### P1: Percentis sem truncamento ⭐ MVP

**User Story**: Como analista, quero que o P95 seja o da distribuição simulada, não o valor truncado pelo teto.

**Acceptance Criteria**:

1. WHEN `run_simulation` roda com volatilidade alta e `pct_bound=0.05` THEN o P95 final SHALL ser maior que `preco_inicial × 1.05`.
2. WHEN a simulação termina THEN a resposta SHALL trazer `pct_passou_limite` entre 0 e 1, calculado sobre os cenários que em algum dia saíram de `[preco_inicial × (1 − pct_bound), preco_inicial × (1 + pct_bound)]`.
3. The docstring de `run_simulation` SHALL descrever o comportamento real (sem teto nos caminhos; limite só como referência).
4. The tela SHALL trocar "O preço simulado fica limitado a esta variação" por texto que diz que o limite não restringe os cenários, e mostrar "X% dos cenários passaram do limite." quando `pct_passou_limite` existir.

**Independent Test**: `run_simulation` com seed fixa, `pct_bound=0.05`, volatilidade 60% a.a.: P95 > 1,05 × preço inicial e `pct_passou_limite` > 0,5.

### P1: Memória limitada por bloco ⭐ MVP

**User Story**: Como operador, quero que uma simulação de 1260 dias × 50.000 cenários não exija centenas de MB.

**Acceptance Criteria**:

1. WHEN `run_simulation` roda THEN nenhum bloco de simulação SHALL ter mais de ~5.000.000 de células (dias do bloco × cenários).
2. WHEN a simulação roda em vários blocos THEN os percentis diários e finais SHALL ser iguais (até erro de ponto flutuante) aos calculados com um único bloco, para a mesma seed.

**Independent Test**: com seed 42, `run_simulation` com limite de bloco forçado para 1 dia e com bloco único devolve as mesmas séries.

### P1: Entradas validadas ⭐ MVP

**User Story**: Como usuário, quero que um ticker ou preço inválido seja recusado com mensagem clara.

**Acceptance Criteria**:

1. WHEN `POST /api/simulations` recebe ticker fora de `^[A-Z0-9=.]{1,20}$` THEN o backend SHALL responder 400 com a mensagem de `validate_ticker`.
2. WHEN `PUT /api/params/{ticker}` recebe ticker inválido THEN o backend SHALL responder 400 e não gravar nada.
3. IF `preco_inicial` ≤ 0 ou > 100.000 THEN o backend SHALL responder 422.

**Independent Test**: os três casos com cliente de teste; nenhuma chamada ao Supabase no caso inválido.

### P1: Dados ruins e insuficientes ⭐ MVP

**User Story**: Como usuário, quando não há histórico suficiente, quero uma mensagem que diga o que fazer.

**Acceptance Criteria**:

1. WHEN os fechamentos têm `None`, `NaN`, infinito ou valores ≤ 0 THEN `run_simulation` SHALL descartá-los antes do log.
2. IF restarem menos de 20 retornos válidos THEN `run_simulation` SHALL levantar `DadosInsuficientesError`.
3. WHEN `DadosInsuficientesError` é levantada na rota THEN a resposta SHALL ser 422 com a mensagem da spec (não 500).

**Independent Test**: fechamentos com 5 `None` e 10 válidos → 422; com 30 válidos e 3 `NaN` → simulação roda com 30 retornos.

### P2: Reprodutibilidade

**User Story**: Como desenvolvedor, quero que os testes de simulação não falhem ao acaso.

**Acceptance Criteria**:

1. WHEN `seed` é informada THEN duas chamadas com os mesmos dados SHALL devolver percentis idênticos.
2. `test_calcs.py` SHALL passar `seed` fixa em todas as chamadas de `run_simulation`.

### P2: Tela com limite único e preço de partida atual

**User Story**: Como trader, quero o preço de partida preenchido com o último fechamento e a data visível.

**Acceptance Criteria**:

1. WHEN o usuário escolhe um ativo THEN a tela SHALL buscar o último fechamento dos últimos 10 dias e preencher o preço inicial, mostrando "Último fechamento: {preço} em {data}".
2. IF não há fechamento recente THEN a tela SHALL deixar o campo vazio e mostrar "Sem fechamento recente para este ativo."
3. The tela de simulação e o MCPricer SHALL usar `LIMITE_CENARIOS` de `frontend/lib/simulacao.ts`.

---

## Edge Cases

- `sigma = 0` e `mu = 0` (histórico constante) → sem erro; todos os cenários iguais ao preço inicial, `pct_passou_limite` = 0. Com `mu ≠ 0` o drift pode sair da faixa; isso é esperado.
- `pct_bound ≥ 1` → só a banda superior conta; sem NaN.
- Ticker válido sem linhas no cache → 422 (não 500).
- `num_simulacoes` = 50.000 e `dias_simulados` = 1260 → roda em blocos, sem exceder o teto de células.

---

## Fora de escopo adicional

- Streamlit legado (`pages/09_Monte_Carlo.py`, `pages/23_Opções.py`) mantém `np.clip`. Sai com o app legado (AD-006).
- `mu` com `volatilidade_custom` continua usando a média de log histórica (já embute −σ²/2 do histórico). Inconsistência registrada; não corrigida aqui.

## Decisões que o usuário precisa tomar

- **D1 — Teto:** o padrão proposto troca "limite que corta o cenário" por "limite de referência que só é contado". Alternativa: manter o corte, mas aceitar que os percentis de cauda ficam truncados (o que este spec corrige).
- **D2 — Limite de cenários:** mantidos dois limites (simulação 50.000; opções 100.000), conforme advisor. Alternativa: 100.000 também na simulação, com tempo de resposta maior.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| MC-01 | P1: Percentis sem truncamento (AC 1) | - | Pending |
| MC-02 | P1: Percentis sem truncamento (AC 2, `pct_passou_limite`) | - | Pending |
| MC-03 | P1: Percentis sem truncamento (AC 3, docstring) | - | Pending |
| MC-04 | P1: Percentis sem truncamento (AC 4, copy da tela) | - | Pending |
| MC-05 | P1: Memória limitada por bloco (AC 1) | - | Pending |
| MC-06 | P1: Memória limitada por bloco (AC 2, equivalência) | - | Pending |
| MC-07 | P1: Entradas validadas (AC 1–3) | - | Pending |
| MC-08 | P1: Dados ruins e insuficientes (AC 1–3) | - | Pending |
| MC-09 | P2: Reprodutibilidade (AC 1–2) | - | Pending |
| MC-10 | P2: Tela com limite único e preço atual (AC 1–3) | - | Pending |

**Coverage:** 10 total, 0 mapeados (Medium).

## Success Criteria

- [ ] Nenhum percentil reportado é truncado pelo teto.
- [ ] Pico de memória de `run_simulation` com 1260 dias × 50.000 cenários limitado pelo tamanho do bloco, não pelo produto total.
- [ ] `pytest tests`, `test_calcs.py`, `test_mensagens.py`, `npm test`, `npm run lint`, `npm run build` passam.
