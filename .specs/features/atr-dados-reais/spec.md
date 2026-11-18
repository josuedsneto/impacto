# ATR com dados reais — Especificação

## Problem Statement

O simulador de ATR "calibra" o modelo de cada usina com as simulações anteriores dela, tratando o ATR **previsto** como se fosse o ATR **medido** (`atr_simulacoes.atr_esperado` vira `atr_real` em `main.py`). Depois de 5 simulações o modelo só reproduz a si mesmo e nunca aprende com a realidade. A usina tem o dado real — `Historico Impurezas.xlsx` traz ~58 meses (safras 15/16 a 23/24) com impureza vegetal, impureza mineral, ATR, pureza e precipitação — mas o app não tem onde guardá-lo. Decisão AD-003: o dado real entra por upload de planilha e por formulário mensal.

## Goals

- [ ] O modelo de cada usina é calibrado só com ATR medido.
- [ ] A usina carrega o histórico em uma única importação de planilha.
- [ ] A usina lança cada mês novo em menos de 1 minuto.
- [ ] A tela diz com quantos meses reais o modelo foi calibrado.

## Out of Scope

| Item | Motivo |
|------|--------|
| Integração automática com sistemas da usina (laboratório, ERP) | Não pedida; upload + formulário resolvem. |
| Usar pureza no modelo | O modelo atual usa chuva e impureza; mudar variáveis é outra decisão de modelagem. A pureza é guardada para uso futuro. |
| Dados diários ou por talhão | A planilha é mensal; o modelo é mensal. |
| Excluir histórico em massa | Exclusão é linha a linha (edge case abaixo); evita perda acidental. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Quem pode lançar e importar | Qualquer usuário associado à usina (`user_usinas`) e admins | A usina é dona do próprio dado; admin ajuda na carga inicial | n |
| Impureza usada no modelo | Impureza total = vegetal + mineral (%) | O modelo atual tem uma variável de impureza; os dois componentes são guardados separados | n |
| Meses sem precipitação | Guardados, mas fora da calibração | O modelo precisa das duas variáveis | n |
| Mínimo para calibrar | 12 meses com chuva e impureza; abaixo disso usa os coeficientes do setor e avisa | 5 pontos (regra atual) é pouco para 3 coeficientes com sazonalidade | n |
| Mês já existente na importação | Sobrescreve o valor (upsert por usina + safra + mês) e a tela de prévia mostra quantos serão atualizados | Corrigir dado é o caso comum; prévia evita surpresa | n |
| Formato do arquivo | `.xlsx` ou `.csv` com as colunas de `Historico Impurezas.xlsx`: Safra, Mês, Impureza Vegetal, Impureza Mineral, ATR, Pureza, Precipitação | É o formato que a usina já usa | n |
| Onde o arquivo é lido | No backend (`openpyxl`), não no navegador | Validação num lugar só; o front só mostra a prévia retornada | n |
| Carga inicial | O admin importa `Historico Impurezas.xlsx` para a usina correta pela própria tela de importação | A planilha não diz a qual usina pertence | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Modelo calibrado só com dado medido ⭐ MVP

**User Story**: Como gestor agrícola, quero que a previsão de ATR aprenda com o que a usina mediu.

**Acceptance Criteria**:

1. The banco SHALL ter a tabela `atr_medicoes` (usina, safra, mês, impureza vegetal %, impureza mineral %, ATR kg/t, pureza %, precipitação mm, quem lançou, quando) com unicidade em usina + safra + mês.
2. WHEN `/api/atr/simulate` roda THEN o backend SHALL calibrar o modelo só com linhas de `atr_medicoes` da usina que têm ATR, impureza e precipitação.
3. The backend SHALL não usar `atr_simulacoes` como dado de calibração.
4. IF a usina tem menos de 12 meses válidos THEN o backend SHALL usar os coeficientes do setor e a resposta SHALL incluir `calibracao: "setor"` e `meses_usados`.
5. WHEN a usina tem 12 meses válidos ou mais THEN a resposta SHALL incluir `calibracao: "usina"` e `meses_usados`.
6. The tela de ATR SHALL mostrar "Calibrado com <n> meses medidos da usina" ou "Usando referência do setor — lance pelo menos 12 meses medidos para calibrar com dados da usina."

**Independent Test**: teste de `calibrate_atr` com 24 meses sintéticos gerados por coeficientes conhecidos recupera os coeficientes (±5%); com 11 meses devolve os do setor.

### P1: Importar o histórico por planilha ⭐ MVP

**User Story**: Como responsável pelo laboratório, quero subir a planilha que já tenho e ver o que vai entrar antes de confirmar.

**Acceptance Criteria**:

1. WHEN o usuário envia um arquivo em "Importar histórico" THEN o backend SHALL validar e devolver uma prévia com: linhas válidas, linhas que vão atualizar meses existentes, e linhas com erro (número da linha + motivo), sem gravar nada.
2. WHEN o usuário confirma a prévia THEN o backend SHALL gravar as linhas válidas numa única operação e o app SHALL mostrar "<n> meses importados (<m> atualizados)."
3. IF o arquivo não tem as colunas Safra, Mês, Impureza Vegetal, Impureza Mineral e ATR THEN o backend SHALL recusar com "A planilha precisa das colunas: Safra, Mês, Impureza Vegetal, Impureza Mineral, ATR."
4. IF uma linha tem safra fora do formato "AA/AA", mês que não é nome de mês em português, ou número fora dos limites (impureza 0–100, ATR 50–250, precipitação 0–1000) THEN a linha SHALL entrar na lista de erros com o motivo e não SHALL ser gravada.
5. IF o arquivo tem mais de 2 MB ou mais de 1.000 linhas THEN o backend SHALL recusar com "Arquivo grande demais (máximo 2 MB / 1.000 linhas)."
6. The aceitação de nome de mês SHALL ignorar acentos e maiúsculas ("Marco", "março", "MARÇO" são o mesmo mês).

**Independent Test**: importar `Historico Impurezas.xlsx`: prévia lista ~58 linhas válidas e 0 erros; confirmar; reimportar: prévia mostra todas como "atualizar".

### P1: Lançar o mês ⭐ MVP

**User Story**: Como responsável pelo laboratório, quero lançar o fechamento do mês num formulário curto.

**Acceptance Criteria**:

1. The tela de ATR SHALL ter o formulário "Lançar mês medido" com: safra, mês, impureza vegetal (%), impureza mineral (%), ATR (kg/t), pureza (%, opcional), precipitação (mm).
2. WHEN o formulário abre THEN safra e mês SHALL vir preenchidos com o mês anterior ao atual.
3. WHEN o usuário salva THEN o app SHALL mostrar o toast "<Mês>/<safra> salvo" e o mês SHALL aparecer na tabela de medições.
4. IF o mês já existe THEN o app SHALL pedir confirmação "Já existe medição para <mês>/<safra>. Substituir?" antes de gravar.
5. IF o usuário não está associado à usina THEN o backend SHALL responder 403 com "Você não tem acesso a esta usina."

**Independent Test**: lançar um mês novo, ver na tabela; lançar o mesmo mês, ver a confirmação.

### P2: Ver e corrigir medições

**User Story**: Como usuário da usina, quero ver as medições lançadas e corrigir um mês errado.

**Acceptance Criteria**:

1. The tela de ATR SHALL ter a aba "Medições" com tabela por safra e mês, do mais recente ao mais antigo.
2. WHEN o usuário clica em "Editar" numa linha THEN o app SHALL abrir o formulário preenchido com aquele mês.
3. WHEN o usuário clica em "Excluir" numa linha e confirma THEN o backend SHALL apagar só aquele mês.
4. The tabela SHALL ter o botão "Exportar CSV" (padrão da feature `exportar-csv`).

**Independent Test**: editar o ATR de um mês e ver a mudança; excluir um mês e ver que sumiu.

---

## Edge Cases

- IF duas pessoas lançam o mesmo mês ao mesmo tempo THEN o banco SHALL manter uma única linha (restrição de unicidade) e a última gravação vence.
- WHEN a usina é excluída pelo admin THEN as medições dela SHALL ser excluídas junto (`ON DELETE CASCADE`).
- IF a planilha tem a mesma safra + mês duas vezes THEN a segunda ocorrência SHALL entrar na lista de erros como "Mês repetido no arquivo (linha <n>)".
- The histórico atual de `atr_simulacoes` SHALL continuar visível como histórico de simulações; só deixa de ser usado para calibrar.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| ATRD-01 | P1: Modelo calibrado (tabela atr_medicoes + RLS) | - | Pending |
| ATRD-02 | P1: Modelo calibrado (calibração só com medições, mínimo 12) | - | Pending |
| ATRD-03 | P1: Modelo calibrado (indicação na tela) | - | Pending |
| ATRD-04 | P1: Importar (prévia + validação) | - | Pending |
| ATRD-05 | P1: Importar (confirmação + limites) | - | Pending |
| ATRD-06 | P1: Lançar o mês | - | Pending |
| ATRD-07 | P2: Ver e corrigir medições | - | Pending |

**Coverage:** 7 total, 0 mapeados (Complex: precisa de design.md — schema, RLS, endpoints — e tasks.md).

## Success Criteria

- [ ] Após importar `Historico Impurezas.xlsx`, a simulação da usina mostra "Calibrado com N meses medidos" com N ≥ 12.
- [ ] Lançar um mês leva menos de 1 minuto.
