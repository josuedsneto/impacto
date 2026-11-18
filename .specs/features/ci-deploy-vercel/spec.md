# CI e deploy na Vercel — Especificação

## Problem Statement

O deploy ainda aponta para a VM Oracle. `.github/workflows/deploy.yml` faz SSH na VM e roda `pm2 restart ecosystem.config.js` a partir de `backend/`, mas esse arquivo está em `scripts/`: o comando falha. Além disso, nenhum teste roda antes do deploy, e as versões de `backend/requirements.txt` estão soltas (`numpy`, `yfinance<1.0.0`, `statsmodels>=0.14.5`…), então o mesmo commit pode instalar bibliotecas diferentes em dois momentos.

## Goals

- [ ] Todo pull request e todo push na `main` rodam os testes de backend e frontend antes de qualquer deploy.
- [ ] Nenhum workflow faz SSH nem deploy por CLI: o deploy é a integração Git da Vercel (frontend) e da plataforma do backend.
- [ ] Arquivos que só existiam para a VM Oracle saem do repositório.
- [ ] `backend/requirements.txt` fixa versões exatas, iguais às do venv de referência.
- [ ] `CLAUDE.md` descreve o deploy real (Vercel + backend), sem VM nem pm2.

## Out of Scope

| Item | Motivo |
|------|--------|
| `render.yaml`, `requirements.txt` da raiz, `Painel.py` e o Streamlit | AD-006: decisão do usuário. |
| Criar o projeto na Vercel ou mudar o Root Directory | Configuração de painel, feita pelo usuário. |
| Criar deploy por CLI (`vercel --prod`, `railway up`) | Pedido explícito: o deploy continua pela integração Git. |
| Corrigir falhas de lint/teste que já existam no código | Se o CI falhar por código existente, reporta-se; não se corrige aqui. |
| Remover `backend/Procfile` ou o `startCommand` duplicado em `railway.toml` | Não são da VM; a duplicação é inofensiva e fica registrada como dívida. |
| `frontend/AGENTS.md` (boas práticas Vercel) | Já documenta a Vercel; não atrapalha. |

---

## Fato x suposição (levantado no repositório)

| Item | Status | Evidência |
|------|--------|-----------|
| `deploy.yml` faz SSH na VM e roda `pm2 restart ecosystem.config.js` em `backend/` | **Fato** | `.github/workflows/deploy.yml:38`; o arquivo está em `scripts/ecosystem.config.js` |
| Não existe `ci.yml` nem outro workflow | **Fato** | `ls .github/workflows` → só `deploy.yml` |
| Frontend está na Vercel | **Fato documentado** | `docs/superpowers/specs/2026-03-31-missing-pages-design.md:15` ("Frontend (Vercel)"); `docs/superpowers/plans/2026-03-31-login-auth.md:250` (`vercel --prod`) |
| Root Directory da Vercel é `frontend/` | **Suposição** | Não há `vercel.json` nem config no repo; é a única app Next. Confirmar no painel. |
| Backend roda no Railway | **Fato forte, não confirmado** | `backend/railway.toml` (nixpacks, `startCommand` com `$PORT`); `backend/main.py:51-52` checa `RAILWAY_ENVIRONMENT` |
| Host público do backend | **Suposição** | Não está no repo. Valor de `NEXT_PUBLIC_API_URL` na Vercel é desconhecido. |
| Versão de Python | **Fato** | `.python-version` na **raiz** (não em `backend/`) = `3.11.0`; venv de referência usa 3.11.1 |
| Testes de backend passam | **Fato** | `cd backend && pytest tests -q` → 21 passed; `pytest backend/tests` a partir da raiz → 21 passed; `test_calcs.py` e `test_mensagens.py` → ok |
| `pytest` e `httpx` não estão em `requirements.txt` | **Fato** | venv tem `pytest==9.1.1` e `httpx==0.27.2`; `conftest.py` usa `TestClient` |
| Node.js exigido pelo Next 16 | **Suposição** | Next 16 exige Node ≥ 20.9; CI usa Node 22 LTS. Sem `engines` no `package.json`. |
| `frontend/devnull` existe | **Fato: não existe** | Ausente na worktree; só aparece em `.gitignore:18` |
| `frontend/josh-withers-lZ4xZZuk8iA-unsplash.jpg` não é referenciado | **Fato** | `git grep` por `josh-withers` só acha o próprio arquivo |
| `README.md` fala de VM/pm2 | **Fato: não fala** | Só remete ao `CLAUDE.md` para "publicar" |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Gatilho de `push` | Só `push` na `main` (além de `pull_request`) | Evita rodar duas vezes em branches que já têm PR. Pedido diz "em push": se quiser em todas as branches, troca uma linha. | n |
| Instalar `pytest` e `httpx` no CI | Linha extra no passo de `pip install`: `pip install -r requirements.txt pytest==9.1.1 httpx==0.27.2` | Evita criar `requirements-dev.txt` só para duas linhas. | y |
| Pytest no CI | `pytest tests` com `working-directory: backend` | Caminho testado. O comando da tarefa (`pytest backend/tests` na raiz) também passa, mas `conftest.py` depende de `sys.path`; usar o diretório do backend é mais previsível. | y |
| Versão do Node no CI | 22 | Suposição, ver tabela acima. | n |
| Variáveis de ambiente no CI | Nenhum secret. Se `npm run build` falhar sem `.env.local`, o job recebe valores fictícios públicos (`NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy`, `NEXT_PUBLIC_API_URL=http://localhost:8000`) | Build não pode depender de `.env` que não está no repo. Verificado localmente antes de T1 (ver validation.md). | n |
| Nome do workflow e dos jobs | `name: ci`; jobs `backend` e `frontend` | Check estável para branch protection. | n |
| Arquivos de histórico em `.planning/` | Ficam como estão (citam `nginx/` e `setup-vm.sh`) | São registro de planejamento, não runtime. | y |
| Versão de Python no CI | `python-version: "3.11"` (série, não patch) | O caminho `backend/.python-version` não existe; o arquivo é da raiz. Série 3.11 evita depender de um patch pré-compilado para ubuntu-24.04. | y |
| Versões fixadas | As do `pip freeze` do venv, só para os pacotes listados em `requirements.txt` (sem dependências transitivas) | Pedido da coordenadora. | y |
| `scripts/setup-vm.sh` | Removido junto com `scripts/` | É bootstrap da VM Oracle (apt, nginx, pm2). Pedido diz "o que só servia à Oracle". | y |
| `backend/Procfile` | Mantido | Não é Oracle; Railway/nixpacks pode usá-lo. | n |
| Host do backend no `CLAUDE.md` | "Railway (host a confirmar)" | Ver tabela de fatos. | n |

**Open questions (para o usuário):**
1. Confirmar no painel da Vercel que o Root Directory é `frontend/`.
2. Confirmar no painel do Railway que o serviço do backend tem `backend/` como Root Directory e qual é o domínio público.
3. Confirmar que a `main` tem branch protection exigindo o check `ci` (se quiser que CI bloqueie merge). Isso não é feito pelo repositório.

---

## User Stories

### P1: CI roda antes de qualquer deploy ⭐ MVP

**User Story**: Como desenvolvedor, quero que testes rodem em todo pull request e push na `main`, para não subir código que quebra a suíte.

**Acceptance Criteria**:

1. WHEN um pull request é aberto ou atualizado THEN o workflow `.github/workflows/ci.yml` SHALL rodar os jobs de backend e frontend.
2. WHEN há push na `main` THEN o mesmo workflow SHALL rodar.
3. WHEN o job de backend roda THEN SHALL executar `pip install -r requirements.txt`, `pytest tests`, `python test_calcs.py` e `python test_mensagens.py` no diretório `backend/`.
4. WHEN o job de frontend roda THEN SHALL executar `npm ci`, `npm test`, `npm run lint` e `npm run build` no diretório `frontend/`.
5. IF qualquer passo falha THEN o job SHALL falhar (sem `continue-on-error`).

**Independent Test**: `actionlint` (ou leitura do YAML) mostra os dois jobs e os seis comandos; o workflow roda no GitHub em um PR de teste.

### P1: Sem caminho de deploy pela VM ⭐ MVP

**User Story**: Como desenvolvedor, quero que nenhum workflow publique na VM, para não haver dois caminhos de deploy.

**Acceptance Criteria**:

1. The repositório SHALL não conter `.github/workflows/deploy.yml`.
2. The repositório SHALL não conter `nginx/`, `scripts/` nem `frontend/devnull`.
3. The repositório SHALL não conter `frontend/josh-withers-lZ4xZZuk8iA-unsplash.jpg`.
4. The workflows SHALL não usar `ssh`, `appleboy/ssh-action`, `vercel` CLI nem `railway` CLI.

**Independent Test**: `git ls-files | grep -E "nginx/|scripts/|deploy.yml|josh-withers"` retorna vazio; `grep -rnE "ssh|appleboy|vercel |railway " .github` retorna vazio.

### P1: Dependências reprodutíveis ⭐ MVP

**User Story**: Como desenvolvedor, quero que `pip install` instale sempre as mesmas versões, para o CI não quebrar sem mudança de código.

**Acceptance Criteria**:

1. The `backend/requirements.txt` SHALL fixar versão exata (`==`) de cada pacote listado, usando a versão do venv de referência.
2. WHEN `pip install -r backend/requirements.txt` roda num Python 3.11 limpo THEN a instalação SHALL terminar com código 0.
3. WHEN `cd backend && pytest tests -q` roda com as versões fixadas THEN SHALL passar (21 testes).

**Independent Test**: `grep -v "==" backend/requirements.txt` retorna vazio; comando do critério 3.

### P2: CLAUDE.md descreve o deploy real

**User Story**: Como desenvolvedor, quero que a seção de Deploy diga onde cada parte roda, para saber onde olhar quando algo quebra.

**Acceptance Criteria**:

1. The seção "Deploy" do `CLAUDE.md` SHALL citar Vercel para `frontend/` e Railway para `backend/`.
2. The `CLAUDE.md` SHALL não mencionar VM, Oracle, nginx, pm2 nem `deploy.yml`.
3. The seção SHALL marcar como "a confirmar" o host do backend e o Root Directory da Vercel.
4. The seção "Testes e checagens" SHALL listar `pytest` com o mesmo comando do CI.
5. The `CLAUDE.md` SHALL manter o aviso "Não faça push na `main` sem autorização explícita".

**Independent Test**: `grep -nwiE "oracle|pm2|nginx|vm|deploy\.yml" CLAUDE.md` retorna vazio; `grep -n "sem autorização explícita" CLAUDE.md` acha a linha.

---

## Requirement Traceability

| Requisito | Stories | Verificação |
|---|---|---|
| CI-01 | P1 CI | Leitura do `ci.yml`; check verde em PR |
| CI-02 | P1 CI | Leitura do `ci.yml` |
| CI-03 | P1 CI | Comandos locais equivalentes (validation.md) |
| CI-04 | P1 CI | Comandos locais (validation.md) |
| CI-05 | P1 CI | Ausência de `continue-on-error` no YAML |
| DEP-01 | P1 Deploy | `git ls-files` (validation.md) |
| DEP-02 | P1 Deploy | `git ls-files` |
| DEP-03 | P1 Deploy | `git ls-files` |
| DEP-04 | P1 Deploy | `grep` no `.github` |
| REQ-01 | P1 Reprodutível | `grep -v "=="` |
| REQ-02 | P1 Reprodutível | Job `backend` do CI (`pip install -r requirements.txt`) como evidência |
| REQ-03 | P1 Reprodutível | `pytest tests -q` |
| DOC-01 | P2 CLAUDE.md | Leitura |
| DOC-02 | P2 CLAUDE.md | `grep -nwiE` |
| DOC-05 | P2 CLAUDE.md | `grep` do aviso sobre push na `main` |
| DOC-03 | P2 CLAUDE.md | Leitura |
| DOC-04 | P2 CLAUDE.md | Leitura |
