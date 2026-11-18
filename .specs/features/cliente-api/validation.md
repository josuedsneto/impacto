# Cliente de API — Validação

**Date**: 2026-10-05
**Spec**: `.specs/features/cliente-api/spec.md`
**Diff range**: `681d069..141b6ff` (branch `refactor/auditoria`)
**Verifier**: revisão independente feita pelo próprio agente (fallback sem sub-agente; o usuário não pediu sub-agentes)

**Result**: PASS — critérios automatizáveis cobertos e 7/7 mutantes mortos. Dois critérios de tela (API-05 AC3 e AC4) aguardam UAT do usuário.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| API-01 AC1: envia `Authorization: Bearer <token>` | header com o token da sessão | `frontend/lib/api.test.ts:35` - `expect(headers.get("Authorization")).toBe("Bearer tok-1")` | ✅ PASS |
| API-01 AC2: 2xx devolve JSON | corpo convertido | `frontend/lib/api.test.ts:41` - `resolves.toEqual({ preco: 21.5 })` | ✅ PASS |
| API-02 AC3: 4xx/5xx com `detail` | mensagem = detail | `frontend/lib/api.test.ts:47` - `rejects.toMatchObject({ message: "Ticker inválido.", status: 400 })` | ✅ PASS |
| API-02 AC3: sem `detail` | "Não foi possível concluir a operação. Tente novamente." | `frontend/lib/api.test.ts:53` - `rejects.toThrow("Não foi possível concluir…")` | ✅ PASS |
| API-02 AC4: falha de rede | "Sem conexão com o servidor. Verifique sua internet e tente novamente." | `frontend/lib/api.test.ts:68` - `rejects.toThrow("Sem conexão…")` | ✅ PASS |
| API-02 AC4: tempo limite | mesma mensagem | `frontend/lib/api.test.ts:76` - `rejects.toThrow("Sem conexão…")` | ✅ PASS |
| API-02 AC5: 422 com lista | "Algum campo está fora do intervalo permitido." | `frontend/lib/api.test.ts:62` - `rejects.toThrow("Algum campo…")` | ✅ PASS |
| API-03 AC6: sem outras definições de token | só `lib/api.ts` | `grep -rn "getAccessToken\|getToken" app components` sem resultados | ✅ PASS |
| API-04 AC1: 401 renova e repete | segunda chamada com token novo | `frontend/lib/api.test.ts:92-93` - `resolves.toEqual({ ok: true })` e `toBe("Bearer tok-2")` | ✅ PASS |
| API-04 AC2: renovação falha → login | `/login?expirada=1&voltar=<caminho>` | `frontend/lib/api.test.ts:101` - `toHaveBeenCalledWith("/login?expirada=1&voltar=%2Fapp%2Fvar%3Ft%3D1")` | ✅ PASS |
| API-05 AC3: login mostra aviso de sessão expirada | texto exato | `frontend/app/(auth)/login/page.tsx:81` (código); sem teste automatizado | ⏳ UAT |
| API-05 AC4: após login abre `voltar` | `router.push(voltar)` | `frontend/app/(auth)/login/page.tsx:45` (código); sem teste automatizado | ⏳ UAT |
| API-05 AC5: `voltar` fora de `/app/` é ignorado | `/app/dashboard` | `frontend/lib/api.test.ts:130-133` - `toBe("/app/dashboard")` para URL absoluta, null, `//host` e `/login` | ✅ PASS |
| API-06 AC1: detail em português | nenhuma mensagem em inglês | `backend/test_mensagens.py:40` - `assert not achados` | ✅ PASS |
| API-06 AC2: dados insuficientes | "Dados insuficientes para <ticker>. Tente outro ativo ou período." | `backend/test_mensagens.py:44` - `assert "Dados insuficientes para . Tente…" in textos` | ✅ PASS |

## Edge Cases

- [x] 401 simultâneos: uma renovação e um redirecionamento — `frontend/lib/api.test.ts:108-109`.
- [x] Na tela de login não redireciona de novo — `frontend/lib/api.test.ts:117`.

## Discrimination Sensor

Executado num worktree temporário, descartado em seguida.

| # | File | Mutação | Killed? |
|---|---|---|---|
| 1 | `frontend/lib/api.ts` | remove tratamento do 422 em lista | ✅ |
| 2 | `frontend/lib/api.ts` | `destinoSeguro` aceita qualquer `/` | ❌ sobreviveu → teste reforçado em `141b6ff` → ✅ |
| 3 | `frontend/lib/api.ts` | renovação de sessão não compartilhada | ✅ |
| 4 | `frontend/lib/api.ts` | sem nova tentativa após renovar | ✅ |
| 5 | `frontend/lib/api.ts` | sem header Authorization | ✅ |
| 6 | `frontend/lib/api.ts` | redireciona mesmo na tela de login | ✅ |
| 7 | `backend/main.py` | volta uma mensagem para o inglês | ✅ |

**Result**: 7/7 killed (após o reforço).

Incidente: a remoção do worktree atravessou a junção para `frontend/node_modules` e apagou parte das dependências instaladas. Nada versionado foi afetado; `npm ci` restaurou tudo (`npm ls` sem pacotes faltando). Próximas execuções do sensor não usam junção.

## Gate Check

- `cd frontend && npm test` — 13 passed, 0 failed (antes da feature: 0 testes no frontend).
- `npx tsc --noEmit` — 0 erros. `npm run build` — compilado com sucesso.
- `cd backend && python test_calcs.py && python test_mensagens.py` — ok.
- Lint dos arquivos alterados: 0 erros; avisos pré-existentes em `app/app/risco/page.tsx`.

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ um módulo (`lib/api.ts`), sem dependência de runtime nova |
| Surgical changes | ✅ telas só trocaram o bloco de chamada |
| No scope creep | ✅ exceto correção separada `4b5c5db` (AdminConfig lia a resposta errada), registrada como fix próprio |
| Matches patterns | ✅ |
| Every test maps to a spec requirement | ✅ |

## Requirement Traceability Update

| Requirement | New Status |
|---|---|
| API-01 | Verified |
| API-02 | Verified |
| API-03 | Verified |
| API-04 | Verified |
| API-05 | Implementing (UAT pendente) |
| API-06 | Verified |

## Summary

**Overall**: ✅ Pronto, com 2 checagens de tela para o usuário.

**UAT pendente**:
1. Abrir `/login?expirada=1` → deve aparecer "Sua sessão expirou. Entre novamente para continuar."
2. Abrir `/login?voltar=/app/var`, entrar → deve abrir a página de VaR.
