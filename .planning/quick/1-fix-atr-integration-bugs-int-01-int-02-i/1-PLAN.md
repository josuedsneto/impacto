---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/app/app/atr/page.tsx
  - frontend/components/admin/AtrUsinasAdmin.tsx
autonomous: true
requirements: [INT-01, INT-02, INT-03]

must_haves:
  truths:
    - "Usinas list loads without error in the ATR page"
    - "Historico tab loads without 422 when no usina is selected"
    - "Admin associate-user action reaches the backend without 404"
  artifacts:
    - path: "frontend/app/app/atr/page.tsx"
      provides: "Fixed usinas and historico fetch unwrapping"
    - path: "frontend/components/admin/AtrUsinasAdmin.tsx"
      provides: "Fixed associate-user endpoint and usinas fetch unwrapping"
  key_links:
    - from: "frontend/app/app/atr/page.tsx line 58"
      to: "/api/atr/usinas response"
      via: "setUsinas((data as { usinas: Usina[] }).usinas)"
      pattern: "data as \\{ usinas"
    - from: "frontend/app/app/atr/page.tsx line 86"
      to: "/api/atr/historico response"
      via: "setHistorico((data as { historico: HistoricoItem[] }).historico)"
      pattern: "data as \\{ historico"
    - from: "frontend/components/admin/AtrUsinasAdmin.tsx line 134"
      to: "/api/admin/usinas/{id}/usuarios/{user_id}"
      via: "path param instead of body"
      pattern: "usuarios.*encodeURIComponent"
---

<objective>
Fix three integration bugs in the ATR frontend that cause runtime errors against the FastAPI backend.

Purpose: The ATR page and admin panel are broken due to API contract mismatches introduced during Phase 20. All three bugs are mechanical one-liner or two-liner fixes with no design decisions required.
Output: Two files patched; all three integration errors eliminated.
</objective>

<execution_context>
@C:/Users/netin/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/netin/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix INT-01 and INT-02 in atr/page.tsx</name>
  <files>frontend/app/app/atr/page.tsx</files>
  <action>
Two fixes in this file:

INT-01 (line 58) — `setUsinas` receives raw API response but backend returns `{"usinas": [...]}`.
Change:
  `setUsinas(data as Usina[]);`
To:
  `setUsinas((data as { usinas: Usina[] }).usinas);`

INT-02 (two parts):

Part A — Guard the historico fetch when `selectedUsinaId` is empty. The backend requires `usina_id` query param; calling without it returns 422. The current code already builds the URL conditionally (line 76-78), BUT the branch when `selectedUsinaId` is falsy falls through to `${API}/api/atr/historico` with no param, causing 422.
Fix: when `selectedUsinaId` is empty, skip the fetch and show an informational message instead. Replace the historico fetch block inside `handleTabChange` so it only fetches when `selectedUsinaId` is non-empty:

```ts
if (value === "historico" && !historicoLoaded) {
  if (!selectedUsinaId) {
    // Cannot load historico without a selected usina
    setHistoricoError("Selecione uma usina na aba Simular para ver o histórico.");
    return;
  }
  setHistoricoLoading(true);
  setHistoricoError(null);
  try {
    const token = await getAccessToken();
    const url = `${API}/api/atr/historico?usina_id=${encodeURIComponent(selectedUsinaId)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    if (!res.ok) {
      setHistoricoError((data as { detail?: string }).detail ?? "Erro ao carregar histórico.");
    } else {
      setHistorico((data as { historico: HistoricoItem[] }).historico);
      setHistoricoLoaded(true);
    }
  } catch {
    setHistoricoError("Erro de conexão com o servidor.");
  } finally {
    setHistoricoLoading(false);
  }
}
```

Part B — the success branch cast (line 86): change `data as HistoricoItem[]` to `(data as { historico: HistoricoItem[] }).historico` — already handled in the block above.

Also reset `historicoLoaded` when `selectedUsinaId` changes so switching usinas forces a fresh load. Add a `useEffect`:
```ts
useEffect(() => {
  setHistoricoLoaded(false);
  setHistoricoError(null);
}, [selectedUsinaId]);
```
Place it after the existing usinas-load `useEffect`.
  </action>
  <verify>
    <automated>cd /c/Users/netin/OneDrive/Documentos/Code/impacto/frontend && npx tsc --noEmit 2>&1 | head -30</automated>
    <manual>Check that `grep -n "data as Usina\[\]" frontend/app/app/atr/page.tsx` returns no matches and `grep -n "data as HistoricoItem\[\]" frontend/app/app/atr/page.tsx` returns no matches.</manual>
  </verify>
  <done>No TypeScript errors in page.tsx; both raw-array casts replaced with envelope unwraps; historico fetch guarded against empty usina_id.</done>
</task>

<task type="auto">
  <name>Task 2: Fix INT-01 and INT-03 in AtrUsinasAdmin.tsx</name>
  <files>frontend/components/admin/AtrUsinasAdmin.tsx</files>
  <action>
Two fixes in this file:

INT-01 (line 64) — `fetchUsinas` in admin calls `GET /api/admin/usinas` which also returns `{"usinas": [...]}`. Change:
  `setUsinas(data as Usina[]);`
To:
  `setUsinas((data as { usinas: Usina[] }).usinas);`

INT-03 (lines 134-141) — `handleAssociate` calls `POST /api/admin/usinas/{id}/users` with `{ user_id }` in body. Backend expects `POST /api/admin/usinas/{usina_id}/usuarios/{user_id_target}` as a path-param route with no body.

Change the fetch call from:
```ts
const res = await fetch(`${API}/api/admin/usinas/${encodeURIComponent(selectedUsinaId)}/users`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify({ user_id: targetUserId.trim() }),
});
```
To:
```ts
const res = await fetch(
  `${API}/api/admin/usinas/${encodeURIComponent(selectedUsinaId)}/usuarios/${encodeURIComponent(targetUserId.trim())}`,
  {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }
);
```
No body, no Content-Type header — the backend reads both IDs from the URL path.
  </action>
  <verify>
    <automated>cd /c/Users/netin/OneDrive/Documentos/Code/impacto/frontend && npx tsc --noEmit 2>&1 | head -30</automated>
    <manual>Check that `grep -n "data as Usina\[\]" frontend/components/admin/AtrUsinasAdmin.tsx` returns no matches and `grep -n "/users" frontend/components/admin/AtrUsinasAdmin.tsx` returns no matches (replaced by /usuarios/).</manual>
  </verify>
  <done>No TypeScript errors; admin usinas list unwraps envelope; associate-user call uses correct path-param URL with no request body.</done>
</task>

</tasks>

<verification>
After both tasks:
- `npx tsc --noEmit` passes with no errors in the frontend directory.
- No occurrence of `data as Usina[]` or `data as HistoricoItem[]` remains in either file.
- No occurrence of `/users` path segment remains in AtrUsinasAdmin.tsx (replaced by `/usuarios/{id}`).
- Historico fetch is never called without `usina_id` query param.
</verification>

<success_criteria>
- INT-01: Both files unwrap `{ usinas: Usina[] }` envelope before calling setUsinas.
- INT-02: Historico fetch only fires when selectedUsinaId is non-empty; response unwraps `{ historico: HistoricoItem[] }` envelope.
- INT-03: Associate-user call targets `/api/admin/usinas/{id}/usuarios/{user_id}` as path params with no body.
- TypeScript compilation passes cleanly.
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-atr-integration-bugs-int-01-int-02-i/1-SUMMARY.md` following the standard summary template.
</output>
