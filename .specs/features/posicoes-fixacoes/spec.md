# Posições e fixações da safra — Especificação

## Problem Statement

O app é um conjunto de calculadoras. Ninguém registra as fixações reais da usina (vendas de açúcar a preço fechado, futuros, NDFs de dólar, opções). Sem isso, a tela `fixacoes` mostra sinais técnicos e não a situação da usina: quanto da safra já está fixada, a que preço médio, quanto vale a carteira hoje e se a fixação está dentro da política de hedge. A equipe de trading controla isso numa planilha; esta feature transforma o app no painel da usina.

## Goals

- [ ] Registrar, editar e apagar posições de fixação por usina e safra.
- [ ] Ver, para uma safra: % fixado contra a produção estimada, preço médio fixado (¢/lb e R$/t), MTM total e data do preço usado.
- [ ] Ver se o % fixado está dentro, abaixo ou acima da política de hedge da safra.
- [ ] Carregar a planilha inicial por CSV no padrão Excel BR (AD-004) e exportar a carteira em CSV.

## Out of Scope

| Item | Motivo |
|------|--------|
| Alerta `posicao_limite` | v2: entra quando a thread de alertas for integrada. |
| Integração com ERP | v2. |
| Opções com MTM por modelo de precificação (Black-Scholes, Monte Carlo) | v2. No MVP o MTM de opção é o valor intrínseco menos o prêmio pago. |
| Painel combinando VaR e breakeven sobre a parte não fixada | v2. |
| Política com faixas diferentes ao longo do tempo | MVP: uma faixa (mínimo e máximo) por usina e safra. |
| Posições vendidas em opção (lançamento) e posições compradas em futuro/NDF | MVP: fixações de venda e opções compradas. Ver Assumptions. |
| Exportação feita pelo backend | Os dados já estão no navegador; `lib/csv.ts` gera o arquivo. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Nome da tabela de posições | `posicoes` | Pedido na tarefa. | y |
| Nome da tabela de política | `politica_hedge`, uma linha por `(usina_id, safra)` | Política e produção estimada ficam juntas: a produção é o denominador do % fixado e muda por safra. A tela `params` é por ativo, não por usina, então não serve. | n |
| Usina | Toda posição tem `usina_id`. A usina é escolhida entre as associadas ao usuário (`GET /api/atr/usinas`). | Mesmo controle de acesso do ATR (`user_usinas`). | n |
| Unidade | Derivada do instrumento, não digitada: sugar em `t`, dólar em `US$`. | Evita combinação inválida (ex.: NDF em toneladas). | n |
| Direção | Fixação de açúcar, futuro de açúcar e NDF são **vendas** (a usina vende açúcar ou recebe dólar). Opções são **compradas** (put ou call). | Quase toda hedge de usina é venda. Posições vendidas em opção ficam fora do MVP. | n |
| Preço do açúcar | ¢/lb, último fechamento de `SB=F` via `get_prices`. | Pedido na tarefa; mesma fonte das outras telas. | y |
| Câmbio de marcação | Último fechamento de `USDBRL=X`. | Pedido na tarefa. | y |
| Conversão ¢/lb → R$/t | `FATOR = 22.0462 * 1.04` multiplicado pelo câmbio. Constante local em `routers/posicoes.py`. | Mesmo fator de `main.py` (MTM da tela de metas). Ponto de atenção: se `backend-robustez` mover o fator para `admin_config`, troque a constante por leitura de lá. | n |
| MTM de fixação de açúcar | `(preço fixado − SB=F) × FATOR × câmbio spot × volume (t)`. Positivo quando o mercado caiu abaixo do fixado. | Valor de liquidação a mercado de uma venda a preço fechado. | n |
| MTM de NDF de dólar | `(taxa fixada − USDBRL spot) × volume (US$)`, em R$. | Usina vendeu dólar a termo. | n |
| MTM de opção (MVP) | Put: `max(K − S, 0) − prêmio`; call: `max(S − K, 0) − prêmio`, multiplicado como no MTM do açúcar ou do dólar. Valor intrínseco, sem tempo. | Opção comprada: o prêmio é o custo pago. Preço-tempo sai no v2. Documentado na tela. | n |
| Prêmio | Na mesma unidade do preço fixado (¢/lb ou R$/US$). Opcional (0 se vazio). | Mantém a conta simples. | n |
| % fixado | Soma do volume em t de `fixacao_acucar`, `futuro_acucar` e `opcao_acucar` ÷ `producao_estimada_t` da política. Opção conta pelo volume nocional, não pelo exercício. | Mede cobertura de produção, não de caixa. | n |
| Preço médio fixado | Média ponderada pelo volume (t) dos instrumentos de açúcar. Em ¢/lb usa o preço; em R$/t usa `preço × FATOR × câmbio fixado`. Posição sem câmbio fixado fica fora da média em R$/t e aparece em `avisos`. | Câmbio fixado é opcional no cadastro; a média não pode inventar um câmbio. | n |
| Status contra a política | `abaixo` se % < mínimo, `acima` se % > máximo, `dentro` nos demais. `sem_politica` ou `sem_producao` quando faltar o dado. | Pedido na tarefa. | n |
| Volume de opção | Nocional em t (açúcar) ou US$ (dólar). | Mesma unidade do instrumento. | n |
| Acesso | Leitura e escrita pela API com `user_usinas`. RLS no banco com o mesmo critério. Policies de INSERT/UPDATE com `WITH CHECK`. | Padrão de `atr_simulacoes`. A API usa service role, então o RLS é a segunda barreira. | n |
| Criado por | `criado_por` preenchido pela API com o `user["id"]`, nunca pelo corpo da requisição. | Não se pode atribuir a posição a outro usuário. | n |
| Importação CSV | Frontend lê o CSV e envia tudo de uma vez para `POST /api/posicoes/lote` (máximo 500 linhas). Erro de linha aborta o lote inteiro e aponta a linha. | Uma requisição só: o limite de 10/min não permite uma por linha. | n |
| Exportação CSV | Frontend, com `gerarCsv`: parâmetros (usina, safra, política, preços usados) e a tabela de posições com MTM por posição. | AD-004; reaproveita `lib/csv.ts`. | n |
| Rotas | `/api/posicoes` (CRUD e lote), `/api/posicoes/resumo`, `/api/politica-hedge`. Política é rota própria para não colidir com `/api/posicoes/{id}`. | Evita a armadilha de ordem de rotas. | n |
| Router | `backend/routers/posicoes.py` com `APIRouter`; `main.py` ganha só o `include_router` no fim do arquivo. `limiter` é importado de `main`, que já o define antes do include. | Regra do CLAUDE de coordenação. | n |

**Open questions:**

- Confirmar com a trading se a usina trabalha com `FATOR = 22.0462 * 1.04` (o 1.04 é a convenção do código; a origem não está documentada).
- Confirmar se há posições compradas em futuro ou NDF na carteira real. Se houver, a direção precisa virar campo (v2 ou antes do MVP).

---

## Revisão do advisor Opus (decisões que prevalecem sobre a tabela acima)

| # | Decisão | Motivo |
|---|---|---|
| R1 | Opções do MVP são **só put** (`opcao_acucar`, `opcao_dolar`). Não há campo `tipo_opcao`. Call comprada fica fora (v2). | Usina vendedora de açúcar/USD se protege com put (piso). Call comprada não é hedge. |
| R2 | % fixado soma só `fixacao_acucar`, `futuro_acucar` e `opcao_acucar` (put). Escala: `pct_fixado`, `minimo_pct`, `maximo_pct` são **pontos percentuais (0–100)** na API e na tela. | Casa com `formatNumber` + "%"; `formatPercent` espera fração e geraria 5000%. |
| R3 | Preço médio (¢/lb e R$/t) usa só `fixacao_acucar` e `futuro_acucar`. Strike de opção não entra. Para opção, `preco_fixado` = strike K. | Strike é piso, não preço travado. |
| R4 | Semântica do câmbio: MTM de açúcar usa ¢/lb × SB spot × USDBRL spot (`cambio_fixado` não entra no MTM). Média em R$/t usa `preco × FATOR × cambio_fixado`; denominador = soma do volume das posições **com** câmbio; `null` se o denominador for zero. | O dólar é marcado nos NDFs; `cambio_fixado` é o câmbio contratado, informativo para a média. |
| R5 | `criado_por UUID NULL REFERENCES auth.users ON DELETE SET NULL`. `usina_id REFERENCES usinas ON DELETE RESTRICT`. Update não aceita `usina_id` nem `criado_por`. | Apagar um usuário não pode apagar a carteira. |
| R6 | RLS em `posicoes` e `politica_hedge`: SELECT, INSERT, UPDATE (USING e WITH CHECK) e DELETE, todos por `usina_id IN (SELECT usina_id FROM user_usinas WHERE user_id = auth.uid())`; INSERT também exige `criado_por = auth.uid()`. `politica_hedge` tem `UNIQUE (usina_id, safra)`. | O exemplo `atr_simulacoes` não tem WITH CHECK nem DELETE. |
| R7 | Posição de outra usina (ou inexistente) em PUT/DELETE responde **404**, sem vazar existência. | Não revela IDs de outras usinas. |
| R8 | `producao_estimada_t` é nullable; `minimo_pct`/`maximo_pct` também. Sem produção → `status = sem_producao`, `pct_fixado = null`. Sem linha de política → `sem_politica`. | `sem_producao` precisa poder acontecer. |
| R9 | Migração tem CHECK: `instrumento IN (5 valores)`, `volume > 0`, `preco_fixado > 0`, `safra ~ '^\d{4}/\d{2}$'`. Unidade não é coluna: a API a deriva (`t` para açúcar, `US$` para dólar). | Regra no banco, sem coluna redundante. |
| R10 | Colunas de `posicoes`: `id`, `usina_id`, `safra`, `instrumento`, `volume`, `preco_fixado`, `cambio_fixado`, `premio`, `vencimento`, `contraparte`, `observacao`, `criado_por`, `created_at`. `premio` default 0. | Lista explícita, sem invenção na implementação. |
| R11 | Resumo: `data_sb` e `data_usdbrl` separadas (último `close` não nulo de `get_prices(t, hoje−10d, hoje)`). Sem posições → 200 com preços `null`, sem chamar Yahoo. | Feriado de um lado não esconde preço velho. |
| R12 | Posições vencidas ou com vencimento anterior à data do preço: MTM marcado contra o SB=F da frente, sem ajuste de mês. Documentado na tela como aviso. Fora do MVP tratar liquidação. | Limitação conhecida, registrada. |
| R13 | Rotas: não há `GET /api/posicoes/{id}`. `/resumo` e `/lote` são declaradas antes de `/{id}` (PUT, DELETE). | Evita o 422 que bloqueia a rota seguinte. |
| R14 | Router `routers/posicoes.py` (com `routers/__init__.py`); `from main import limiter`; o `include_router` é a última linha de `main.py`. Usa `market_cache.supa_client()` pelo módulo para o patch dos testes. | Import circular seguro só nessa ordem. |
| R15 | Lote: corpo `{usina_id, safra, posicoes: [...]}`, máximo 500 no backend. Erro de validação mapeia `loc` com índice i → "linha i+2 do CSV". Um único insert de lista. | Atômico numa requisição. |
| R16 | Testes: `conftest.py` ganha `insert`, `update` e `delete` no `FakeSupabase`. MTM com `pytest.approx`, incluindo put fora do dinheiro (MTM = −prêmio × FATOR × câmbio × vol) e NDF. | Fake atual não cobre as operações novas. |
| R17 | Open question adicional: confirmar se a usina usa o mesmo fator de faturamento de `main.py:1683` (`(ny − 0,19) × 22,0462 × 1,04`). O desconto de 0,19 se cancela no MTM, mas o preço médio em R$/t fica cerca de 1% acima do faturamento. | Convenção ainda não confirmada. |

## User Stories

### P1: Cadastrar e manter posições ⭐ MVP

**User Story**: Como trading da usina, quero registrar cada fixação com instrumento, volume, preço e vencimento para manter a carteira da safra atualizada.

**Acceptance Criteria**:

1. WHEN o usuário envia uma posição válida para uma usina associada THEN a API SHALL gravar a posição com `criado_por` = usuário autenticado e responder 201.
2. IF o usuário não está associado à usina THEN a API SHALL responder 403 e não gravar nada.
3. IF o instrumento não é um dos cinco valores permitidos THEN a API SHALL responder 422.
4. IF volume ou preço fixado não são maiores que zero THEN a API SHALL responder 422.
5. IF o instrumento é opção e `tipo_opcao` não é `call` ou `put` THEN a API SHALL responder 422.
6. WHEN a posição é de açúcar THEN a unidade SHALL ser `t`; WHEN é de dólar THEN a unidade SHALL ser `US$`. A unidade não é aceita do cliente.
7. WHEN o usuário edita ou apaga uma posição de uma usina associada THEN a API SHALL aplicar a mudança; WHEN a posição não existe THEN a API SHALL responder 404.
8. The tabela de posições SHALL ter RLS ligado, com leitura, escrita e `WITH CHECK` restritos aos membros da usina.

**Independent Test**: testes de API com `FakeSupabase` (`backend/tests/`): criação, 403 sem associação, 422 para instrumento inválido e para opção sem tipo, unidade derivada.

---

### P1: Ver o resumo da safra ⭐ MVP

**User Story**: Como trading, quero ver numa tela só quanto da safra está fixado, a que preço e quanto vale a carteira hoje.

**Acceptance Criteria**:

1. WHEN o usuário pede `GET /api/posicoes/resumo?usina_id=&safra=` THEN a API SHALL responder `pct_fixado`, `preco_medio_cents_lb`, `preco_medio_rs_t`, `mtm_total_rs`, `data_preco`, `sb_fechamento`, `usdbrl_fechamento`, `status` e a lista de posições com o MTM de cada uma.
2. WHEN o resumo é calculado THEN os preços SHALL vir de `get_prices` (último fechamento de `SB=F` e `USDBRL=X`), com `data_preco` = a data do fechamento mais recente.
3. IF não há preço disponível para `SB=F` ou `USDBRL=X` THEN a API SHALL responder 503 com a mensagem "Não foi possível obter os preços de SB=F agora. Tente novamente em alguns minutos." (ou o ticker que faltou).
4. WHEN a safra não tem política ou produção estimada THEN `status` SHALL ser `sem_politica` ou `sem_producao` e `pct_fixado` SHALL ser `null` se faltar produção.
5. WHEN o % fixado está abaixo do mínimo THEN `status` SHALL ser `abaixo`; acima do máximo, `acima`; nos demais casos, `dentro`.
6. IF uma posição de açúcar não tem câmbio fixado THEN ela SHALL ficar fora de `preco_medio_rs_t` e a API SHALL listar o caso em `avisos`.
7. WHEN o MTM é calculado THEN a API SHALL aplicar as fórmulas da tabela de Assumptions (açúcar, NDF e opção), e `mtm_total_rs` SHALL ser a soma do MTM das posições.
8. The resumo SHALL ser `def` (I/O bloqueante) e usar `market_cache.supa_client()`.

**Independent Test**: testes com `FakeYahoo` de preço constante conhecido: uma fixação de 1000 t a 20 ¢/lb com SB a 18 ¢/lb e câmbio 5 gera MTM = 2 × 22.0462 × 1.04 × 5 × 1000. Testes de status dentro/abaixo/acima e de 503.

---

### P1: Ver a situação na tela ⭐ MVP

**User Story**: Como trading, quero abrir a tela da safra e ver os cartões, a tabela de posições e o status contra a política.

**Acceptance Criteria**:

1. WHEN a página carrega THEN ela SHALL mostrar quatro cartões: % fixado (com a faixa da política ao lado), preço médio fixado (¢/lb e R$/t), MTM total e a data do preço.
2. WHEN o status é `abaixo` ou `acima` THEN o cartão de % fixado SHALL mostrar o aviso com a cor de token de alerta e o texto do status (não só a cor).
3. The tabela de posições SHALL permitir criar, editar e apagar posições em linha, com confirmação antes de apagar.
4. WHEN a API responde erro THEN a página SHALL mostrar a mensagem via `mensagemDeErro` (`lib/api.ts`), sem texto técnico.
5. WHEN a usina não tem posições THEN a página SHALL mostrar `EmptyState` com a dica para importar a planilha ou cadastrar a primeira posição.
6. The página SHALL usar `formatNumber`, `formatCents`, `formatBRL`, `formatPercent` e `formatDate` de `lib/format.ts` e nenhuma cor fora de `globals.css` (AD-008; `lib/regras-ui.test.ts`).
7. The página SHALL ter a entrada "Posições da safra" no `NavLinks.tsx`, na seção "Mercado", em uma linha.

**Independent Test**: `npm test` (regras de UI); navegação pelo menu; criar, editar e apagar uma posição em desktop e em 360px.

---

### P2: Carregar a planilha inicial ⭐ MVP

**User Story**: Como trading, quero importar a carteira que já tenho numa planilha, sem digitar tudo.

**Acceptance Criteria**:

1. WHEN o usuário escolhe um arquivo CSV THEN a página SHALL ler separador `;`, vírgula decimal, BOM UTF-8 e as colunas do cadastro (nomes em português, sem acentos exigidos na comparação).
2. WHEN o CSV é válido THEN a página SHALL mostrar a prévia (quantidade de linhas) e, ao confirmar, enviar tudo para `POST /api/posicoes/lote`.
3. IF uma linha é inválida THEN a página SHALL não gravar nada e mostrar o número da linha e o motivo.
4. IF o arquivo tem mais de 500 linhas THEN a página SHALL recusar com a mensagem de limite.

**Independent Test**: testes unitários do parser CSV com número com vírgula, texto com `;` entre aspas, linha vazia no fim e cabeçalho fora de ordem.

---

### P2: Exportar a carteira ⭐ MVP

**User Story**: Como trading, quero baixar a carteira e o resumo em CSV para mandar à diretoria.

**Acceptance Criteria**:

1. WHEN o usuário clica em "Exportar CSV" THEN o arquivo SHALL seguir AD-004 e o padrão de `lib/csv.ts`, com nome `posicoes_<usina>_<safra>_<AAAA-MM-DD>.csv`.
2. The arquivo SHALL trazer, antes da tabela, os parâmetros: usina, safra, política mínima e máxima, produção estimada, SB=F e USDBRL=X usados e a data do preço.
3. The tabela SHALL trazer uma linha por posição, com o MTM em R$ de cada uma.
4. WHILE não há resumo carregado THEN o botão SHALL ficar desabilitado com a dica do `BotaoExportar`.

**Independent Test**: teste de `gerarCsv` com a carteira de exemplo; abrir o arquivo no Excel pt-BR.

---

### P2: Definir a política de hedge ⭐ MVP

**User Story**: Como trading, quero registrar o mínimo e o máximo fixado da safra e a produção estimada.

**Acceptance Criteria**:

1. WHEN o usuário grava a política THEN a API SHALL fazer upsert por `(usina_id, safra)` com `minimo_pct`, `maximo_pct` e `producao_estimada_t`.
2. IF `minimo_pct` > `maximo_pct` OU algum valor está fora de 0–100 (produção: > 0) THEN a API SHALL responder 422.
3. The página SHALL mostrar a política no cartão de % fixado e permitir editá-la no mesmo lugar.

**Independent Test**: teste de 422 para mínimo > máximo; teste de upsert (segunda gravação substitui a primeira).

---

## Edge Cases

- IF a safra tem posições mas nenhuma de açúcar THEN `pct_fixado` = 0 e o preço médio SHALL ser `null` (não zero).
- IF o volume total de açúcar é zero THEN o preço médio SHALL ser `null`, sem divisão por zero.
- IF `producao_estimada_t` é `null` ou zero THEN `pct_fixado` SHALL ser `null` e `status` `sem_producao`.
- IF a posição de opção está fora do dinheiro THEN o valor intrínseco SHALL ser zero e o MTM SHALL ser `−prêmio`.
- IF a usina está associada mas a safra não existe ainda THEN o resumo SHALL responder 200 com listas vazias (não 404).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| POS-01 | Cadastrar posições (AC1–AC2) | Design | Pending |
| POS-02 | Cadastrar posições (AC3–AC6) | Design | Pending |
| POS-03 | Editar e apagar; RLS (AC7–AC8) | Design | Pending |
| POS-04 | Resumo: preços, média e MTM (AC1–AC3, AC6–AC7) | Design | Pending |
| POS-05 | Resumo: status e avisos (AC4–AC5) | Design | Pending |
| POS-06 | Tela: cartões, tabela e status (AC1–AC7) | Design | Pending |
| POS-07 | Importação CSV (P2 AC1–AC4) | Design | Pending |
| POS-08 | Exportação CSV (P2 AC1–AC4) | Design | Pending |
| POS-09 | Política de hedge (P2 AC1–AC3) | Design | Pending |
| POS-10 | Edge cases | Design | Pending |

---

## Success Criteria

- [ ] Uma fixação de teste produz MTM e % fixado iguais aos calculados à mão na planilha da trading.
- [ ] `test_calcs.py`, `test_mensagens.py`, `pytest tests` e `npm test` / `npm run lint` / `npm run build` passam.
- [ ] A tela funciona em 360px (AD-005).
