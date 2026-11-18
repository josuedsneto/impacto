# CI e deploy na Vercel — Validação

## Requisitos e evidências

| Req | Resultado | Evidência |
|---|---|---|
| CI-01 / CI-02 | PASS (leitura) | `.github/workflows/ci.yml`: gatilhos `pull_request` e `push` na `main` |
| CI-03 | PASS (comandos locais) | `cd backend && pytest tests` → 21 passed; `python test_calcs.py` → ok; `python test_mensagens.py` → ok |
| CI-04 | **PENDENTE: checks do frontend, coordenadora roda após integração** | `npm test`, `npm run lint`, `npm run build` não rodados aqui (ver nota abaixo) |
| CI-05 | PASS | `grep -n continue-on-error .github/workflows/ci.yml` vazio |
| DEP-01 / DEP-02 / DEP-03 | PASS | `git ls-files nginx scripts .github frontend/josh-withers-lZ4xZZuk8iA-unsplash.jpg` vazio; `git grep devnull` só mostra nada |
| DEP-04 | PASS | `grep -rnE "ssh\|appleboy\|vercel \|railway " .github` vazio |
| REQ-01 | PASS | `grep -v "==" backend/requirements.txt` vazio; versões vindas do `pip freeze` do venv de referência |
| REQ-02 | PASS (via CI) | Job `backend` executa `pip install -r requirements.txt` |
| REQ-03 | PASS | `cd backend && pytest tests -q` → 21 passed, com as versões fixadas (mesmo venv) |
| DOC-01 | PASS | Leitura da seção Deploy do `CLAUDE.md` |
| DOC-02 | PASS | `grep -nwiE "oracle\|pm2\|nginx\|vm\|deploy\.yml" CLAUDE.md` vazio |
| DOC-03 | PASS | Host do backend e Root Directory marcados "a confirmar" |
| DOC-04 | PASS | "Testes e checagens" lista `pytest tests` |
| DOC-05 | PASS | `grep -n "sem autorização explícita" CLAUDE.md` → linha 47 |

## Notas

- **Frontend não foi verificado nesta worktree.** A instalação de `node_modules` foi interrompida e removida, a pedido da coordenadora. Por isso `npm test`, `npm run lint` e `npm run build` ficam para a rodada na branch integrada.
- **Observação de uma rodada anterior (antes do pedido de parar):** `npm test` completo deu 250 passed e 1 falha: timeout de 5s em `lib/format.test.ts > data ISO em dd/mm/aaaa sem deslocar o dia`. Rodado isolado (`npx vitest run lib/format.test.ts`), os 10 testes passam. Parece lentidão da máquina sob carga, não regressão. Vale conferir na rodada do CI.
- **Risco do job de build sem env:** o repositório não tem `.env.local`. Se `npm run build` falhar por falta de `NEXT_PUBLIC_SUPABASE_URL`, o job precisa de valores fictícios públicos. Não foi adicionado, porque não foi verificado.
- **Backend sem `.env`:** a suíte passou sem `backend/.env` (o arquivo não existe na worktree).
- **Python:** o CI usa `"3.11"` (série). O venv de referência é 3.11.1.
- **Arquivos de histórico em `.planning/`** continuam citando `nginx/` e `setup-vm.sh`, como decidido na spec.
- **`SBV24.csv`:** modificado no working tree desde o início; **não** foi commitado.

## UAT (passos para o usuário)

1. Confirmar no painel da Vercel que o Root Directory do projeto é `frontend/`.
2. Confirmar no painel do Railway o serviço do backend, o Root Directory `backend/` e o domínio público. Preencher o host no `CLAUDE.md` (seção Deploy).
3. Abrir um pull request de teste e conferir que o check `ci` com os jobs `backend` e `frontend` roda e fica verde.
4. Se quiser que o CI bloqueie merge, marcar o check `ci` como obrigatório na branch protection da `main`.
5. Confirmar que o `deploy.yml` não roda mais em push na `main` e que o deploy da Vercel dispara normalmente.
