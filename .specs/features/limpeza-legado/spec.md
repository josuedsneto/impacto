# Limpeza do legado — Especificação

## Problem Statement

O repositório carrega dois apps: o Streamlit antigo (`Painel.py`, `pages/`, `config.py`, `utils.py`, `render.yaml`, `requirements.txt` da raiz) e o atual (Next.js + FastAPI). O `CLAUDE.md` descreve só o antigo, e há componentes mortos no frontend. Quem abre o projeto não sabe o que está em uso.

## Goals

- [ ] Só o código em uso fica no repositório.
- [ ] `CLAUDE.md` e `README.md` descrevem a arquitetura real em até 60 linhas cada.

## Out of Scope

| Item | Motivo |
|------|--------|
| Planilhas de dados (`Historico Impurezas.xlsx`, `dadosReg*.xls`, `açúcar_bi.xlsx`, `df_final.xlsx`) | Podem ser fonte de dados (o histórico de impurezas vira carga inicial do ATR). Ficam até `atr-dados-reais` decidir o destino. |
| `SBV24.csv` / `sbv24.*` | `SBV24.csv` tem alteração local não commitada do usuário; não se apaga trabalho não salvo. |
| Pasta `.planning/` | Histórico de planejamento anterior; não atrapalha o runtime. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Quem apaga os arquivos do Streamlit | O usuário roda o `git rm` listado abaixo; o agente atualiza docs e remove código morto do frontend | A política de permissões bloqueou a deleção pelo agente (AD-006) | y |
| Endpoints de watchlist sem tela | Removidos do backend junto com `WatchlistManager` | Nenhuma tela usa; a premissa é simplicidade. Tabela `watchlist` fica no banco (sem migração destrutiva) | n |
| `AGENTS.md` (boas práticas Vercel) | Removido | O deploy é em VM Oracle com pm2, não Vercel; o texto induz a erro | n |

**Open questions:** none - todas resolvidas ou registradas acima.

Comando para o usuário rodar (raiz do repo):

```bash
git rm -r Painel.py pages config.py utils.py render.yaml requirements.txt .devcontainer \
  noticia1.png noticia2.png ibea.png \
  "Dados Históricos - Açúcar NY nº11 Futuros (6).csv" "USD_BRL Dados Históricos (2).csv"
```

---

## User Stories

### P1: Repositório só com o app atual ⭐ MVP

**User Story**: Como desenvolvedor, quero que o repositório contenha só o app em uso, para não perder tempo com código morto.

**Acceptance Criteria**:

1. The repositório SHALL não conter `Painel.py`, `pages/`, `config.py`, `utils.py`, `render.yaml` nem o `requirements.txt` da raiz.
2. The frontend SHALL não conter `TickerTape.tsx`, `ToolGrid.tsx` nem `WatchlistManager.tsx`.
3. The backend SHALL não expor `/api/watchlist` (GET, POST, DELETE) nem `/api/admin/ping`.
4. WHEN `npm run build` roda em `frontend/` THEN o build SHALL terminar com código 0.

**Independent Test**: `git ls-files` não lista os itens; build do frontend passa; `python -m py_compile backend/*.py` passa.

### P1: Documentação que bate com o código ⭐ MVP

**User Story**: Como desenvolvedor (ou agente), quero que `CLAUDE.md` descreva a arquitetura real.

**Acceptance Criteria**:

1. The `CLAUDE.md` SHALL descrever: frontend Next.js em `frontend/`, API FastAPI em `backend/`, Supabase (auth + Postgres + cache de preços), deploy via GitHub Actions → VM com pm2 + nginx, e os comandos para rodar cada parte localmente.
2. The `CLAUDE.md` SHALL não mencionar Streamlit.
3. The `README.md` SHALL listar as ferramentas do app agrupadas como no menu lateral.

**Independent Test**: leitura; `grep -i streamlit CLAUDE.md README.md` sem resultados.

---

## Edge Cases

- IF o deploy na VM ainda tiver o Streamlit rodando THEN a remoção SHALL não afetar o pm2, porque `scripts/ecosystem.config.js` não referencia Streamlit.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| LEG-01 | P1: Repositório só com o app atual | - | Implementing |
| LEG-02 | P1: Repositório só com o app atual (componentes mortos) | - | Verified |
| LEG-03 | P1: Repositório só com o app atual (endpoints mortos) | - | Verified |
| LEG-04 | P1: Documentação que bate com o código | - | Verified |

**Coverage:** 4 total, 0 mapeados para tasks (Small: tasks implícitas).

## Success Criteria

- [ ] Um dev novo roda frontend e backend só lendo o `CLAUDE.md`.
