# Regressão do açúcar com métricas honestas — Especificação

## Problem Statement

A regressão do açúcar treina com cerca de 11 anos de dados (um ponto por ano) e 7 variáveis. Com tão poucos pontos o modelo decora o passado: o R² mostrado é calculado nos próprios dados de treino e parece excelente, e a faixa "mínimo–máximo" (±1,96 × desvio dos resíduos de treino) fica estreita demais. O usuário recebe uma previsão com aparência de precisão que o modelo não tem.

Auditoria adicional do módulo (`backend/regression.py`):

- `estoque_uso_pct` é `estoque_final / demanda`: colinear por construção com as outras duas. Duplica informação e instabiliza os coeficientes.
- `RidgeCV` roda sem padronizar as variáveis, então o `alpha` depende da escala (¢/lb, milhões de toneladas, R$/US$ misturados).
- O ano civil (fechamento de 31/12) não coincide com o ano-safra da USDA (out–set).
- `inputs.get(col, 0)` zera variável em silêncio no dólar; no açúcar um campo faltando já é erro, mas o caminho do dólar não.

## Goals

- [ ] O número de qualidade mostrado mede acerto em anos que o modelo não viu.
- [ ] A faixa da previsão reflete esse erro fora da amostra.
- [ ] A tela diz, em português, quanto confiar na previsão e compara com um chute simples ("ano anterior").
- [ ] Os coeficientes param de depender da escala das variáveis e de uma variável derivada.

## Out of Scope

| Item | Motivo |
|------|--------|
| Novos dados (mensais, outros países, clima) | Muda o modelo; seria outra feature. |
| Mudar o alinhamento de preço para ano-safra | Documentado abaixo; alinhar exige dado de preço fora do cache e muda o histórico inteiro. Fica como dívida registrada. |
| Remover o XGBoost | Decisão de produto; aqui ele só passa a ser avaliado do mesmo jeito. |
| Regressão do dólar | Tratada em `regressao-dolar-cenario`. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Método de avaliação | Validação deixando um ano de fora (leave-one-out) | Com ~11 pontos é o único método que usa todos os dados. Limitação: o treino de cada dobra usa anos posteriores ao ano testado (vazamento temporal leve). Por isso o resultado é **otimista**; o baseline "ano anterior" serve de contraste. | n |
| Métrica principal | Erro médio fora da amostra em ¢/lb (RMSE LOO) e R² LOO | Erro em ¢/lb é o que o usuário entende | n |
| Faixa da previsão | Previsão ± 1,645 × RMSE LOO (≈90%) | Coerente com a métrica mostrada. Não é garantia de cobertura: com 11 pontos é uma faixa indicativa. | n |
| Classificação de confiança | "Baixa" se R² LOO < 0,3 **ou** se RMSE LOO (anos 2..n) ≥ RMSE "ano anterior"; "Moderada" se 0,3–0,6; "Boa" se > 0,6 | Faixas simples. O R² mede contra a média, mas preço é autocorrelacionado: a regra do baseline impede dizer "boa" quando o chute do ano anterior é melhor. | n |
| Baseline | "Ano anterior": prever o preço de cada ano pelo preço do ano anterior real. RMSE calculado nos mesmos anos do modelo (exceto o primeiro). | Chute ingênuo que qualquer modelo precisa bater | n |
| R² de treino | Some da tela; continua no JSON como `r2_treino` | Não engana o usuário e não quebra quem lê o histórico | n |
| Variável derivada | `estoque_uso_pct` sai do modelo, do formulário e do request | É a razão `estoque_final / demanda`: quase colinear com as duas. Remover uma das três, como pedido. Alternativa do advisor (tirar `estoque_final` e `demanda` e manter a razão) não adotada: mudaria mais variáveis do que a tarefa pede. Redundância `estoque_inicial[Y] = estoque_final[Y−1]` nos dados fica registrada como dívida. | n |
| Padronização | `Pipeline(StandardScaler, modelo)` para Ridge e XGBoost | Ridge fica independente da escala; árvores não se importam, então é uniforme | n |
| Alinhamento ano-safra | Não alterado. Preço = fechamento de 31/12 do ano civil; USDA `year` Y = safra Y/Y+1 (out–set). O fechamento de 31/12/Y cai no 3º mês da safra Y/Y+1, e o preço já embute a expectativa dela. O problema real é de **informação**: os números finais da USDA são revisados e não existiam em dezembro, então o modelo olha para o futuro. Registrado aqui. | Ver Out of Scope | n |
| Previsão | `sb_f_previsto` é o preço do ano-safra informado; `usdbrl` e `cl_f` são premissas de fim desse ano. | Resposta ao advisor | n |
| Input ausente | Erro 422 "Campo obrigatório ausente: <nome>." em vez de zerar | Silêncio gera previsão errada | n |

**Open questions:** o alinhamento ano-safra fica para outra feature; o usuário pode pedir.

---

## User Stories

### P1: Métrica fora da amostra ⭐ MVP

**User Story**: Como analista, quero saber o quanto o modelo erra em anos que não viu.

**Acceptance Criteria**:

1. WHEN `/api/regression/acucar/run` roda THEN o backend SHALL calcular `r2_loo` e `rmse_loo` por validação leave-one-out.
2. The resposta SHALL incluir `r2_loo`, `rmse_loo`, `rmse_ano_anterior`, `r2_treino`, `n_anos` e `confianca` ("Baixa", "Moderada" ou "Boa"), além de `sb_f_previsto`, `sb_f_min`, `sb_f_max`, `historico` e `ultimo_dado`.
3. The `sb_f_min` e `sb_f_max` SHALL ser `sb_f_previsto ∓ 1,645 × rmse_loo`.
4. The tela SHALL mostrar a previsão, a faixa, o erro médio fora da amostra em ¢/lb, o erro do chute "ano anterior" e a confiança; e SHALL não mostrar `r2_treino`.
5. WHEN a confiança é "Baixa" THEN a tela SHALL mostrar o aviso "Com <n_anos> anos de histórico, esta previsão é só indicativa. Use junto com outras análises."
6. The `historico` SHALL trazer `sb_f_previsto_fora_amostra` (predição LOO de cada ano), não a predição in-sample.

**Independent Test**: dados sintéticos com y ruído puro: `r2_loo` < 0,3 e `confianca` = "Baixa"; com y linear em uma variável (ruído pequeno): `r2_loo` > 0,9.

### P2: Modelo sem variável colinear e com escala tratada

**User Story**: Como analista, quero que o modelo não mude de resposta só porque a unidade de uma variável mudou.

**Acceptance Criteria**:

1. The modelo SHALL ser `Pipeline(StandardScaler(), RidgeCV(alphas=[0.1, 1, 10, 100]))` ou `Pipeline(StandardScaler(), XGBRegressor)`.
2. The `feature_cols` SHALL não incluir `estoque_uso_pct`; o request `AcucarRunRequest` SHALL não exigir esse campo, e o formulário SHALL não pedi-lo.
3. WHEN um campo de entrada obrigatório falta THEN o backend SHALL responder 422 com "Campo obrigatório ausente: <nome>.".

---

## Edge Cases

- IF o histórico tem menos de 6 anos THEN o endpoint SHALL responder 422 com "Histórico insuficiente para estimar o preço (mínimo de 6 anos)."
- WHEN `r2_loo` é negativo THEN a tela SHALL mostrar confiança "Baixa" e não SHALL exibir o R² negativo (mostra "sem poder preditivo").
- IF `sb_f_min` é negativo THEN a tela SHALL mostrar 0 como limite inferior.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| REG-01 | P1: Métrica fora da amostra (cálculo LOO) | Tasks | Pending |
| REG-02 | P1: Métrica fora da amostra (faixa e baseline) | Tasks | Pending |
| REG-03 | P1: Métrica fora da amostra (tela e aviso) | Tasks | Pending |
| REG-04 | P2: Pipeline com StandardScaler | Tasks | Pending |
| REG-05 | P2: Remove `estoque_uso_pct` do modelo, request e form | Tasks | Pending |
| REG-06 | P2: Campo ausente vira erro explícito | Tasks | Pending |

**Coverage:** 6 total, 0 mapeados (Tasks pendentes).

## Success Criteria

- [ ] Nenhum número de qualidade na tela é calculado com os dados de treino.
- [ ] Teste com ruído puro dá R² LOO < 0,3 (pytest).
- [ ] Trocar a unidade de uma variável não muda a previsão (pytest).
