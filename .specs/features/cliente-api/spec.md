# Cliente de API — Especificação

## Problem Statement

Cada tela do frontend repete a mesma função de pegar o token (28 cópias) e monta `fetch` à mão (58 chamadas). Quando a sessão expira, o usuário vê "Erro." ou "Erro de conexão" e não sabe que precisa entrar de novo. Mensagens de erro do backend chegam em inglês ("Invalid ticker format", "Insufficient data...").

## Goals

- [ ] Uma única função para chamar a API no navegador; zero cópias de `getAccessToken`.
- [ ] Sessão expirada leva o usuário ao login com uma mensagem clara, sem perder a página de onde veio.
- [ ] Toda mensagem de erro mostrada ao usuário está em português.

## Out of Scope

| Item | Motivo |
|------|--------|
| Biblioteca de cache de dados (SWR, React Query) | Não há necessidade comprovada; a premissa é simplicidade. |
| Retry automático de chamadas | Simulações não são idempotentes (gravam histórico); retry duplicaria registros. |
| Chamadas server-side (layout e dashboard) | Já leem o token da sessão no servidor; ficam como estão, só ganham timeout padronizado se já não tiverem. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Onde fica a função | `frontend/lib/api.ts`, exportando `apiFetch` | Arquivo já existe e já exporta `API_URL` | y |
| Tempo limite padrão | 30 s; 120 s para rotas pesadas (regressões, ARIMA, simulações) via parâmetro | nginx corta em 120 s | n |
| Tradução das mensagens do backend | O backend passa a responder `detail` em português | Uma fonte de verdade; o front só exibe | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Uma chamada padrão para a API ⭐ MVP

**User Story**: Como desenvolvedor, quero `apiFetch(caminho, opções)` que já envie o token e trate erros, para cada tela ter só a lógica dela.

**Acceptance Criteria**:

1. WHEN `apiFetch` é chamada THEN ela SHALL enviar o header `Authorization: Bearer <token>` da sessão Supabase atual.
2. WHEN a resposta tem status 2xx THEN `apiFetch` SHALL retornar o corpo JSON já convertido.
3. IF a resposta tem status 4xx/5xx diferente de 401 THEN `apiFetch` SHALL lançar um erro cuja mensagem é o `detail` da resposta, ou "Não foi possível concluir a operação. Tente novamente." quando não houver `detail`.
4. IF a requisição falha por rede ou estoura o tempo limite THEN `apiFetch` SHALL lançar um erro com a mensagem "Sem conexão com o servidor. Verifique sua internet e tente novamente."
5. IF `detail` vier como lista (erro de validação 422 do FastAPI) THEN `apiFetch` SHALL usar a mensagem "Algum campo está fora do intervalo permitido." em vez de exibir a lista crua.
6. The código do frontend SHALL não conter nenhuma outra definição de `getAccessToken`/`getToken` além da de `lib/api.ts`.

**Independent Test**: teste unitário de `apiFetch` com `fetch` simulado cobrindo 200, 400 com detail, 422 com lista, 500 sem detail, falha de rede; `grep -rn "getAccessToken\|getToken" app components` retorna só `lib/api.ts`.

### P1: Sessão expirada ⭐ MVP

**User Story**: Como usuário, quando minha sessão expira, quero ser levado ao login e voltar para onde estava.

**Acceptance Criteria**:

1. IF a API responde 401 THEN `apiFetch` SHALL tentar renovar a sessão uma vez e repetir a requisição.
2. IF a renovação falha ou a repetição também responde 401 THEN o app SHALL redirecionar para `/login?expirada=1&voltar=<caminho atual>`.
3. WHEN a tela de login abre com `expirada=1` THEN ela SHALL mostrar "Sua sessão expirou. Entre novamente para continuar."
4. WHEN o login conclui e existe `voltar` THEN o app SHALL abrir esse caminho.
5. IF `voltar` não começa com `/app/` THEN o app SHALL ignorá-lo e abrir `/app/dashboard`.

**Independent Test**: com um token inválido no armazenamento, abrir `/app/var`: cai no login com a mensagem; após entrar, volta para `/app/var`.

### P2: Mensagens do backend em português

**User Story**: Como usuário, quero entender o erro sem saber inglês.

**Acceptance Criteria**:

1. The backend SHALL responder todo `detail` de `HTTPException` em português.
2. WHEN o ticker não tem dados suficientes THEN o backend SHALL responder "Dados insuficientes para <ticker>. Tente outro ativo ou período."

**Independent Test**: `grep -n 'detail="' backend/main.py` não mostra frases em inglês.

---

## Edge Cases

- IF duas chamadas recebem 401 ao mesmo tempo THEN o app SHALL fazer uma única renovação de sessão e um único redirecionamento.
- WHEN o usuário está na tela de login THEN `apiFetch` SHALL não redirecionar de novo para o login.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| API-01 | P1: Uma chamada padrão (token + JSON) | - | Pending |
| API-02 | P1: Uma chamada padrão (erros e rede) | - | Pending |
| API-03 | P1: Uma chamada padrão (remover cópias) | - | Pending |
| API-04 | P1: Sessão expirada (renovar + redirecionar) | - | Pending |
| API-05 | P1: Sessão expirada (mensagem + voltar) | - | Pending |
| API-06 | P2: Mensagens do backend em português | - | Pending |

**Coverage:** 6 total, 0 mapeados.

## Success Criteria

- [ ] Nenhuma tela mostra "Erro." genérico ou texto em inglês.
- [ ] Sessão expirada nunca deixa o usuário preso numa tela quebrada.
