# Validação — seguranca-banco

## Checks do frontend: pendentes, coordenadora roda após integração

Não rodar `npm test`, `npm run lint` nem `npm run build` na worktree: a coordenadora roda uma vez na branch integrada, onde o `node_modules` existe. (Antes da instrução da coordenadora, `npm test` passou com 254 testes; o lint foi interrompido e não tem resultado.)

## Evidências por requisito

| Requisito | Evidência | Resultado |
|---|---|---|
| REQ-SEG-001..003 (anon/RLS) | Migration `20261118000001_seguranca_grants.sql` lida; SQL de verificação na spec | Pendente de execução no projeto Supabase (UAT) |
| REQ-SEG-004..006 (ATR) | Migration `20261118000002_atr_simulacoes_update.sql`; `backend/main.py` ATR usa `supa_client()` (service role) | Código ok; permissão real pendente de UAT |
| REQ-SEG-007..008 (admin_config) | `20260403000000_admin_config.sql` (IF NOT EXISTS, seed idempotente) | Ordem de timestamp verificada por `ls` |
| REQ-SEG-009..013 (JWT) | `cd backend && .venv/Scripts/python.exe -m pytest tests/test_auth.py -q` → **9 passed** | OK |
| REQ-SEG-014..016 (Swagger) | `TestClient(main.app)` com `ENABLE_DOCS` ausente → `[404, 404, 404]`; com `true` → `[200, 200, 200]` | OK (verificado manualmente) |
| REQ-SEG-017 (CSP sem localhost) | Build de produção sem variáveis deve falhar | Pendente: coordenadora roda o build |
| REQ-SEG-018..019 (callback/origem) | `frontend/lib/origem-confiavel.test.ts` (3 testes) | Incluso no `npm test` de 254 passed (rodado antes da instrução) |

### Backend (suíte completa)

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q
30 passed, 5 warnings
python test_calcs.py        → ok
python test_mensagens.py    → ok
```

## UAT para o usuário

1. **Aplicar as migrations** (ordem: `20260403000000` antes de `20260403000001`). Se o banco já tem `20260403000001` aplicado, rode o SQL de `20260403000000_admin_config.sql` à mão (é idempotente) ou use `supabase db push --include-all`. Não use `migration repair` sem checar a tabela.
2. **Rodar o SQL de verificação** da `spec.md` no projeto Supabase: nenhuma linha com `grantee = 'anon'`; `authenticated` sem nada em `market_coverage`/`admin_config`; `atr_simulacoes` só com SELECT para `authenticated`.
3. **Testar ATR** pelo app: criar simulação, marcar compartilhada, trocar de usina. Tudo deve funcionar (escrita passa pelo backend).
4. **Login e callback**: confirmar `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_API_URL` na Vercel (inclusive em preview deployments). Sem `NEXT_PUBLIC_SITE_URL`, o callback responde 500.
5. **Swagger**: `/docs` deve dar 404 em produção; `ENABLE_DOCS=true` só em desenvolvimento local.
6. **Decidir a `watchlist`**: remover ou manter (candidata registrada na spec).
7. **Backend em produção**: confirmar que `SUPABASE_URL` é exatamente o domínio do `iss` do JWT (inclusive custom domain).

## Ficou de fora

- `watchlist` (decisão do usuário).
- Nonce no CSP (`unsafe-inline` continua).
- Aplicar as migrations e rodar os checks de frontend (coordenadora / usuário).
