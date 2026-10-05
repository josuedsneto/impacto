# Regressão do açúcar com métricas honestas — Especificação

## Problem Statement

A regressão do açúcar treina com cerca de 11 anos de dados (um ponto por ano) e 7 variáveis. Com tão poucos pontos o modelo decora o passado: o R² mostrado é calculado nos próprios dados de treino e parece excelente, e a faixa "mínimo–máximo" (±1,96 × desvio dos resíduos de treino) fica estreita demais. O usuário recebe uma previsão com aparência de precisão que o modelo não tem.

## Goals

- [ ] O número de qualidade mostrado mede acerto em anos que o modelo não viu.
- [ ] A faixa da previsão reflete esse erro fora da amostra.
- [ ] A tela diz, em português, quanto confiar na previsão.

## Out of Scope

| Item | Motivo |
|------|--------|
| Novos dados (mensais, outros países, clima) | Muda o modelo; seria outra feature. |
| Regressão do dólar | Tem 72 pontos mensais; problema bem menor. Fica como está. |
| Remover o XGBoost | Decisão de produto; aqui ele só passa a ser avaliado do mesmo jeito. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Método de avaliação | Validação deixando um ano de fora (leave-one-out) | Com ~11 pontos é o único método que usa todos os dados | n |
| Métrica principal | Erro médio fora da amostra em ¢/lb (RMSE LOO) e R² LOO | Erro em ¢/lb é o que o usuário entende | n |
| Faixa da previsão | Previsão ± 1,645 × RMSE LOO (≈90%) | Coerente com a métrica mostrada | n |
| Classificação de confiança | "Baixa" se R² LOO < 0,3; "Moderada" se 0,3–0,6; "Boa" se > 0,6 | Faixas simples, revisáveis | n |
| R² de treino | Some da tela; continua no JSON como `r2_treino` | Não engana o usuário e não quebra quem lê o histórico | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Métrica fora da amostra ⭐ MVP

**User Story**: Como analista, quero saber o quanto o modelo erra em anos que não viu.

**Acceptance Criteria**:

1. WHEN `/api/regression/acucar/run` roda THEN o backend SHALL calcular `r2_loo` e `rmse_loo` por validação leave-one-out.
2. The resposta SHALL incluir `r2_loo`, `rmse_loo`, `r2_treino`, `n_anos` e `confianca` ("Baixa", "Moderada" ou "Boa").
3. The `sb_f_min` e `sb_f_max` SHALL ser `sb_f_previsto ∓ 1,645 × rmse_loo`.
4. The tela SHALL mostrar a previsão, a faixa, o erro médio em ¢/lb e a confiança; e SHALL não mostrar `r2_treino`.
5. WHEN a confiança é "Baixa" THEN a tela SHALL mostrar o aviso "Com <n_anos> anos de histórico, esta previsão é só indicativa. Use junto com outras análises."

**Independent Test**: teste com dados sintéticos onde y é ruído puro: `r2_loo` fica abaixo de 0,3 e `confianca` = "Baixa"; com y linear em uma variável: `r2_loo` acima de 0,9.

---

## Edge Cases

- IF o histórico tem menos de 6 anos THEN o endpoint SHALL responder 422 com "Histórico insuficiente para estimar o preço (mínimo de 6 anos)."
- WHEN `r2_loo` é negativo THEN a tela SHALL mostrar confiança "Baixa" e não SHALL exibir o R² negativo.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| REG-01 | P1: Métrica fora da amostra (cálculo LOO) | - | Pending |
| REG-02 | P1: Métrica fora da amostra (faixa) | - | Pending |
| REG-03 | P1: Métrica fora da amostra (tela e aviso) | - | Pending |

**Coverage:** 3 total, 0 mapeados (Medium).

## Success Criteria

- [ ] Nenhum número de qualidade na tela é calculado com os dados de treino.
