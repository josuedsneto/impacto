# Impacto

Plataforma de análise financeira para gestão de risco na indústria açucareira:
simulações de preço por Monte Carlo, precificação de opções e gestão de hedge
(fixações/cobertura) sobre ativos brasileiros (açúcar futuro NY nº 11, USD/BRL).
A interface e as variáveis estão em português.

> A versão original em **Streamlit** foi descontinuada. Ela permanece arquivada
> na branch [`legacy/streamlit`](../../tree/legacy/streamlit) apenas para
> referência histórica. Todo o desenvolvimento ativo acontece no frontend
> **Next.js** (`frontend/`) e no backend **FastAPI** (`backend/`).

## Stack

- **Frontend** — Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend** — FastAPI (Python), SlowAPI (rate limiting)
- **Auth & DB** — Supabase (Postgres com RLS, autenticação via JWT ES256)

## Desenvolvimento

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

Crie os arquivos `.env` a partir dos `.env.example` em `frontend/` e `backend/`.

### Testes

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest
```

## Estrutura

```
frontend/             # app Next.js (App Router)
backend/              # API FastAPI
  routers/            # endpoints, registrados em main.py
  tests/              # suíte pytest da lógica financeira
supabase/migrations/  # migrations (timestamped, fonte única)
```

Mais detalhes de convenções e arquitetura em [`CLAUDE.md`](CLAUDE.md).

## Licença

MIT — ver [`LICENSE`](LICENSE).
