# Spec: pendencias-pequenas

## Problem Statement

Cinco pendências documentadas nos `validation.md` da rodada anterior ficaram abertas:
a análise de hedge não restaura os campos ao ser reaberta; o import em lote de posições
responde 422 genérico; o heatmap de Metas (CAM-09) não tem teste; o status do pregão do
açúcar ignora os feriados da ICE; e o mínimo de cenários do MC Pricer difere entre
frontend (100) e API (1).

## Goals

- Reabrir uma análise de hedge preenche os campos da tela com os valores salvos.
- Um 422 do lote de posições diz a linha e o campo, em português, na tela.
- Um teste pelo `TestClient` garante que o centro dos eixos de `/api/metas` é o último fechamento.
- `estado_pregao` responde CLOSED nos feriados da ICE Futures US para o açúcar nº 11 (2026 e 2027).
- A API recusa menos de 100 cenários no MC Pricer, como o frontend.

## Out of Scope

- Divisão do `main.py` em routers (outra thread).
- Handler global de `RequestValidationError` (fica para depois).
- Calendário de early close da ICE (só feriados fechados).
- Feriados de 2028 em diante.
- Mudança de visual das telas (só texto de erro e campos preenchidos).

## Assumptions

- A lista de feriados de 2026 vem do PDF oficial da ICE Futures U.S. ("2026 Trading Holiday
  Calendar", coluna Sugar No. 11 = closed para todos os feriados dos EUA listados).
- O PDF oficial só lista 2026 e 1º de janeiro de 2027. Os demais feriados de 2027 foram
  derivados da mesma regra (feriados federais dos EUA, com Good Friday e Juneteenth; quando
  caem no sábado ou domingo, usa-se a sexta anterior ou a segunda seguinte). Precisa de
  confirmação contra o calendário ICE 2027 quando for publicado.
- O `estado_pregao` continua recebendo `datetime` com timezone; o feriado é checado pela
  data local em Nova York.
- Exceção de ano novo: 1º/jan/2028 cai num sábado e a bolsa não fecha em 31/dez/2027 (fora do escopo, 2028 não está na lista).
- Advisor (Opus) revisou esta spec e apontou a Good Friday de 2027 (26/03, Páscoa em 28/03), corrigida na lista e coberta por teste de regressão.

## User Stories

### P1: Reabrir análise de hedge restaura os campos

**Requisitos**

- **PEN-01** WHEN o usuário abre uma análise salva de `hedge_cambial` pelo link THEN a tela preenche volume, prazo, orçamento, percentual, strike da put, K1 e K2 com os valores salvos.
- **PEN-02** O padrão de spot/forward (strikes = spot × 0,95 / 1,05) só preenche campo VAZIO. Assim vale nas duas ordens de chegada: se a reabertura vem antes, o padrão não apaga; se vem depois, sobrescreve o padrão. Também não apaga o que o usuário digitou antes da resposta.
- **PEN-03** WHEN a análise salva tem prazo fora de {21, 63, 126}, ou um campo ausente/nulo THEN o campo fica com o valor atual (prazo padrão 63; campo nulo não é aplicado).

### P1: Erro por linha no lote de posições

- **PEN-04** WHEN o lote contém uma linha inválida THEN o 422 traz `detail` string em português com o número da linha (1-based) e o nome do campo, ex.: `Linha 3 (Volume): valor inválido.`. Cada linha é validada com `PosicaoBase.model_validate` em `list[dict]`. Itens que não são objetos caem em `Linha n: registro inválido.`.
- **PEN-05** Critério de aceite manual: a mensagem aparece no toast de erro da tela de posições (o `apiFetch` já mostra `detail` em string).
- **PEN-06** WHEN o lote é válido THEN a resposta 201 não muda. Nada é gravado quando alguma linha falha (tudo ou nada).
- Ordem das checagens: 403 de não-membro vem antes do 422 de linha (a validação de linha roda depois de `_membro`). Erro em `usina_id` ou `safra` continua na lista padrão do FastAPI, sem texto de linha (fora de escopo: handler global).

### P2: Teste do heatmap de Metas (CAM-09)

- **PEN-07** WHEN `/api/metas` é chamado com preços conhecidos THEN `acucares[5]` e `dolares[5]` são o último fechamento de cada série; `acucares` é decrescente e `dolares` é crescente.
- O teste usa só as fixtures de `conftest.py` (Yahoo e Supabase simulados), sem monkeypatch de `main.get_prices`, para continuar válido após a divisão do `main.py`.

### P2: Feriados da ICE no status do pregão

- **PEN-08** WHEN a data local em NY é feriado da lista THEN `estado_pregao` retorna CLOSED mesmo em horário de pregão.
- **PEN-09** WHEN a data não é feriado THEN o comportamento anterior (seg–sex, 03:30–13:00) permanece. Inclui um dia útil comum em horário de pregão (REGULAR) e a sexta antes e a segunda depois de um feriado.
- **PEN-10** A função `estado_pregao` e as constantes de horário saem de `main.py` para `backend/pregao.py`; `main.py` só importa. `main.estado_pregao` continua existindo.

### P3: Mínimo de cenários no MC Pricer

- **PEN-11** WHEN `num_simulacoes` < 100 no `/api/options/mc-price` THEN responde 422.
- **PEN-12** WHEN `num_simulacoes` = 100 THEN responde 200.

## Tasks

Ver `tasks.md`.
