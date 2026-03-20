# Spec: Impacto — Plataforma Escalável

**Data:** 2026-03-20
**Status:** Aprovado
**Escopo:** Transformação do app Streamlit em plataforma web moderna com múltiplos usuários, frontend Next.js, backend FastAPI e banco de dados Supabase

---

## 1. Contexto

O Impacto é atualmente um app Streamlit single-user com lógica quantitativa para simulações Monte Carlo, opções e análise de ativos brasileiros (açúcar, câmbio). O objetivo é transformá-lo em uma plataforma escalável para 20–100 usuários internos, com frontend de nível profissional, persistência de dados e autenticação.

---

## 2. Stack

| Camada | Tecnologia | Justificativa |
|--------|------------|---------------|
| Frontend | Next.js (App Router) + shadcn/ui | Frontend moderno, reutiliza ecossistema React |
| Backend | FastAPI (Python) | Reutiliza 100% da lógica quantitativa existente |
| Banco + Auth | Supabase (PostgreSQL + Auth) | Banco gerenciado + autenticação integrada |
| Deploy | Oracle Cloud VM (Always Free — ARM, 4 vCPUs, 24GB) | Zero custo, capacidade suficiente para 20–100 usuários |
| Reverse proxy | Nginx + Let's Encrypt | SSL gratuito, roteamento frontend/backend |
| Dados de mercado | yfinance + cache incremental no Supabase | Reduz dependência externa, histórico persistido |

---

## 3. Arquitetura

```
Oracle Cloud VM
├── Nginx (:80/:443)
│   ├── / → Next.js :3000
│   └── /api/* → FastAPI :8000
│
├── Next.js (pm2)
│   └── Supabase JS client (sessão, auth, RLS)
│
└── FastAPI (uvicorn + pm2)
    └── supabase-py (banco de dados)
        └── yfinance (apenas incrementos novos)

Supabase (gerenciado, externo à VM)
├── PostgreSQL
├── Auth (JWT)
└── Row-Level Security
```

**Fluxo de autenticação:**
1. Usuário faz login via Supabase Auth (email/senha)
2. Supabase retorna JWT
3. Next.js inclui JWT em todas as chamadas ao FastAPI (`Authorization: Bearer <token>`)
4. FastAPI valida a assinatura JWT localmente (sem round-trip ao Supabase)
5. `user_id` extraído do token é usado para RLS nas queries

---

## 4. Banco de Dados

### Tabelas compartilhadas (leitura para todos os usuários autenticados)

```sql
market_prices
├── id            UUID PK
├── ticker        TEXT        -- "SB=F", "USDBRL=X", etc.
├── date          DATE
├── open          NUMERIC
├── high          NUMERIC
├── low           NUMERIC
├── close         NUMERIC
├── adj_close     NUMERIC
├── volume        BIGINT
└── created_at    TIMESTAMPTZ

market_coverage   -- controla o range já baixado por ticker
├── ticker        TEXT PK
├── first_date    DATE
└── last_date     DATE

tickers_catalog   -- catálogo de ativos disponíveis
├── id            UUID PK
├── ticker        TEXT UNIQUE
├── nome          TEXT        -- "Açúcar NY #11"
├── tipo          TEXT        -- "commodity", "fx", "acao", "indice"
├── status        TEXT        -- "pending", "approved", "rejected"
├── ativo         BOOLEAN
├── adicionado_por UUID       -- user_id de quem sugeriu
├── review_note   TEXT        -- motivo de rejeição (opcional)
└── created_at    TIMESTAMPTZ
```

### Tabelas por usuário (RLS — user_id obrigatório)

```sql
simulations       -- histórico de simulações MC salvas
├── id            UUID PK
├── user_id       UUID        -- FK auth.users
├── ticker        TEXT
├── preco_inicial NUMERIC
├── dias_simulados INT
├── num_simulacoes INT
├── pct_bound     NUMERIC
├── p5            NUMERIC
├── p20           NUMERIC
├── p25           NUMERIC
├── p50           NUMERIC
├── p75           NUMERIC
├── p80           NUMERIC
├── p95           NUMERIC
├── label         TEXT        -- nome opcional
└── created_at    TIMESTAMPTZ

user_parameters   -- configs por usuário/ativo
├── id            UUID PK
├── user_id       UUID
├── ticker        TEXT
├── volatilidade_custom    NUMERIC
├── taxa_livre_risco       NUMERIC
├── pct_bound_preferido    NUMERIC
└── updated_at    TIMESTAMPTZ

watchlist
├── user_id       UUID
└── ticker        TEXT
```

### Lógica de cache incremental (FastAPI — `market_cache.py`)

```
1. Recebe: ticker, date_start, date_end
2. Consulta market_coverage para o ticker
3. Se ticker não existe no coverage → baixa tudo do yfinance, salva
4. Se date_end > last_date → baixa [last_date+1, date_end], faz append
5. Se date_start < first_date → baixa [date_start, first_date-1], faz prepend
6. Atualiza market_coverage
7. Retorna de market_prices (sempre do banco)
```

---

## 5. Backend (FastAPI)

### Estrutura

```
backend/
├── main.py                   -- app, CORS, rotas
├── auth.py                   -- validação JWT Supabase
├── routers/
│   ├── market.py             -- /market/prices, /market/tickers
│   ├── simulations.py        -- /simulations CRUD
│   ├── parameters.py         -- /parameters por usuário
│   └── admin.py              -- /admin/tickers (role admin)
├── services/
│   ├── market_cache.py       -- cache-aside + backfill incremental
│   ├── yfinance_client.py    -- wrapper isolado
│   └── quant/
│       ├── monte_carlo.py    -- migrado de 09_Monte_Carlo.py
│       ├── options.py        -- migrado de 08_Payoff_Opções.py
│       └── black_scholes.py  -- migrado de 13_Black_Scholes.py
└── db/
    ├── client.py             -- conexão Supabase
    └── models.py             -- schemas Pydantic
```

### Endpoints principais

| Método | Rota | Acesso | O que faz |
|--------|------|--------|-----------|
| GET | `/market/prices` | auth | Preços (cache incremental) |
| GET | `/market/tickers` | auth | Lista tickers aprovados |
| POST | `/market/tickers/suggest` | auth | Sugere novo ticker |
| POST | `/simulations/run` | auth | Executa MC e salva resultado |
| GET | `/simulations/history` | auth | Histórico do usuário |
| GET/PUT | `/parameters/{ticker}` | auth | Parâmetros do usuário |
| GET | `/admin/tickers/pending` | admin | Fila de aprovação |
| POST | `/admin/tickers/{id}/approve` | admin | Aprova + dispara backfill |
| POST | `/admin/tickers/{id}/reject` | admin | Rejeita com nota |

---

## 6. Frontend (Next.js + shadcn/ui)

### Configuração shadcn

```bash
npx shadcn@latest init -d --base radix
# style: new-york | baseColor: zinc
```

### Tema

```css
@theme inline {
  --color-background: oklch(0.145 0 0);
  --color-card:       oklch(0.205 0 0);
  --color-primary:    oklch(0.488 0.243 264.376);
  --color-muted:      oklch(0.269 0 0);
  --font-sans: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
  --radius: 0.625rem;
}
```

### Dark/Light mode

- `next-themes` com `defaultTheme="dark"` e `enableSystem={false}`
- Toggle no header (ícone `Sun` / `Moon` do Lucide)
- Preferência persistida em `localStorage`

### Estrutura de páginas

```
app/
├── (auth)/
│   ├── login/            -- Supabase Auth UI
│   └── callback/         -- OAuth redirect
├── (app)/
│   ├── dashboard/        -- preços ao vivo + watchlist
│   ├── monte-carlo/      -- simulação + histórico salvo
│   ├── opcoes/           -- payoff diagram + pricer
│   ├── black-scholes/    -- pricer com volatilidade customizável
│   ├── mercado/          -- dados históricos + gráficos
│   ├── configuracoes/
│   │   ├── parametros/   -- volatilidade, taxa, bounds por ativo
│   │   └── tickers/      -- sugerir novo ticker
│   └── layout.tsx        -- sidebar + header + TooltipProvider
└── admin/
    └── tickers/          -- fila de aprovação (role admin)
```

### Composição por página

| Página | Componentes shadcn |
|--------|-------------------|
| Dashboard | `Card` + `Badge` + `Table` + `Skeleton` |
| Monte Carlo | `Card` + `Tabs` + `Sheet` (parâmetros) + `Skeleton` |
| Opções / Black-Scholes | `Card` + `Form` + `Input` + `Separator` |
| Configurações | `Tabs` + `Card` + `Label` + `Input` + `Button` |
| Admin — Tickers | `Table` + `DropdownMenu` + `AlertDialog` |
| Sugerir Ticker | `Dialog` + `Input` + `Button` |
| Login | `Card` + `Input` + `Button` + `Alert` |

### Convenções visuais

- Tokens semânticos obrigatórios: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border` — nunca hex ad-hoc
- Geist Mono para preços, percentis, datas, IDs, métricas numéricas
- Lucide icons a `h-4 w-4` consistente em toda a interface
- `AlertDialog` para ações destrutivas (rejeitar ticker, deletar simulação)
- `Skeleton` + `Card` para estados de loading — nunca área em branco
- `Command` + `Dialog` para busca global de tickers (Cmd+K)
- `TooltipProvider` no layout raiz

---

## 7. Deploy (Oracle Cloud)

### Infraestrutura

```
Oracle Cloud VM — Always Free (ARM Ampere A1)
├── 4 vCPUs, 24GB RAM, Ubuntu 22.04 LTS
├── Nginx (reverse proxy + SSL)
│   ├── :443 / → Next.js :3000 (pm2)
│   └── :443 /api/* → FastAPI :8000 (uvicorn + pm2)
└── Let's Encrypt (SSL automático)

/opt/impacto/
├── frontend/     -- Next.js
├── backend/      -- FastAPI
└── scripts/
    ├── deploy.sh
    └── backup.sh
```

### CI/CD

- GitHub Actions → SSH na VM em merge na `main`
- Frontend: `npm run build` → `pm2 restart frontend`
- Backend: `pip install -r requirements.txt` → `pm2 restart backend`
- Supabase gerencia backups do banco automaticamente

---

## 8. Controle de Acesso

| Role | Permissões |
|------|-----------|
| `user` | Login, simulações próprias, parâmetros próprios, watchlist, sugerir ticker, ver tickers aprovados |
| `admin` | Tudo do `user` + aprovar/rejeitar tickers pendentes |

- Role definida como custom claim no JWT do Supabase
- FastAPI verifica role no token para rotas `/admin/*`
- RLS no Supabase garante isolamento de dados em nível de banco

---

## 9. Fora do Escopo

- App mobile
- Notificações / alertas de preço
- Integração com corretoras / execução de ordens
- Exportação de relatórios PDF
- Multi-tenancy (múltiplas empresas)
