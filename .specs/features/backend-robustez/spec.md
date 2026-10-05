# Robustez do backend — Especificação

## Problem Statement

Pontos menores da auditoria que geram erro 500 ou números desatualizados: a lista de usuários do admin só traz a primeira página do Supabase Auth; parâmetros de indicadores técnicos não têm limites (período 0 derruba a requisição); constantes de negócio (fator de conversão de Metas, custos fixos de Risco e Cenários) estão fixas no código; e o mapa de calor de Metas usa faixas de preço fixas (dólar 4,80–5,25) que já não cobrem o mercado.

## Goals

- [ ] Nenhuma entrada do usuário gera erro 500.
- [ ] O admin altera as constantes de negócio sem deploy.
- [ ] O mapa de calor de Metas sempre contém o preço atual.

## Out of Scope

| Item | Motivo |
|------|--------|
| Limitador de requisições compartilhado entre workers (Redis) | Com 20–100 usuários internos, o limite por worker basta. Registrado como dívida. |
| Revisar as fórmulas de Risco e Cenários | São regras de negócio da usina; aqui só saem do código para a configuração. |
| Cache de notícias compartilhado entre workers | Mesmo motivo do limitador. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Onde ficam as constantes | Tabela `admin_config` existente, uma chave por constante, com descrição em português | Já existe tela de admin para ela | y |
| Valores iniciais | Os valores hoje no código, gravados por migração | Comportamento não muda no dia da troca | y |
| Limites dos indicadores | Períodos inteiros de 2 a 250; desvios do Bollinger de 0,5 a 5; até 5 médias SMA/EMA | Cobrem qualquer uso prático | n |
| Faixas do mapa de calor | Centro no último fechamento: açúcar ±25% em 11 passos; dólar ±10% em 10 passos | Sempre inclui o preço atual | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Entradas inválidas viram mensagem, não erro 500 ⭐ MVP

**User Story**: Como usuário, quando digito um parâmetro fora do normal, quero saber o que corrigir.

**Acceptance Criteria**:

1. IF `/api/market/analysis` recebe período fora de 2–250, desvio do Bollinger fora de 0,5–5 ou mais de 5 médias THEN o backend SHALL responder 422 com "<parâmetro> deve estar entre <mín> e <máx>."
2. IF MACD rápido ≥ MACD lento THEN o backend SHALL responder 422 com "O MACD rápido deve ser menor que o lento."
3. The backend SHALL ter um handler que transforma qualquer exceção não tratada em 500 com "Erro inesperado. A equipe foi notificada." e registra o traceback no log.

**Independent Test**: chamadas com `sma_periods=0`, `rsi_period=-1`, `macd_fast=30&macd_slow=26` respondem 422 com a mensagem.

### P1: Lista completa de usuários no admin ⭐ MVP

**User Story**: Como admin, quero associar qualquer usuário a uma usina.

**Acceptance Criteria**:

1. WHEN `/api/admin/usuarios` é chamado THEN o backend SHALL percorrer todas as páginas do Supabase Auth e retornar todos os usuários ordenados por e-mail.

**Independent Test**: com o cliente simulado retornando 3 páginas, a resposta contém a soma das 3.

### P2: Constantes de negócio configuráveis

**User Story**: Como admin, quero atualizar fatores e custos da usina sem pedir deploy.

**Acceptance Criteria**:

1. The constantes usadas em `/api/metas`, `/api/risco` e `/api/cenarios` SHALL ser lidas de `admin_config`.
2. WHEN uma constante não existe em `admin_config` THEN o backend SHALL usar o valor atual do código e registrar um aviso no log.
3. IF o valor salvo não é número THEN `PUT /api/admin/config/{key}` SHALL responder 422 com "O valor de <chave> precisa ser numérico."
4. The tela de admin SHALL mostrar cada constante com nome e descrição em português.

**Independent Test**: alterar o fator de Metas no admin e ver o MTM mudar na mesma proporção.

### P2: Mapa de calor de Metas sempre atual

**User Story**: Como trader, quero o mapa de calor em torno do preço de hoje.

**Acceptance Criteria**:

1. WHEN `/api/metas` roda THEN as faixas de açúcar e dólar SHALL ser centradas no último fechamento de SB=F e USDBRL=X com as amplitudes definidas em Assumptions.
2. The célula correspondente ao preço atual SHALL ser destacada na tela.

**Independent Test**: com fechamentos simulados de 18,00 ¢/lb e R$ 5,60, as faixas contêm esses valores e a célula central é destacada.

---

## Edge Cases

- IF não há fechamento recente de SB=F ou USDBRL=X THEN `/api/metas` SHALL responder 503 com "Sem preços recentes para montar o mapa de metas."

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| HARD-01 | P1: Entradas inválidas (validação de indicadores) | - | Pending |
| HARD-02 | P1: Entradas inválidas (handler global) | - | Pending |
| HARD-03 | P1: Lista completa de usuários | - | Pending |
| HARD-04 | P2: Constantes configuráveis | - | Pending |
| HARD-05 | P2: Mapa de calor atual | - | Pending |

**Coverage:** 5 total, 0 mapeados (Medium).

## Success Criteria

- [ ] Zero erro 500 nos logs causado por parâmetro de usuário.
