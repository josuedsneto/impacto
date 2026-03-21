# Requirements: Impacto — Plataforma Escalável

**Defined:** 2026-03-20
**Core Value:** Simulações corretas e confiáveis acessíveis a múltiplos usuários com dados persistidos e autenticação robusta

## v1 Requirements (Milestone v2.0 — Plataforma)

### Autenticação

- [x] **AUTH-01**: Usuário pode fazer login com email e senha via Supabase Auth
- [x] **AUTH-02**: Sessão do usuário persiste após fechar e reabrir o browser
- [x] **AUTH-03**: Usuário não autenticado é redirecionado para /login ao acessar qualquer rota /app/*
- [x] **AUTH-04**: FastAPI valida JWT RS256 localmente sem round-trip ao Supabase
- [x] **AUTH-05**: Role admin/user é extraída do JWT (app_metadata.role) e aplicada nas rotas protegidas
- [x] **AUTH-06**: Frontend tenta refresh automático do token antes de redirecionar para /login

### Mercado

- [x] **MKT-01**: Segunda consulta ao mesmo ticker/range retorna do banco sem chamar o yfinance
- [x] **MKT-02**: Consultar range estendido (+1 dia) acrescenta apenas o novo dia ao banco
- [x] **MKT-03**: Usuário pode sugerir novo ticker; ticker inválido retorna erro visível antes de ser salvo
- [x] **MKT-04**: Backfill aceita range disponível se histórico menor que 2013-01-01

### Simulação MC

- [x] **SIM-01**: Usuário executa simulação MC e vê fan chart + métricas em menos de 15s com cold cache
- [x] **SIM-02**: Simulação salva aparece na aba "Histórico" sem recarregar a página
- [x] **SIM-03**: Fan chart pode ser replayed via percentis JSONB salvos
- [x] **SIM-04**: Usuário A não consegue ver simulações do usuário B (RLS)

### Opções e Pricing

- [x] **OPT-01**: Usuário pode construir estratégia multi-leg e ver o payoff diagram
- [x] **OPT-02**: Usuário pode configurar volatilidade customizada para o pricer Black-Scholes
- [x] **OPT-03**: Pricer European call via MC usa taxa livre de risco como drift

### Parâmetros e Watchlist

- [x] **PARAM-01**: Usuário pode configurar volatilidade, taxa livre de risco e pct_bound por ativo
- [x] **PARAM-02**: Configurações de parâmetros persistem entre sessões
- [x] **PARAM-03**: Usuário pode adicionar e remover tickers da watchlist
- [x] **PARAM-04**: Dashboard exibe preços ao vivo + watchlist do usuário

### Admin

- [x] **ADM-01**: Admin pode ver fila de tickers pendentes de aprovação
- [x] **ADM-02**: Admin aprova ticker e ele aparece na lista com status "approved" imediatamente
- [x] **ADM-03**: Após aprovação, backfill_status muda de "pending" para "done" em menos de 60s
- [x] **ADM-04**: Admin pode rejeitar ticker com nota explicativa

### Infraestrutura e Deploy

- [x] **INFRA-01**: Schema Supabase aplicado via migrations versionadas (supabase db push)
- [x] **INFRA-02**: Nginx roteia / para Next.js :3000 e /api/* para FastAPI :8000 com SSL Let's Encrypt
- [ ] **INFRA-03**: GitHub Actions faz deploy automático em merge na main
- [ ] **INFRA-04**: Toggle dark/light persiste após fechar e reabrir o browser

## v2 Requirements (Deferred)

### Notificações

- **NOTIF-01**: Usuário recebe alerta quando preço atinge nível configurado
- **NOTIF-02**: Relatório periódico automático por email

### Exportação

- **EXP-01**: Exportar simulação como PDF
- **EXP-02**: Exportar dados históricos como CSV

### Análise Avançada

- **ADV-01**: Páginas ARIMA corrigidas com diagnósticos de resíduos (da v1.0)
- **ADV-02**: VaR com múltiplas metodologias (da v1.0)
- **ADV-03**: Jump Diffusion, Stress Test migrados para a plataforma

## Out of Scope

| Feature | Reason |
|---------|--------|
| App mobile | Web-first; mobile requer esforço separado |
| OAuth social login | Email/senha suficiente para usuários internos |
| Integração com corretoras | Fora do escopo de análise |
| Multi-tenancy | Escopo: uma empresa, 20–100 usuários |
| Reprodutibilidade MC (random seed) | MC é estocástico por design |
| Migração dos CSVs históricos | yfinance é source of truth |
| ARIMA / VaR / Jump Diffusion na plataforma v2 | Migrar só MC + BS + payoff; demais ficam para v3 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| MKT-01 | Phase 3 | Complete |
| MKT-02 | Phase 3 | Complete |
| MKT-03 | Phase 3 | Complete |
| MKT-04 | Phase 3 | Complete |
| SIM-01 | Phase 4 | Complete |
| SIM-02 | Phase 4 | Complete |
| SIM-03 | Phase 4 | Complete |
| SIM-04 | Phase 4 | Complete |
| OPT-01 | Phase 5 | Complete |
| OPT-02 | Phase 5 | Complete |
| OPT-03 | Phase 5 | Complete |
| PARAM-01 | Phase 6 | Complete |
| PARAM-02 | Phase 6 | Complete |
| PARAM-03 | Phase 6 | Complete |
| PARAM-04 | Phase 6 | Complete |
| ADM-01 | Phase 7 | Complete |
| ADM-02 | Phase 7 | Complete |
| ADM-03 | Phase 7 | Complete |
| ADM-04 | Phase 7 | Complete |
| INFRA-03 | Phase 8 | Pending |
| INFRA-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after milestone v2.0 definition*
