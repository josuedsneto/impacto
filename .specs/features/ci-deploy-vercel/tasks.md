# CI e deploy na Vercel — Tarefas

Cada tarefa é um commit atômico (Conventional Commits, em português).

- [ ] **T1** `ci(deploy): cria ci.yml com jobs de backend e frontend` — `.github/workflows/ci.yml`. Backend: Python `"3.11"` (série), `pip install -r requirements.txt pytest==9.1.1 httpx==0.27.2`, `pytest tests`, `python test_calcs.py`, `python test_mensagens.py` (`working-directory: backend`). Frontend: Node 22, `npm ci`, `npm test`, `npm run lint`, `npm run build` (`working-directory: frontend`). Gatilhos: `pull_request` e `push` na `main`. Cobre CI-01 a CI-05.
- [ ] **T2** `chore(deploy): remove deploy por SSH na VM Oracle` — apaga `.github/workflows/deploy.yml`, `nginx/`, `scripts/` (com `ecosystem.config.js` e `setup-vm.sh`). Cobre DEP-01, DEP-02, DEP-04.
- [ ] **T3** `chore(frontend): remove arquivos soltos sem referência` — apaga `frontend/josh-withers-lZ4xZZuk8iA-unsplash.jpg`; remove a linha `frontend/devnull` do `.gitignore`. O `devnull` já não existe, só a entrada. Cobre DEP-03.
- [ ] **T4** `build(backend): fixa versões em requirements.txt` — troca `>=`, `<` e versões soltas pelas versões do venv de referência (lista do `pip freeze`). Cobre REQ-01.
- [ ] **T5** `docs(deploy): descreve Vercel e Railway no CLAUDE.md` — reescreve a seção Deploy (Vercel para `frontend/`, Railway para `backend/`, host do backend marcado "a confirmar"), remove menções a VM/pm2, acrescenta `pytest` em "Testes e checagens". Cobre DOC-01 a DOC-04.
- [ ] **T6** `docs(specs): registra validação de ci-deploy-vercel` — `validation.md` com evidências.

Validação local antes de T6: `cd backend && pytest tests -q && python test_calcs.py && python test_mensagens.py`; `cd frontend && npm ci && npm test && npm run lint && npm run build`; `git ls-files` e `grep` dos critérios de DEP.
