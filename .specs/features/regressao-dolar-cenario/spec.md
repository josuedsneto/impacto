# Modelo do dólar: despriorizado, com avaliação honesta — Especificação

## Problem Statement

`run_dolar_regression` (`backend/regression.py`) faz OLS em **níveis** de séries não estacionárias (USD/BRL, M2, produção industrial, Selic, Fed funds) e mostra o R² de treino. Níveis com tendência dão R² alto por coincidência (regressão espúria). Além disso, a tela sugere que o modelo "prevê" o dólar a partir de juros e moeda, o que o modelo não faz: a relação entre juros e câmbio no mês não tem sinal causal confiável (o BCB sobe a Selic quando o real se desvaloriza), então o número seria lido como efeito que não existe.

A previsão do dólar é da tela **Câmbio** (thread `cambio-previsao`).

## Decisão

**Opção (b): despriorizar.** A tela sai do menu. A rota continua acessível por URL, com aviso e link para Câmbio. A tela não é apagada: remover código é outra decisão, e o usuário pode pedir depois.

Descartada: (a) "Cenário macro" com variações mensais. O advisor Opus apontou que uma OLS de variações do câmbio contra variações de juros no mesmo mês não responde "se a Selic for X": o β sai com sinal invertido e a tela ensinaria uma relação causal falsa. O banner não corrige isso. Cointegração também fica de fora.

## Goals

- [ ] A tela não aparece no menu.
- [ ] Qualquer número mostrado vem com a métrica fora da amostra e a comparação com o random walk.
- [ ] Um aviso claro diz que o resultado não é previsão quando o modelo não supera o random walk.
- [ ] A tela aponta para Câmbio.
- [ ] Mês corrente parcial não entra nas séries.
- [ ] Campo ausente vira erro explícito, não zero.

## Out of Scope

| Item | Motivo |
|------|--------|
| Apagar a tela e o código | Decisão de produto, fica para depois. |
| Cointegração (Engle-Granger, VECM) | Outra feature, e ainda sem relação causal defensável. |
| Previsão probabilística | Feita pela tela Câmbio. |
| Mudar BCB, FRED ou cache | Não muda, só o tratamento. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Opção | (b) despriorizar | Ver Decisão | n (advisor Opus recomendou) |
| Modelo | Mantido: OLS em níveis, com os seis campos | Mudar o modelo é outra feature | n |
| Walk-forward | Previsão de um passo, janela expansiva, a partir da 36ª observação de **nível** (treino inicial = primeiras 36 observações) | Série temporal: não embaralha | n |
| Métrica fora da amostra | `r2_fora_amostra = 1 − SSE_modelo / SSE_random_walk`, em **log** do nível. Random walk = último nível observado. | Erro em log: comparável entre níveis; o R² sobre o nível seria inflado pela tendência | n |
| Cenário realizado | O X do mês previsto é o realizado. A métrica mede ajuste dado o cenário macro, não previsão pura das variáveis macro. | Texto no código e aqui | n |
| Superação | `supera_random_walk` = `r2_fora_amostra > 0` **e** `n_previsoes ≥ 24` | Poucas previsões não sustentam a afirmação | n |
| Aviso | Quando `supera_random_walk` é false: "Neste histórico o modelo não erra menos que supor que o câmbio fica parado. Trate o resultado como cenário, não como previsão." | Honestidade | n |
| Base da previsão | `taxa_atual` = última linha do DataFrame já mesclado (não o último mês do câmbio), porque M2 e produção saem com 1 a 2 meses de defasagem | Consistência entre séries | n |
| Mês parcial | `_so_meses_fechados` filtra `índice < 1º dia do mês corrente` em BCB, FRED e cache. `resample("ME")` cria o grupo do mês parcial, então o filtro é explícito. | Ver regras em `regression.py` | n |
| Correlação e R² de treino | Saem da tela e da resposta | Correlação de níveis é a origem da espúria | n |
| Campo ausente | 422 "Campo obrigatório ausente: <nome>." | Igual ao açúcar | n |
| Link para Câmbio | `/app/cambio`. A rota é da thread `cambio-previsao`, que não está nesta branch: o link fica quebrado até o merge. | Pedido de spec | n |

**Open questions:** o link para Câmbio depende do merge da thread `cambio-previsao`.

---

## User Stories

### P1: Tela despriorizada com avaliação fora da amostra ⭐ MVP

**Acceptance Criteria**:

1. The `NavLinks` SHALL não ter a entrada "Modelo do dólar".
2. WHEN `/api/regression/dolar/run` roda THEN a resposta SHALL incluir `taxa_atual`, `taxa_prevista`, `r2_fora_amostra`, `rmse_fora_amostra`, `supera_random_walk`, `n_previsoes`, `coeficientes` e `ultimo_dado`, e NÃO SHALL incluir `r2`, `rmse` nem `correlacao`.
3. WHEN `supera_random_walk` é false THEN a tela SHALL mostrar o aviso da tabela de Assumptions.
4. The tela SHALL conter o link "Para a previsão do dólar, veja Câmbio."
5. The tela SHALL não mostrar o heatmap de correlação.

**Independent Test**: passeio aleatório sintético → `supera_random_walk` = false; `Y` linear em `X` → `r2_fora_amostra` > 0,5 e `supera_random_walk` = true; 14 previsões → `supera_random_walk` = false mesmo com R² alto.

### P2: Entradas e mês parcial

**Acceptance Criteria**:

1. WHEN o mês corrente não fechou THEN ele SHALL ficar de fora de BCB, FRED e cache.
2. WHEN um dos campos do modelo falta THEN o backend SHALL responder 422 "Campo obrigatório ausente: <nome>.".

---

## Edge Cases

- IF há menos de 36 observações de nível THEN `r2_fora_amostra` SHALL ser null e `supera_random_walk` false.
- IF `r2_fora_amostra` é negativo THEN a tela SHALL mostrar "sem poder preditivo" no lugar do número.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| DOL-01 | P1: Remove do menu e mantém rota com aviso e link | Tasks | Done (implementação) |
| DOL-02 | P1: Métrica walk-forward vs random walk e superação | Tasks | Done (implementação) |
| DOL-03 | P1: Resposta sem r2 de treino e sem correlação | Tasks | Done (implementação) |
| DOL-04 | P2: Campo ausente vira erro explícito | Tasks | Done (implementação) |
| DOL-05 | P2: Mês corrente parcial fora das séries | Tasks | Done (implementação) |

**Coverage:** 5 total, 5 implementados (testes em `backend/tests/test_regression_dolar.py`).

## Success Criteria

- [ ] Passeio aleatório sintético não aparece como "supera random walk" (pytest).
- [ ] Nenhum número de qualidade é calculado com dados de treino.
- [ ] A tela não aparece no menu; o link para Câmbio existe.
