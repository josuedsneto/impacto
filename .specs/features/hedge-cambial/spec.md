# Hedge cambial: travar, ficar aberto ou comprar proteção — Especificação

## Problem Statement

A usina recebe em dólar e precisa decidir como proteger a receita em R$ do vencimento da safra. As perguntas são: "travo agora no forward, fico aberto ou compro proteção?". Hoje o app mostra a faixa do câmbio e o preço de travar ([cambio-previsao](../cambio-previsao/spec.md)), mas não compara estratégias sobre a mesma distribuição. A resposta precisa vir da distribuição simulada da receita em R$, não de palpite.

## Goals

- [ ] Comparar cinco estratégias sobre os mesmos caminhos simulados: aberto, travar 100% no forward, travar X% no forward, put de dólar e collar.
- [ ] Para cada estratégia: p5, p50 e p95 da receita em R$; probabilidade de ficar abaixo do câmbio mínimo; prêmio; probabilidade de arrependimento (pior que ficar aberto no mesmo caminho).
- [ ] Usar uma única estimativa de volatilidade para o prêmio (Garman-Kohlhagen) e para os caminhos.
- [ ] Mostrar as premissas que mudam o resultado: forward acima do spot (carrego dos juros) e simulação com drift zero.

## Out of Scope

| Item | Motivo |
|------|--------|
| Integração com posições reais (`posicoes-fixacoes`) | v2. Depende do modelo de posição; fica registrado aqui como ligação futura. |
| Opções exóticas (barreira, asiática, digital) | Fora do desenho; o usuário pediu put e collar. |
| Recomendação automática da estratégia | Contraria a tela: "comparação de cenários, não recomendação". |
| Drift de carrego na simulação | Mantém o drift zero do modelo M1 (cambio-previsao). Com drift de carrego, o aberto ficaria igual ao forward em média; isso é uma decisão de modelo para outra spec. |
| Cache do resultado | Mesmo argumento de `cambio-previsao`: 10.000 caminhos × 262 dias são milissegundos. |
| Persistir parâmetros de hedge no banco | Usa `analises` (BotaoSalvarAnalise), sem tabela nova. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Medida dos caminhos | Mundo real: drift zero no log-preço, como `cambio.simular`. Prêmio e forward são de risco neutro | O modelo de câmbio do app é random walk (AD-012). Compara-se a receita esperada real com o custo de mercado | n |
| Forward usado | `F = cambio.forward(...)`, paridade coberta (Selic meta base 252, Fed funds ACT/360) | Mesmo preço mostrado em `/api/cambio/previsao`; uma única convenção | n |
| Taxas do GK | `r_dom = ln(1 + Selic)`; `r_for = r_dom − ln(F/S0)/T`, com `T = du/252`. Assim o forward do GK é exatamente o `F` acima | Obriga a paridade do GK com o forward mostrado; evita dois forwards na mesma tela | n |
| Volatilidade única | `sigma_dia = vol_ewma(retornos(janela))[1]` (o `sigma_proximo`, não o `pre`), anualizada por √252, com a mesma `janela` passada ao `simular`. Usada no GK e como vol inicial da simulação | Pedido do usuário. A EWMA é IGARCH: os resíduos têm E[ε²]=1, então E[σ²] fica igual ao estimado e a variância total do log é h·σ_dia², igual a σ²T no GK. Premissa: o GK é lognormal e o FHS tem cauda gorda; puts fora do dinheiro saem baratas em relação aos caminhos (sem smile) | n |
| Prêmio capitalizado | Prêmio pago hoje em R$ vale `prêmio × (1+Selic)^T` no vencimento. A receita é medida no vencimento | Prêmio sai do caixa hoje; sem capitalizar, o custo fica subestimado | n |
| Receita | `R$ = V × e − V × prêmio_por_USD × (1+Selic)^T`, onde `e` é a taxa efetiva por US$ no vencimento | Receita em R$ no vencimento, com custo incluído | n |
| Payoff por US$ (antes do prêmio) | aberto: `S_T`. Forward com `x = pct_forward/100` (fração interna): `x·F + (1−x)·S_T`. Put K: `S_T + max(K−S_T,0)`. Collar K1≤K2: `clamp(S_T, K1, K2)` | Payoffs de comprado em USD; ver Edge Cases para o collar | n |
| Taxa líquida | `taxa_liquida = receita_rs / V`, isto é, payoff menos prêmio capitalizado. É a taxa que a usina de fato recebe | Usada para orçamento e para a identidade do collar | n |
| Vol zero (testes) | `gk_price` lança erro com sigma ≤ 0. O módulo tem um wrapper: sigma = 0 → put `e^{−r_dom·T}·max(K−F,0)`, call `e^{−r_dom·T}·max(F−K,0)`; senão `gk_price` | Permite testar as identidades em vol zero sem mudar `options.py` | n |
| Carrego e medida | A simulação é drift zero (mundo real) e o forward/prêmio são de risco neutro, com drift de `ln(F/S0)/T` > 0. Por isso forward e put têm média acima do aberto e o collar, média abaixo, sem ser lucro garantido. A tela mostra `carrego_rs = V·(F−S0)` ao lado da média | Efeito do diferencial de juros que a simulação não embute; precisa aparecer na tela | n |
| Put e collar | Put comprada (direito de vender US$ a K). Collar: put comprada K1 e call vendida K2 | Exportador de dólar protege contra queda do câmbio | n |
| Prêmio do collar | `(P(K1) − C(K2))` por USD, com prêmio líquido pode ser negativo (crédito) | Custo líquido pedido pelo usuário | n |
| Câmbio mínimo (orçamento) | Padrão: o forward `F`. Métrica: P(taxa líquida < orçamento) | Pergunta mais comum: "cubro meu orçamento?". Padrão fica editável | n |
| Arrependimento | P(receita da estratégia < receita de ficar aberto), mesmo caminho | Definição do pedido | n |
| Comparação de média | Além de p5/p50/p95, mostrar a média da receita de cada estratégia | Torna visível o custo do carrego (ver Problem Statement) | n |
| Horizonte | `du` de 1 a 262 (mesmo limite de `cambio-previsao`); padrão 63 | Safra inteira | n |
| Volume | US$ > 0 e ≤ 10⁹ (1 bilhão). Padrão 1.000.000 | Cabe em `float` sem ruído; limite de sanidade | n |
| Percentual travado X | 0 a 100, padrão 50 | Estratégia (c) do pedido | n |
| Strikes | 0,5 a 20 (mesmo intervalo de `niveis`); padrões: put K = spot × 0,95; collar K1 = spot × 0,95, K2 = spot × 1,05. Collar exige K1 ≤ K2 | Ponto de partida sem digitação | n |
| Caminhos | 10.000, seed derivada de `ultimo_dado` (igual a `/api/cambio/previsao`) | Resultado estável entre recargas | n |
| Dados de câmbio | Mesma limpeza e mínimo de 252 fechamentos de `cambio-previsao`, extraídos para funções reutilizadas | Uma única fonte da série | n |
| Juros indisponíveis | Sem Selic ou Fed funds, 503 "Sem dados de juros para calcular o hedge. Tente novamente em alguns minutos." | Sem forward não há comparação | n |
| Dependência nova | Nenhuma. NumPy, SciPy (`norm`, em `options.py`) e o `gk_price` já existente | Regra de dependência | n |
| Forma do GK | `gk_price` existente. Quando `sigma = 0`, o prêmio é o valor intrínseco descontado (só para testes; a API exige vol > 0) | Permite testar a identidade em vol zero | n |
| Premissas exibidas | Texto fixo na resposta e na tela: forward acima do spot pelo diferencial de juros; simulação sem drift; prêmio por modelo | Transparência, sem números escondidos | n |

**Open questions:** o dono do produto confirma que o orçamento padrão (forward) faz sentido; o padrão pode ser trocado sem mudar a API.

---

## User Stories

### P1: Comparar estratégias sobre os mesmos caminhos ⭐ MVP

**User Story**: Como gestor de hedge, quero ver a receita em R$ de cada estratégia sobre os mesmos cenários para escolher entre travar, ficar aberto ou comprar proteção.

**Acceptance Criteria**:

1. **HED-01** WHEN `POST /api/hedge-cambial` é chamado com dados válidos THEN o backend SHALL devolver, para cada uma das cinco estratégias, `receita_rs` com `p5`, `p50`, `p95` e `media`, em R$ no vencimento.
2. **HED-02** The backend SHALL calcular, por estratégia, `p_abaixo_orcamento` = fração dos caminhos com taxa líquida (`receita_rs/V`, com prêmio capitalizado) < orçamento.
3. **HED-03** The backend SHALL calcular, por estratégia, `p_arrepender` = fração dos caminhos em que a receita da estratégia é menor que a receita de ficar aberto no mesmo caminho.
4. **HED-04** The backend SHALL devolver `premio_rs` (prêmio pago hoje, em R$; 0 para aberto e forward), `carrego_rs` = V·(F−S0), e `forward`, `spot`, `vol_anual`, `vencimento`, `selic_meta_aa`, `fed_funds_aa`, `forward_vs_spot` (F/S0 − 1) e o texto de premissas.
5. The tela SHALL mostrar a tabela estratégia × (p5, p50, p95, média, P abaixo do orçamento, P arrepender, prêmio) e o gráfico de distribuição da receita (faixa p5–p95 com marcador na mediana).

**Independent Test**: caminhos constantes em S0 com F = S0 (juros iguais) dão receita V·S0 em todas as estratégias e `p_arrepender = 0`. Com F > S0, o forward dá V·F em todos os caminhos e `p_arrepender(forward) = 0`.

### P1: Prêmio por Garman-Kohlhagen ⭐ MVP

**User Story**: Como gestor, quero o custo de uma put de dólar calculado com a mesma volatilidade da simulação.

**Acceptance Criteria**:

1. **HED-05** The backend SHALL precificar put e call com `options.gk_price`, usando `sigma = vol_ewma` anualizada, `T = du/252`, `r_dom = ln(1+Selic)` e `r_for` tal que o forward GK é igual ao `F` da paridade coberta.
2. The backend SHALL usar o mesmo `sigma_dia` para os caminhos (`cambio.simular`) e para o prêmio. Teste: a vol passada ao GK é a retornada por `vol_ewma` da mesma janela.
3. **HED-06** Teste de referência: o prêmio da put de `options.gk_price` confere com a fórmula fechada escrita à parte no teste (com `math.erf`) e com Monte Carlo risco-neutro (2 milhões de caminhos, tolerância 0,5%).

**Independent Test**: `test_hedge_cambial.py`, dados de S, K, T, r, σ fixos.

### P1: Collar e forward como identidades ⭐ MVP

**User Story**: Como gestor, quero confiar que o collar e o forward batem entre si, para que a tela não contradiga o forward.

**Acceptance Criteria**:

1. **HED-07** WHEN vol = 0 (caminhos constantes em S0) THEN a estratégia "travar 100% no forward" SHALL dar receita exatamente `V·F` em todos os caminhos.
2. **HED-08** WHEN vol = 0 AND a put tem K = F THEN a put SHALL dar receita `V·F` (prêmio zero, payoff `F − S0`). WHEN vol = 0 AND o collar tem K1 = K2 = F THEN o collar SHALL dar receita `V·F`.
3. **HED-09** WHEN K1 = K2 = K (vol > 0) THEN a receita do collar SHALL ser `V·F` em todos os caminhos, porque `P − C = (K − F)·e^(−r_dom·T)` pela paridade put-call do GK. (Nota: o forward já inclui o carrego dos juros; a receita do collar com K1 = K2 é o forward, sem carrego adicional.)
4. The backend SHALL responder 400 quando K1 > K2.
5. **HED-13** Teste de sinais: com caminhos lognormais de média F gerados no próprio teste (risco neutro, 1 milhão de caminhos), a média da receita de cada uma das cinco estratégias SHALL ser `V·F` ± erro de Monte Carlo. Valida de uma vez a capitalização do prêmio, os sinais e o r_for.

**Independent Test**: caminho constante e um caso com caminhos simulados, para a identidade do collar.

### P1: Validação e segurança ⭐ MVP

**User Story**: Como usuário, quero que entradas inválidas sejam recusadas com mensagem clara.

**Acceptance Criteria**:

1. **HED-10** The endpoint SHALL aceitar `volume_usd` (0 < v ≤ 10⁹), `horizonte_du` (1–262), `orcamento` (0,5–20; ausente = forward do prazo), `pct_forward` (0–100), `strike_put` (0,5–20), `collar_k1`, `collar_k2` (0,5–20, K1 ≤ K2). Fora disso, 422 (validação do corpo, como `posicoes` e `analises`). K1 > K2 responde 400 com mensagem em português.
2. The endpoint SHALL usar `Depends(get_current_user)` e `@limiter.limit("10/minute")`, e `def` (I/O bloqueante).
3. WHEN há menos de 252 fechamentos limpos THEN 503 com a mensagem de `cambio-previsao`. WHEN Selic ou Fed faltam THEN 503 "Sem dados de juros para calcular o hedge. Tente novamente em alguns minutos."
4. The endpoint SHALL recusar `nan` e `inf` (Pydantic `allow_inf_nan=False`).

**Independent Test**: `test_endpoints_hedge_cambial.py` com `api` e `yahoo` simulados.

### P1: Salvar e exportar ⭐ MVP

**User Story**: Como usuário, quero salvar a análise e exportar o CSV.

**Acceptance Criteria**:

1. **HED-11** The tela SHALL usar `BotaoSalvarAnalise` com `ferramenta="hedge_cambial"`. `backend/routers/analises.py` e `frontend/lib/analises.ts` SHALL aceitar essa ferramenta. A migration `20261118000008_analises_hedge_cambial.sql` SHALL trocar o CHECK de `analises.ferramenta` para incluí-la.
2. The tela SHALL exportar CSV com `gerarCsv` e `nomeArquivo("hedge_cambial", null)`: parâmetros e a tabela de estratégias.
3. The resumo salvo SHALL ficar abaixo de 8 KB (limite de `analises`) e trazer `leitura`.

### P1: Leitura e aviso ⭐ MVP

**User Story**: Como gestor, quero uma frase de leitura e o aviso de que não é recomendação.

**Acceptance Criteria**:

1. **HED-12** `lib/leitura.ts` SHALL ter `leituraHedge` que devolve uma frase com a receita mediana do aberto e da estratégia padrão (travar 100% no forward) e a probabilidade de a receita aberta ficar abaixo do orçamento. WHEN dados faltam THEN devolve `AUSENTE`.
2. The tela SHALL mostrar o aviso "Comparação de cenários, não recomendação."
3. The tela SHALL mostrar as premissas da resposta (forward acima do spot pelo diferencial de juros; simulação sem drift; prêmio por Garman-Kohlhagen).

---

## Edge Cases

- IF vol = 0 THEN o módulo usa o wrapper de vol zero (só alcançável em teste; a API exige vol > 0 pelos dados reais).
- IF X = 0 ou X = 100 THEN o forward parcial coincide com aberto ou com travar 100%.
- IF K1 = K2 THEN collar = travar no forward (HED-09).
- IF F/S0 é grande (diferencial de juros alto) THEN o forward fica muito acima do spot e a tela mostra `forward_vs_spot` com o número. Não há ajuste.
- IF a put tem K muito abaixo do spot THEN o prêmio é quase zero e a estratégia quase igual a aberto; não é erro.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| HED-01 | Comparar estratégias (receita por estratégia) | - | Pending |
| HED-02 | Comparar estratégias (P abaixo do orçamento) | - | Pending |
| HED-03 | Comparar estratégias (arrependimento) | - | Pending |
| HED-04 | Comparar estratégias (premissas e prêmio) | - | Pending |
| HED-05 | Prêmio GK (taxas e vol única) | - | Pending |
| HED-06 | Prêmio GK (referência) | - | Pending |
| HED-07 | Identidades (forward em vol zero) | - | Pending |
| HED-08 | Identidades (put e collar em vol zero) | - | Pending |
| HED-09 | Identidades (collar K1 = K2) | - | Pending |
| HED-10 | Validação e segurança | - | Pending |
| HED-11 | Salvar e exportar | - | Pending |
| HED-12 | Leitura e aviso | - | Pending |
| HED-13 | Teste de sinais (média = V·F com caminhos risco-neutros) | - | Pending |

**Coverage:** 13 total, 0 mapeados.

## Success Criteria

- [ ] `pytest tests -q` passa; `test_calcs.py` e `test_mensagens.py` passam.
- [ ] `npm test`, `npm run lint` e `npm run build` passam.
- [ ] Na tela, com os padrões, o forward aparece acima do spot e a receita do aberto tem média perto do spot (premissa visível).

---

## Revisão do advisor Opus (aplicada antes da implementação)

Aplicado: orçamento sobre taxa líquida (com prêmio); wrapper de vol zero, já que `gk_price` exige sigma > 0; teste de caminhos com F = S0 corrigido; carrego e medida explícitos, com `carrego_rs`; teste de sinais HED-13 com média = V·F; fração X interna; `sigma = sigma_proximo`, com a premissa de smile.

Não aplicado: strikes padrão centrados em F (em vez de spot). Mantidos centrados no spot por simplicidade; trocável sem mudar a API.
