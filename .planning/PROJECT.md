# Impacto — Plataforma Escalável

## What This Is

Impacto é uma plataforma web multiusuário para análise de ativos brasileiros (açúcar NY, USD/BRL). Oferece simulações Monte Carlo, pricing de opções, análise de risco (VaR, stress test, volatilidade), previsões ARIMA, e monitoramento de mercado com autenticação Supabase, backend FastAPI e frontend Next.js deployado em Oracle Cloud.

## Core Value

Simulações corretas e confiáveis, acessíveis a 20–100 usuários internos simultaneamente, com dados persistidos e autenticação robusta.

## Current Milestone: v2.1 UX Polish & Reliability

**Goal:** Tornar a plataforma mais usável em mobile, mais confiável em falhas, e com ferramentas de exportação e monitoramento para traders e gestores de usina.

**Target features:**
- Responsividade mobile e loading skeletons
- Error states com retry em falhas de API
- Exportação PDF/CSV de simulações, VaR e breakeven
- Histórico completo de simulações
- Alertas de preço configuráveis
- Cenários comparativos lado a lado
- Testes E2E automatizados + error handling global no backend

## Current State (v2.0 — shipped 2026-04-01)

**Stack:** Next.js 16 (App Router, shadcn/ui new-york/zinc) + FastAPI + Supabase (PostgreSQL + Auth JWT RS256) + Oracle Cloud VM (Nginx + PM2 + GitHub Actions CI/CD)

**Shipped in v2.0:**
- Autenticação completa: email+senha + magic link, JWT RS256, middleware route guard, roles admin/user
- Cache incremental de preços de mercado via yfinance → PostgreSQL
- Simulação MC com histórico persistido e replay de fan chart (percentis JSONB)
- Opções: payoff diagram builder, Black-Scholes, MC pricer com volatilidade customizável por usuário
- Parâmetros por usuário/ativo + watchlist
- Admin: aprovação/rejeição de tickers com backfill assíncrono + config de sistema
- Deploy automatizado via GitHub Actions → Oracle Cloud VM
- 7 páginas analíticas: Focus/BCB, VaR, Breakeven, ARIMA, Stress Test, Notícias, Volatilidade
- ~6.900 LOC (TypeScript/Python), 12 fases, 29 planos

## Requirements

### Validated (v1.0 — Streamlit Audit & Fix)

- ✓ Monte Carlo preco_inicial corrigido — v1.0
- ✓ Bounds relativos ao preço do ativo (PCT_BOUND=0.50) — v1.0
- ✓ Fan chart P5–P95 produz cone correto — v1.0
- ✓ Multi-page Streamlit app com login guard — v1.0
- ✓ yfinance data loading com caching — v1.0
- ✓ Black-Scholes pricer — v1.0
- ✓ European call pricer via MC — v1.0
- ✓ Options payoff diagram builder — v1.0

### Validated (v2.0 — Plataforma Escalável)

- ✓ Login email/senha + magic link via Supabase Auth — v2.0
- ✓ JWT RS256 validado no FastAPI sem round-trip ao Supabase — v2.0
- ✓ Cache incremental: segunda consulta retorna do banco — v2.0
- ✓ Simulação MC executada via API e resultado salvo no histórico — v2.0
- ✓ Fan chart replay via percentis JSONB salvos — v2.0
- ✓ Black-Scholes com volatilidade customizável por usuário — v2.0
- ✓ Admin pode aprovar/rejeitar tickers com backfill assíncrono — v2.0
- ✓ Deploy automatizado via GitHub Actions na Oracle Cloud VM — v2.0
- ✓ Páginas analíticas: Focus, VaR, Breakeven, ARIMA, Stress, Notícias, Volatilidade — v2.0

### Active (v2.1 — UX Polish & Reliability)

- [ ] Responsividade mobile — layouts adaptam a telas pequenas
- [ ] Loading skeletons — placeholders durante fetch de dados
- [ ] Error states — mensagens de erro + botão de retry em falhas de API
- [ ] Exportação PDF/CSV — resultados de simulação, VaR, breakeven
- [ ] Histórico de simulações — página completa com replay de análises passadas
- [ ] Alertas de preço — notificações email quando ativo cruza threshold
- [ ] Cenários comparativos — visualização lado a lado de duas simulações
- [ ] Testes E2E automatizados — smoke tests frontend + backend
- [ ] Error handling global no backend — handler estruturado + logging

### Out of Scope

- App mobile — web-first
- Integração com corretoras / execução de ordens
- Multi-tenancy (múltiplas empresas)
- Reprodutibilidade de simulações (random seed)
- Migração dos CSVs históricos existentes — yfinance é source of truth
- OAuth social login — email/senha + magic link suficientes

## Context

- Ativos: Açúcar NY #11 (SB=F, ~18–20 cents/lb) e USD/BRL (~5.0)
- MC: 10.000 paths, numpy cumprod vetorizado, drift risk-neutral para opções
- Supabase: PostgreSQL + Auth (JWT RS256) + RLS em todas as tabelas user-owned
- Oracle Cloud Always Free: ARM Ampere A1, 4 vCPUs, 24GB RAM, Ubuntu 22.04
- Frontend: Geist (Sans + Mono), shadcn/ui new-york, dark mode padrão
- admin_config table: configurações globais editáveis pelo admin (ex: fator de conversão breakeven)

## Constraints

- **Deploy**: Oracle Cloud Always Free — sem custo, capacidade para 20–100 usuários
- **Backend**: FastAPI + Python — reutiliza 100% da lógica quant existente
- **Banco**: Supabase gerenciado (não self-hosted)
- **Language**: UI e variáveis em português; código em inglês

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Audit-first, then fix (v1.0) | Identificar gaps antes da implementação | ✓ Good |
| Risk-neutral drift para options MC | Financeiramente correto para derivativos | ✓ Good |
| PCT_BOUND=0.50 para bounds do MC | ±50% do preço atual evita truncar o cone GBM | ✓ Good |
| FastAPI valida JWT localmente (PyJWT + RS256) | Sem round-trip ao Supabase, latência mínima | ✓ Good |
| Cache-aside incremental no PostgreSQL | Reduz chamadas ao yfinance, histórico persistido | ✓ Good |
| Oracle Cloud Always Free para deploy | Zero custo, 4 vCPUs / 24GB suficientes para 100 usuários | ✓ Good |
| Next.js App Router + shadcn/ui new-york | Ecossistema React moderno, reutilizável | ✓ Good |
| proxy.ts (Next.js 16) + middleware.ts re-export | Next.js 16 convention; proxy.ts runs on Node.js runtime | ✓ Good |
| AdminConfig como componente client separado | Preserva server-side auth guard no page.tsx | ✓ Good |
| ARIMA(1,1,1) com try/except + 400 response | Modelo robusto para séries financeiras, falha graciosamente | ✓ Good |
| admin_config table para parâmetros globais | Admins ajustam fator de conversão sem redeploy | ✓ Good |

---
*Last updated: 2026-04-04 after milestone v2.1 started*
