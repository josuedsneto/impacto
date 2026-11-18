# Opções sobre futuro (Black-76) — Especificação

## Problem Statement

As opções da tela de Opções são precificadas por Black-Scholes sobre o **preço à vista** `S` com carrego `r`. O ativo real das opções que o app quer precificar é o **futuro de açúcar** (SB=F, ICE): nesse caso o modelo correto é Black-76, que usa o preço do futuro `F` e desconta o preço inteiro por `e^{-rT}`. Além disso, a entrada das pernas da estratégia aceita qualquer texto em `type` e `position` (qualquer valor diferente de "long" vira short em silêncio), e `quantity` não tem limite; entradas ruins podem chegar a erro 500. A tela também tem rótulos genéricos ("Black-Scholes"), recalcula de forma inconsistente entre as abas e mantém um preço antigo quando a entrada fica inválida.

## Goals

- [ ] Preço de call/put sobre futuro por Black-76, com paridade put-call verificada.
- [ ] Monte Carlo do mesmo modelo, com drift zero no futuro, convergindo para Black-76.
- [ ] Entrada da estratégia validada na API; nenhuma entrada inválida gera 500.
- [ ] `gk_price` (Garman-Kohlhagen) disponível no backend para o futuro hedge cambial, sem tela.
- [ ] Abas com nome que diz o que é; as duas abas de preço recalculam igual; entrada inválida não mostra preço antigo.
- [ ] Unidade (¢/lb) nos eixos e no tooltip do gráfico de payoff.

## Out of Scope

| Item | Motivo |
|------|--------|
| Gregas (delta, gamma, vega) | Não existem no código hoje e a spec não pede; "se houver" no briefing. |
| Put na tela de preço | Só o backend testa put (paridade). A tela segue só com call. |
| Tela de hedge cambial | Pedido explícito: só a função. |
| Renomear os caminhos `/api/options/bs-price` e `/api/options/mc-price` | Só o front consome; trocar caminho é churn sem ganho. O nome interno do modelo muda, o caminho não. |
| Unidade configurável por ativo | Hoje o ativo é açúcar (¢/lb). Se entrar dólar, vira feature própria. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Fórmula de Black-76 | Call = `e^{-rT}(F·N(d1) − K·N(d2))`, `d1 = (ln(F/K) + σ²T/2)/(σ√T)`, `d2 = d1 − σ√T`. Put = `e^{-rT}(K·N(−d2) − F·N(−d1))` | Padrão do modelo sobre futuro | n |
| Nome da função | `black76_price(F, K, T, r, sigma, tipo)` substitui `bs_call_price`; `mc_black76_price` substitui `mc_call_price`. `test_calcs.py` é atualizado | Nome antigo induz a erro, que é o defeito a corrigir | n |
| Campo de preço da API | `S` vira `F` nos requests de `bs-price` e `mc-price`; a resposta também usa `F` | Clareza; único consumidor é o front | n |
| Monte Carlo | Terminal exato: `F_T = F·exp(−σ²T/2 + σ√T·Z)`, payoff descontado por `e^{-rT}`. Aceita `seed` opcional; o endpoint fixa `seed=42` | Drift zero no futuro. Seed fixa faz o mesmo input dar o mesmo número ao recalcular automaticamente (sem "pulo" na tela) | n |
| Limite do MC | `mc-price` vai de 10/min para 60/min. Se bater 429, o front mostra o erro e remove o preço antigo | Recalcular a cada tecla (debounce 300 ms) estoura 10/min. O cálculo é vetorizado e barato | n |
| Garman-Kohlhagen | `gk_price(S, K, T, r_dom, r_for, sigma, tipo)` em `options.py`; sem rota. `d1 = (ln(S/K) + (r_dom − r_for + σ²/2)T)/(σ√T)`, call = `S·e^{−r_for T}N(d1) − K·e^{−r_dom T}N(d2)`. Aceita taxas negativas (EUR, JPY) | Pedido; reaproveitada pelo hedge cambial futuro | n |
| Validação da entrada | Literais são sensíveis a maiúsculas: "Long" dá 422. `type: Literal["call","put"]`, `position: Literal["long","short"]`, `quantity: int` 1..100 000, `strike` > 0 e ≤ 1 000 000, `premium` ≥ 0 e ≤ 1 000 000, `legs` com 1 a 20 pernas; `K` ≤ 1 000 000 também em `bs-price` e `mc-price`. `compute_payoff` rejeita `position` desconhecido com `ValueError`; `/api/options/payoff` converte `ValueError` em 400 | Limites da tela (`PayoffBuilder` FAIXAS) espelhados na API. A guarda fica no `compute_payoff`, que é o ponto por onde todos passam | n |
| Unidade | ¢/lb (açúcar NY), como em `formatCents` | Ativo da tela é SB=F | n |
| Cálculo automático | Ambas as abas recalculam com debounce de 300 ms; MC mantém o botão fora | Pedido: mesmo padrão nas duas abas | n |
| Entrada inválida | Preço vira `null`, aparece "Preencha os campos destacados para ver o preço." | Não mostrar número velho | n |

**Open questions:** nenhuma aberta; decisões acima registradas para confirmação do usuário.

---

## User Stories

### P1: Black-76 correto ⭐ MVP

**User Story**: Como trader, quero o preço de uma opção sobre o futuro de açúcar calculado pelo modelo de futuro, para não ter viés de carrego.

**Acceptance Criteria**:

1. WHEN `black76_price` é chamado com `tipo="call"` e `tipo="put"` com os mesmos parâmetros THEN `C − P` SHALL ser igual a `e^{−rT}(F − K)` com tolerância 1e−9.
2. WHEN `black76_price(F=20, K=20, T=1, r=0.05, sigma=0.2, tipo="call")` é chamado THEN o resultado SHALL ser 1,5154 ± 0,0001 (referência ATM `e^{−rT}·F·(2N(σ√T/2) − 1)`).
3. WHEN `mc_black76_price` com `seed=42` e 200 000 cenários é chamado THEN o preço SHALL ficar a menos de 1% do `black76_price`.
4. WHEN `/api/options/bs-price` recebe `F`, `K`, `T`, `r`, `sigma` THEN responde 200 com `price` calculado por Black-76.

**Independent Test**: `tests/test_options.py` (paridade, referência numérica, convergência MC).

### P1: Entrada validada ⭐ MVP

**User Story**: Como usuário, quero erro claro quando digito algo errado na estratégia, nunca uma falha do servidor.

**Acceptance Criteria**:

1. WHEN uma perna tem `type` diferente de "call"/"put" THEN a API SHALL responder 422.
2. WHEN uma perna tem `position` diferente de "long"/"short" THEN a API SHALL responder 422.
3. WHEN `quantity` é 0, negativo ou acima de 100 000 THEN a API SHALL responder 422.
4. WHEN `legs` é lista vazia THEN a API SHALL responder 422 (não 500).
5. WHEN `compute_payoff` recebe `position` desconhecido THEN SHALL levantar `ValueError` (não tratar como short).
6. WHEN a validação passa mas `compute_payoff` levanta `ValueError` THEN `/api/options/payoff` SHALL responder 400 com a mensagem.

**Independent Test**: testes de endpoint com `api` fixture (422 para cada caso) e teste unitário de `compute_payoff`.

### P1: Garman-Kohlhagen ⭐ MVP

**User Story**: Como desenvolvedor da thread de hedge cambial, quero `gk_price` pronta e testada.

**Acceptance Criteria**:

1. WHEN `gk_price` é chamado com `tipo` call e put THEN `C − P` SHALL ser `S·e^{−r_for·T} − K·e^{−r_dom·T}` com tolerância 1e−9.
2. WHEN `gk_price(S, K, T, r_dom, r_for, σ)` é comparado com `black76_price(F = S·e^{(r_dom − r_for)T}, K, T, r_dom, σ)` THEN os valores SHALL ser iguais com tolerância 1e−9.
3. WHEN `S`, `K`, `T` ou `sigma` é não positivo THEN SHALL levantar `ValueError`.

### P2: Tela clara e consistente

**User Story**: Como usuário, quero entender o que cada aba faz e ver o resultado atualizar do mesmo jeito em todas.

**Acceptance Criteria**:

1. The aba de preço SHALL se chamar "Preço justo (fórmula)" e a de simulação "Simulação (Monte Carlo)".
2. The campos de preço do futuro e strike SHALL mostrar a unidade "¢/lb" no rótulo; o resultado SHALL mostrar "¢/lb".
3. WHEN um campo muda THEN a aba de fórmula e a de simulação SHALL recalcular após 300 ms, sem botão.
4. WHEN algum campo está inválido THEN o preço exibido SHALL ser removido e a mensagem "Preencha os campos destacados para ver o preço." SHALL aparecer.
5. The eixo X e Y e o tooltip de `PayoffChart` SHALL mostrar "¢/lb".

---

## Non-Functional

- Sem dependência nova. `scipy.stats.norm` já está em uso.
- Endpoints continuam `def` (CLAUDE.md).
- Números exibidos passam por `lib/format.ts`.
