# Impacto — Plataforma Escalável

## What This Is

Impacto é uma plataforma web multiusuário para análise de ativos brasileiros (açúcar NY, USD/BRL). Oferece simulações Monte Carlo, pricing de opções, análise de risco (VaR, stress test, volatilidade), previsões ARIMA, e monitoramento de mercado com autenticação Supabase, backend FastAPI e frontend Next.js deployado em Oracle Cloud.

## Core Value

Simulações corretas e confiáveis, acessíveis a 20–100 usuários internos simultaneamente, com dados persistidos e autenticação robusta.

## Current Milestone: v2.2 — Melhorias do Cliente

**Goal:** Atender segunda rodada de feedback do cliente — corrigir módulos existentes (Volatilidade, Breakeven, Black-Scholes), validar MC e VaR, evoluir Mercado→Fixações com indicadores técnicos, atualizar regressões e implementar nova feature ATR.

**Target features:**
- Correções pontuais: Volatilidade (diária/anual), Breakeven (custos), Black-Scholes (base)
- Validação: Monte Carlo (bastidores), VaR (metodologia)
- Fixações: rename + Estocástico Lento, RSI, Bollinger Bands
- Regressões: atualização de dados e correlações
- ATR: nova feature completa (Açúcar Total Recuperável por usina)

## Current State (v2.1 — shipped 2026-04-07)

**Stack:** Next.js 16 (App Router, shadcn/ui new-york/zinc) + FastAPI + Supabase (PostgreSQL + Auth JWT RS256) + Oracle Cloud VM (Nginx + PM2 + GitHub Actions CI/CD)

**Shipped in v2.1:**
- 9 páginas ocultadas do sidebar (rotas preservadas): Metas, Jump Diffusion, Payoff Opções, Risco, Cenários, Relatório Focus, ARIMA Açúcar, ARIMA Dólar, Opções
- Regressão Dólar: OLS com BCB + FRED, tabela `regression_runs`, página com heatmap e histórico
- Regressão Açúcar: Ridge/XGBoost com yfinance + USDA defaults, página com range e histórico

**Shipped in v2.0:**
- Autenticação completa: email+senha + magic link, JWT RS256, middleware route guard, roles admin/user
- Cache incremental de preços de mercado via yfinance → PostgreSQL
- Simulação MC com histórico persistido e replay de fan chart (percentis JSONB)
- Opções: payoff diagram builder, Black-Scholes, MC pricer com volatilidade customizável por usuário
- Parâmetros por usuário/ativo + watchlist
- Admin: aprovação/rejeição de tickers com backfill assíncrono + config de sistema
- Deploy automatizado via GitHub Actions → Oracle Cloud VM
- 7 páginas analíticas: Focus/BCB, VaR, Breakeven, ARIMA, Stress Test, Notícias, Volatilidade

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

### Validated (v2.1 — Client Necessities)

- ✓ NAV-01: 9 páginas ocultas do sidebar Next.js — v2.1
- ✓ NAV-02: Rotas das páginas ocultas acessíveis via URL — v2.1
- ✓ REG-01 a REG-10: Regressão Dólar (OLS + BCB/FRED) e Regressão Açúcar (Ridge/XGBoost + yfinance/USDA) com histórico Supabase e páginas Next.js — v2.1

### Validated (v2.2 — Melhorias do Cliente)

- ✓ VOL-01: Volatilidade exibe EWMA e GARCH diária e anualizada (sqrt(252)) com labels claros — v2.2
- ✓ BREAK-01: Breakeven com campos configuráveis Gasto Fixo Total e Gasto Variável por Unidade — v2.2
- ✓ BS-01: Black-Scholes atualizado para SBN26/SBV26 (contratos não expirados) com sigma editável — v2.2
- ✓ MC-01: Monte Carlo validado — drift GBM correto (mu - 0.5*sigma^2), PCT_BOUND=0.50, 10k paths — v2.2
- ✓ VAR-01: VaR paramétrico EWMA validado — z-score left-tail, cache yfinance, VaR exibido como perda positiva — v2.2
- ✓ FIX-01 a FIX-04: Página Mercado renomeada para Fixações com Estocástico Lento, RSI e Bollinger Bands configuráveis — v2.2
- ✓ REG-01 a REG-02 (v2.2): Regressões atualizadas com dados live BCB/FRED/yfinance + USDA 2025 — v2.2
- ✓ ATR-01 a ATR-05: Feature ATR completa — Supabase (usinas/atr_simulacoes + RLS), FastAPI (OLS calibration + 5 rotas), Next.js (/app/atr com form, métricas, histórico, admin) — v2.2

### Active (v2.3 — next milestone)

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
*Last updated: 2026-04-06 after v2.1 milestone started — client necessities*
