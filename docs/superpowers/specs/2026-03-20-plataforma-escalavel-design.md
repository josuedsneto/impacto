# Spec: Impacto — Plataforma Escalável

**Data:** 2026-03-20
**Status:** Revisado — aguardando aprovação do usuário
**Escopo:** Transformação do app Streamlit em plataforma web moderna com múltiplos usuários, frontend Next.js, backend FastAPI e banco de dados Supabase

---

## 1. Contexto

O Impacto é atualmente um app Streamlit single-user com lógica quantitativa para simulações Monte Carlo, opções e análise de ativos brasileiros (açúcar, câmbio). O objetivo é transformá-lo em uma plataforma escalável para 20–100 usuários internos, com frontend de nível profissional, persistência de dados e autenticação.

Os dados históricos existem atualmente em CSVs locais. Esses CSVs **não serão migrados** — o yfinance será a fonte de verdade, e o banco será populado com backfill a partir do primeiro uso. O range mínimo histórico necessário é de 2013-01-01 (data usada na função `baixar_dados_mc` atual).

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
2. Supabase retorna JWT (RS256, assinado com chave privada do projeto)
3. Next.js inclui JWT em todas as chamadas ao FastAPI (`Authorization: Bearer <token>`)
4. FastAPI valida a assinatura JWT localmente com `PyJWT` + chave pública do Supabase (sem round-trip)
5. A claim `aud` é validada como `"authenticated"`. O `user_id` e o `app_metadata.role` são extraídos do payload.

**Nginx — configuração relevante:**
- `proxy_read_timeout 120s` — simulações MC podem levar até 10s
- `client_max_body_size 1m` — payloads de simulação são pequenos
- Rate limiting: `limit_req_zone` a 30 req/s por IP para `/api/*`
- HTTP/2 habilitado no bloco HTTPS

---

## 4. Banco de Dados

### Tabelas compartilhadas (leitura para todos os usuários autenticados)

```sql
market_prices
├── id            UUID PK DEFAULT gen_random_uuid()
├── ticker        TEXT        -- "SB=F", "USDBRL=X", etc.
├── date          DATE
├── open          NUMERIC
├── high          NUMERIC
├── low           NUMERIC
├── close         NUMERIC
├── adj_close     NUMERIC
├── volume        BIGINT
└── created_at    TIMESTAMPTZ DEFAULT now()
UNIQUE(ticker, date)

market_coverage   -- controla o range já baixado por ticker
├── ticker        TEXT PK
├── first_date    DATE
└── last_date     DATE
-- Backfills concorrentes serializam via SELECT ... FOR UPDATE nessa linha

tickers_catalog   -- catálogo de ativos disponíveis
├── id            UUID PK DEFAULT gen_random_uuid()
├── ticker        TEXT UNIQUE
├── nome          TEXT        -- "Açúcar NY #11"
├── tipo          TEXT        -- "commodity", "fx", "acao", "indice"
├── status        TEXT        -- "pending", "approved", "rejected"
├── ativo         BOOLEAN DEFAULT true
├── adicionado_por UUID       -- user_id de quem sugeriu
├── review_note   TEXT        -- motivo de rejeição (opcional)
└── created_at    TIMESTAMPTZ DEFAULT now()
```

### Tabelas por usuário (RLS — user_id obrigatório)

```sql
simulations       -- histórico de simulações MC salvas
                  -- armazena percentis do dia final + série temporal para replay do fan chart
                  -- re-executar com os mesmos parâmetros NÃO garante resultado idêntico (estocástico)
├── id            UUID PK DEFAULT gen_random_uuid()
├── user_id       UUID REFERENCES auth.users
├── ticker        TEXT
├── preco_inicial NUMERIC
├── dias_simulados INT
├── num_simulacoes INT
├── pct_bound     NUMERIC
├── p5            NUMERIC     -- percentil do dia final
├── p20           NUMERIC
├── p25           NUMERIC
├── p50           NUMERIC
├── p75           NUMERIC
├── p80           NUMERIC
├── p95           NUMERIC
├── percentiles_series JSONB  -- [{day:1,p5:x,p25:x,p50:x,p75:x,p95:x}, ...] para replay do fan chart
├── label         TEXT        -- nome opcional
└── created_at    TIMESTAMPTZ DEFAULT now()

user_parameters   -- configs por usuário/ativo
├── id            UUID PK DEFAULT gen_random_uuid()
├── user_id       UUID REFERENCES auth.users
├── ticker        TEXT
├── volatilidade_custom    NUMERIC  -- BETWEEN 0 AND 5 (0% a 500%), validado no FastAPI
├── taxa_livre_risco       NUMERIC  -- BETWEEN -0.5 AND 1 (-50% a 100%), validado no FastAPI
├── pct_bound_preferido    NUMERIC  -- BETWEEN 0.05 AND 2 (5% a 200%), validado no FastAPI
└── updated_at    TIMESTAMPTZ DEFAULT now()
UNIQUE(user_id, ticker)

watchlist
├── user_id       UUID REFERENCES auth.users
├── ticker        TEXT
└── created_at    TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (user_id, ticker)
```

### Lógica de cache incremental (FastAPI — `market_cache.py`)

```
1. Recebe: ticker, date_start, date_end
2. Consulta market_coverage com SELECT ... FOR UPDATE (serializa concorrência)
3. Se ticker não existe no coverage → baixa de 2013-01-01 até date_end do yfinance, salva
4. Se date_end > last_date → baixa [last_date+1, date_end], faz append
5. Se date_start < first_date → baixa [date_start, first_date-1], faz prepend
6. Atualiza market_coverage (first_date, last_date)
7. Retorna de market_prices (sempre do banco, nunca direto do yfinance)
```

**Erros do yfinance:** se o download falhar (rate limit, ticker inválido, timeout), a função lança `HTTPException(502)` com mensagem descritiva. Nenhum dado parcial é salvo.

**Validação de novo ticker:** yfinance deve retornar pelo menos 30 linhas de dados. Se o histórico disponível for menor que 2013-01-01, o backfill aceita o range disponível e registra o `first_date` real em `market_coverage`.

**Backfill no approve:** executado como `BackgroundTasks` do FastAPI (assíncrono). O endpoint retorna imediatamente com o ticker marcado como `approved` em `tickers_catalog`. O backfill histórico ocorre em background. Um campo `backfill_status TEXT` (`"pending"`, `"done"`, `"failed"`) em `tickers_catalog` indica o progresso — o frontend exibe um badge de status na listagem de tickers.

---

## 5. Backend (FastAPI)

### Estrutura

```
backend/
├── main.py                   -- app, CORS, rotas
├── auth.py                   -- validação JWT (PyJWT + chave pública Supabase RS256)
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

### Validação JWT

- Algoritmo: **RS256**
- Chave pública: obtida de `SUPABASE_JWT_PUBLIC_KEY` (variável de ambiente)
- Biblioteca: `PyJWT`
- Claims validadas: `aud = "authenticated"`, `exp` (expiração automática pelo PyJWT)
- Role extraída de: `payload["app_metadata"]["role"]` — ausente = `"user"`

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

### Formato de erro padrão (todas as rotas)

```json
{ "detail": "Mensagem legível", "code": "ERROR_CODE" }
```

| Situação | HTTP | code |
|----------|------|------|
| JWT inválido / expirado | 401 | `UNAUTHORIZED` |
| Role insuficiente | 403 | `FORBIDDEN` |
| yfinance falhou | 502 | `MARKET_DATA_UNAVAILABLE` |
| Ticker não existe no yfinance | 422 | `INVALID_TICKER` |
| Erro interno | 500 | `INTERNAL_ERROR` |

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
  /* Literal — não usar var() aqui (Tailwind v4 resolve em parse time) */
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
│   ├── login/            -- Supabase Auth UI (email/senha)
│   └── callback/         -- reservado para OAuth futuro (não implementado nesta versão)
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

### Erros no frontend

- Erros de API exibidos com `Alert` (shadcn) inline — nunca alert() nativo
- Toast (shadcn `Sonner`) para confirmações de ação (salvo, aprovado, rejeitado)
- Estados de loading com `Skeleton` — nunca área em branco

### Sessão e refresh de token

- `@supabase/ssr` gerencia o ciclo de vida do JWT automaticamente (refresh silencioso antes do vencimento)
- Se o FastAPI retornar `401`, o cliente tenta refresh uma vez e reexecuta a chamada
- Se o refresh falhar, redireciona para `/login`
- Uvicorn configurado com `--workers 4` na VM (workers independentes — `SELECT ... FOR UPDATE` serializa no nível do PostgreSQL)

### Convenções visuais

- Tokens semânticos: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border` — nunca hex ad-hoc
- Geist Mono para preços, percentis, datas, IDs, métricas numéricas
- Lucide icons a `h-4 w-4` consistente em toda a interface
- `AlertDialog` para ações destrutivas (rejeitar ticker, deletar simulação)
- `Skeleton` + `Card` para estados de loading
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
└── Let's Encrypt (SSL automático via Certbot)

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

### Inicialização do schema

- Schema definido em `supabase/migrations/`
- Aplicado via `supabase db push` (Supabase CLI) antes do primeiro deploy
- Migrations versionadas no repositório

---

## 8. Controle de Acesso

| Role | Permissões |
|------|-----------|
| `user` | Login, simulações próprias, parâmetros próprios, watchlist, sugerir ticker, ver tickers aprovados |
| `admin` | Tudo do `user` + aprovar/rejeitar tickers pendentes |

### Como o role é definido

- Armazenado em `app_metadata.role` no Supabase Auth (não em `user_metadata`)
- Definido via **custom access token hook** no Supabase (função PostgreSQL que injeta o campo no JWT)
- Referência: [Supabase Docs — Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks#custom-access-token-hook)

### Bootstrap do primeiro admin

O primeiro admin deve ser provisionado manualmente via Supabase Dashboard:
1. Ir em Authentication → Users → selecionar o usuário
2. Editar `app_metadata` e adicionar `{ "role": "admin" }`

---

## 9. Variáveis de Ambiente

### Frontend (Next.js)

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Chave anon do Supabase |
| `NEXT_PUBLIC_API_URL` | Pública | URL base do FastAPI (ex: `https://app.ibea.com.br/api`) |

### Backend (FastAPI)

| Variável | Tipo | Descrição |
|----------|------|-----------|
| `SUPABASE_URL` | Secreta | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreta | Chave service role (acesso admin ao banco) |
| `SUPABASE_JWT_PUBLIC_KEY` | Secreta | Chave pública RS256 para validar JWTs (Project Settings → API) |
| `CORS_ORIGINS` | Config | Origins permitidos (ex: `https://app.ibea.com.br`) |

### CI/CD (GitHub Actions Secrets)

| Variável | Descrição |
|----------|-----------|
| `ORACLE_HOST` | IP da VM Oracle |
| `ORACLE_SSH_KEY` | Chave privada SSH para deploy |
| `ORACLE_USER` | Usuário SSH na VM |

---

## 10. Critérios de Aceite

| Feature | Critério |
|---------|----------|
| Autenticação | Usuário não autenticado é redirecionado para `/login` ao acessar qualquer rota `/app/*` |
| Autenticação | Login com email/senha válidos redireciona para `/dashboard` em menos de 3s |
| Cache de mercado | Segunda consulta ao mesmo ticker/range retorna do banco sem chamar o yfinance (verificável por logs) |
| Cache incremental | Consultar range estendido (+1 dia) acrescenta apenas o novo dia ao banco |
| Simulação MC | Usuário executa simulação e vê fan chart + métricas em menos de 15s com cold cache (ticker ausente em `market_coverage`, medido do clique no botão até o gráfico renderizado) |
| Histórico | Simulação salva aparece na aba "Histórico" sem recarregar a página |
| Sugestão de ticker | Ticker inválido no yfinance retorna erro visível antes de ser salvo |
| Fluxo admin — aprovação | Admin aprova ticker e ele aparece na lista de tickers com status `approved` imediatamente (antes do backfill concluir) |
| Fluxo admin — backfill | Após aprovação, `backfill_status` muda de `pending` para `done` em menos de 60s para tickers com menos de 2 anos de histórico |
| Isolamento de dados | Usuário A não consegue ver simulações do usuário B (RLS verificado via Supabase dashboard) |
| Tema | Toggle dark/light persiste após fechar e reabrir o browser |

---

## 11. Fora do Escopo

- App mobile
- Notificações / alertas de preço
- Integração com corretoras / execução de ordens
- Exportação de relatórios PDF
- Multi-tenancy (múltiplas empresas)
- Reprodutibilidade de simulações (random seed)
- Migração dos CSVs históricos existentes

---

## Aprovação

| Revisor | Data | Status |
|---------|------|--------|
| — | — | Pendente |
