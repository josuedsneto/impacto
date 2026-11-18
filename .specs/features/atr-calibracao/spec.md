# ATR — correção da calibração — Especificação

## Problem Statement

O simulador de ATR calibra o modelo de cada usina com `atr_simulacoes.atr_esperado`, isto é, com as **próprias previsões** (`backend/main.py`, `atr_simulate`, linha que monta `atr_real`). O modelo só reproduz a si mesmo, e o intervalo de 90% não tem significado estatístico. Além disso:

- o desvio-padrão residual usa ddof=0 (`np.std`), quando com 3 parâmetros o correto é `sqrt(SSR/(n-3))`;
- o intervalo usa z=1,645 sobre o resíduo in-sample e ignora a incerteza dos coeficientes (previsão de uma nova observação precisa dela);
- a calibração aceita 5 pontos, pouco para 3 coeficientes com sazonalidade;
- com dados colineares o OLS não falha (usa pinv) e o código calibra com coeficientes instáveis, sem cair no fallback.

Esta feature corrige a calibração e passa a usar só ATR medido. A tabela de medições reais (`atr_medicoes`) e o upload/formulário são da feature `atr-dados-reais` (AD-003) e **ainda não existem**. Por isso esta feature lê a tabela se ela existir e, se não existir, usa os coeficientes do setor e avisa o usuário.

**Por que uma spec nova e não `atr-dados-reais`:** a `atr-dados-reais` descreve a carga completa (tabela, upload, formulário, edição). Esta é a correção do cálculo e da leitura, que vale antes e independentemente dela. Quando `atr-dados-reais` for entregue, este código não muda: a tabela passa a existir e a calibração passa a usá-la.

## Goals

- [ ] O modelo nunca é calibrado com `atr_simulacoes` (previsões).
- [ ] O intervalo de 90% é um intervalo de previsão de uma nova observação, com a incerteza dos coeficientes e t de Student com n-3 graus de liberdade.
- [ ] Calibração só com 12 ou mais meses válidos; abaixo disso, coeficientes do setor e aviso.
- [ ] Colinearidade é detectada e cai nos coeficientes do setor com aviso.
- [ ] O histórico de simulações filtra no banco e não expõe `user_id` de outros membros.

## Out of Scope

| Item | Motivo |
|------|--------|
| Criar a tabela `atr_medicoes`, o upload e o formulário mensal | Feature `atr-dados-reais`. Dependência registrada abaixo. |
| Trocar as variáveis do modelo (usar pureza ou precipitação com defasagem) | Decisão de modelagem separada; o modelo continua com chuva e impureza total. |
| Recalibrar coeficientes do setor | Os valores de `get_sector_defaults` não mudam nesta feature. |
| Migrar simulações antigas | Simulações já salvas continuam como estão; só o cálculo novo muda. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Fonte da calibração | Linhas de `atr_medicoes` da usina com ATR, impureza vegetal, impureza mineral e precipitação preenchidos | AD-003 e a spec `atr-dados-reais` | n |
| Impureza usada no modelo | Vegetal + mineral (%) | O modelo tem uma variável de impureza; a soma é a impureza total exibida ao usuário | n |
| Mínimo de meses | 12 válidos (9 graus de liberdade com 3 parâmetros) | Abaixo disso o desvio-padrão residual é instável; 12 meses cobrem cerca de 1,5 safra | n |
| Desvio-padrão | `s = sqrt(SSR/(n-3))` | Estimador não viesado da variância do erro | n |
| Intervalo | Previsão de uma observação: `ŷ ± t(0,95; n-3) · sqrt(s² · (1 + x₀ᵀ(XᵀX)⁻¹x₀))` | Equivale a `get_prediction(x₀).summary_frame(alpha=0.10)` do statsmodels (colunas `obs_ci_*`). Usa t, não z, porque n é pequeno | n |
| Coeficientes do setor (fallback) | Mantém o intervalo atual: `ŷ ± 1,645 · 5,0` | Sem dados não há incerteza estimada; o aviso já sinaliza isso | n |
| Colinearidade | Desvio-padrão de chuva ou impureza < 1e-9 (variável constante) **ou** `abs(corr(chuva, impureza)) >= 0.95` (VIF ≥ 10) → setor com aviso. Valores não finitos são descartados como linhas inválidas | Pinv não falha, e o número de condição de colunas padronizadas só dispara com |r| ≈ 1; a correlação entre chuva e impureza é o caso real | n |
| Tabela ausente | `APIError` com código `PGRST205` ou `42P01` (tabela não existe) é tratado como zero medições; qualquer outro erro é propagado | Permite entregar agora sem mascarar falhas reais do banco | n |
| Colunas de `atr_medicoes` (fixadas aqui) | `usina_id`, `mes_ref date` (1º dia do mês), `atr_kg_t`, `impureza_vegetal_pct`, `impureza_mineral_pct`, `precipitacao_mm`, `pureza_pct` (opcional) | Nomes fixados para o código não mudar quando a tabela for criada | n |
| Arredondamento | Nada é arredondado em `calibrate_atr` nem em `cov`; só a resposta de `predict_atr` é arredondada a 3 casas | Permite comparar com statsmodels em 1e-6 | n |
| Histórico | `.eq(usina_id).or_(f"user_id.eq.{uid},compartilhado.is.true")` na query, antes de `order`/`limit`; `uid` vem do JWT validado e passa por `UUID()`. Resposta traz `minha: bool` em vez de `user_id` | Remove o limite aplicado antes do filtro e não vaza `user_id` de terceiros; `is.true` trata `compartilhado` NULL | n |
| Aviso na tela | Texto vindo do backend em `aviso`, mostrado quando `calibracao == "setor"` | Mensagem fica num lugar só | n |

**Open questions:** nenhuma para esta feature. Dependência aberta: `atr-dados-reais` (tabela + carga).

---

## User Stories

### P1: Calibração com ATR medido ⭐ MVP

**User Story**: Como gestor agrícola, quero que o intervalo de ATR reflita o erro real do modelo.

**Acceptance Criteria**:

1. The `calibrate_atr` SHALL receber linhas com `chuva_mm`, `impureza_pct`, `atr_real` e devolver os coeficientes, `sigma = sqrt(SSR/(n-3))`, `meses_usados`, `calibracao` (`"usina"` ou `"setor"`), `aviso` (texto ou `None`), e, quando calibrado, `cov` (matriz 3×3 de covariância dos coeficientes) e `gl` (n-3).
2. IF há menos de 12 linhas válidas THEN `calibrate_atr` SHALL devolver os coeficientes do setor com `calibracao: "setor"` e `meses_usados` igual ao número de linhas válidas.
3. IF a variância de chuva ou impureza é nula, ou `abs(corr(chuva, impureza)) >= 0.95` THEN `calibrate_atr` SHALL devolver os coeficientes do setor com `calibracao: "setor"` e `aviso` dizendo que os dados são colineares.
4. WHEN há 12 ou mais linhas válidas e a matriz é estável THEN `calibrate_atr` SHALL devolver `calibracao: "usina"` com os coeficientes OLS.
5. WHEN `predict_atr` recebe parâmetros calibrados com `cov` THEN o intervalo SHALL ser o intervalo de previsão de 90% da regra acima, igual ao `obs_ci` do statsmodels com os mesmos dados (diferença ≤ 1e-3, porque a resposta é arredondada a 3 casas).
6. WHEN `predict_atr` recebe parâmetros do setor (sem `cov`) THEN o intervalo SHALL ser `ŷ ± 1,645 · sigma`.
7. The `/api/atr/simulate` SHALL calibrar só com linhas de `atr_medicoes` da usina (impureza total = vegetal + mineral) e não SHALL ler `atr_simulacoes` para calibração.
8. WHEN `atr_medicoes` não existe (`PGRST205`) THEN o endpoint SHALL tratar como zero medições e calibrar com o setor; qualquer outro erro do banco SHALL virar erro HTTP 500 (propagado).
9. The resposta de `/api/atr/simulate` SHALL incluir `calibracao`, `meses_usados` e `aviso`, além dos campos atuais.

**Independent Test**: `test_atr.py` gera 24 meses com coeficientes conhecidos, semente fixa e ruído; verifica que o valor verdadeiro cai dentro do IC 95% de `cov` (ou tolerância absoluta); com 11 meses devolve o setor; com coluna de chuva constante devolve o setor com aviso; `predict_atr` bate com `statsmodels.get_prediction` (`obs_ci`).

### P1: Histórico sem vazamento ⭐ MVP

**User Story**: Como membro de uma usina, quero ver minhas simulações e as compartilhadas, sem ver quem as fez além do necessário.

**Acceptance Criteria**:

1. WHEN `/api/atr/historico` roda THEN o filtro `user_id = eu OR compartilhado = true` SHALL ser aplicado na query, antes de `limit`.
2. The resposta SHALL NOT conter `user_id`; cada item SHALL trazer `minha: bool`.
3. The tela de ATR SHALL usar `minha` para decidir se mostra o botão de compartilhar.

**Independent Test**: com um fake de Supabase que registra os filtros, a query de `atr_historico` contém o `or` e nenhuma linha de terceiros não compartilhada aparece na resposta; o campo `user_id` não está em nenhum item.

### P2: Aviso na tela

**User Story**: Como usuário da tela de ATR, quero saber quando o número foi calculado com referência do setor.

**Acceptance Criteria**:

1. WHEN a resposta traz `calibracao: "setor"` THEN a tela SHALL mostrar o `aviso` do backend abaixo do resultado.
2. WHEN a resposta traz `calibracao: "usina"` THEN a tela SHALL mostrar "Calibrado com <n> meses medidos da usina".

**Independent Test**: simular com a tabela ausente mostra o aviso; (com a tabela presente, o que for validado quando `atr-dados-reais` existir).

---

## Edge Cases

- IF uma linha de `atr_medicoes` tem algum dos quatro valores usados nulo (atr, vegetal, mineral, precipitação) THEN a linha SHALL ser ignorada na calibração, não derrubar o cálculo.
- IF `volume_moagem` é informado THEN `producao_total` SHALL ser calculado como hoje, com `atr_esperado`.
- IF `atr_esperado - margem` é negativo THEN `atr_min` SHALL ser 0 (comportamento atual preservado).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| ATRC-01 | P1: calibrate_atr devolve sigma, cov, gl, calibracao, aviso | - | Pending |
| ATRC-02 | P1: mínimo de 12 meses | - | Pending |
| ATRC-03 | P1: colinearidade por variância nula e correlação | - | Pending |
| ATRC-04 | P1: predict_atr com intervalo de previsão t | - | Pending |
| ATRC-05 | P1: predict_atr fallback do setor | - | Pending |
| ATRC-06 | P1: endpoint calibra só com atr_medicoes, tabela ausente = setor | - | Pending |
| ATRC-07 | P1: resposta traz calibracao, meses_usados, aviso | - | Pending |
| ATRC-08 | P1: histórico filtra na query e não expõe user_id | - | Pending |
| ATRC-09 | P2: aviso e indicação na tela | - | Pending |

**Coverage:** 9 total, 0 mapeados.

## Success Criteria

- [ ] `pytest tests -q` passa, incluindo os testes de `test_atr.py` e de `atr_historico`.
- [ ] Sem `atr_medicoes`, a tela de ATR mostra o aviso "Usando coeficientes padrão; lance dados reais de ATR." (constante `AVISO_SETOR` no backend, única fonte do texto).
- [ ] Nenhum caminho de código lê `atr_simulacoes` para calibrar.
