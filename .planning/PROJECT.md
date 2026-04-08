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

### Active (v2.1 — Client Necessities)

- [ ] NAV-01: Ocultar 9 páginas da navegação (Metas, Jump Diffusion, Payoff Opções, Risco, Cenários, Relatório Focus, ARIMA Açúcar, ARIMA Dólar, Opções) do sidebar Next.js
- [ ] NAV-02: Rotas das páginas ocultas permanecem acessíveis via URL direta
- [ ] REG-01: FastAPI endpoint para Regressão Dólar (OLS, inputs: Selic, Fed Funds, Prod. Industrial BR/EUA, M2 BR/EUA)
- [ ] REG-02: Backend busca valores padrão de treino via BCB API (séries 432, 1837, 21859) e FRED API (FEDFUNDS, M2SL, INDPRO)
- [ ] REG-03: Modelo OLS retorna taxa prevista USD/BRL, R², RMSE, coeficientes, matriz de correlação
- [ ] REG-04: Runs de Regressão Dólar persistidos no Supabase (user_id, inputs, resultado, R²)
- [ ] REG-05: Página Next.js Regressão Dólar com inputs editáveis (defaults via API), resultados, heatmap, gráfico real vs previsto
- [ ] REG-06: FastAPI endpoint para Regressão Açúcar (Ridge/XGBoost selecionável, inputs: oferta/demanda, estoques, USDBRL, CL=F)
- [ ] REG-07: Backend busca preços padrão via yfinance (SB=F, USDBRL=X, CL=F); dados de oferta/demanda via inputs manuais com defaults USDA aproximados
- [ ] REG-08: Modelo retorna preço previsto SB=F com intervalo de incerteza, R², RMSE
- [ ] REG-09: Runs de Regressão Açúcar persistidos no Supabase
- [ ] REG-10: Página Next.js Regressão Açúcar com inputs editáveis, preço previsto com range, gráfico, histórico de runs

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
