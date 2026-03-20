# Impacto — Plataforma Escalável

## What This Is

Impacto é uma plataforma web para simulações Monte Carlo, pricing de opções e análise de ativos brasileiros (açúcar NY, USD/BRL). O milestone atual transforma o app Streamlit single-user em uma plataforma multiusuário com frontend Next.js, backend FastAPI e banco Supabase, deployada em Oracle Cloud (Always Free).

## Core Value

Simulações corretas e confiáveis, acessíveis a 20–100 usuários internos simultaneamente, com dados persistidos e autenticação robusta.

## Current Milestone: v2.0 — Plataforma Escalável

**Goal:** Transformar o app Streamlit em plataforma web moderna com Next.js + FastAPI + Supabase, com autenticação, cache de mercado incremental e todas as páginas quantitativas migradas.

**Target features:**
- Autenticação Supabase (email/senha, JWT RS256, roles admin/user)
- Cache incremental de preços de mercado via yfinance → PostgreSQL
- Simulação MC com histórico salvo e replay de fan chart
- Opções: payoff diagram + Black-Scholes com volatilidade customizável
- Parâmetros por usuário/ativo + watchlist
- Admin: aprovação/rejeição de tickers com backfill assíncrono
- Deploy Oracle Cloud VM: Nginx + SSL + PM2 + GitHub Actions CI/CD

## Requirements

### Validated (v1.0 — Streamlit Audit & Fix)

- ✓ Monte Carlo preco_inicial corrigido para usar valor do usuário — Phase 1
- ✓ Bounds relativos ao preço do ativo (PCT_BOUND=0.50) — Phase 1
- ✓ Fan chart P5–P95 produz cone correto — Phase 1
- ✓ Multi-page Streamlit app com login guard — existente
- ✓ yfinance data loading com caching — existente
- ✓ Black-Scholes pricer (13_Black_Scholes.py) — existente
- ✓ European call pricer via MC (23_Opções.py) — existente
- ✓ Options payoff diagram builder (08_Payoff_Opções.py) — existente

### Active (v2.0)

- [ ] Usuário pode fazer login com email/senha via Supabase Auth
- [ ] JWT RS256 validado no FastAPI sem round-trip ao Supabase
- [ ] Cache incremental: segunda consulta ao mesmo ticker/range retorna do banco
- [ ] Simulação MC executada via API e resultado salvo no histórico do usuário
- [ ] Fan chart replay via percentis JSONB salvos
- [ ] Black-Scholes com volatilidade customizável por usuário
- [ ] Admin pode aprovar/rejeitar tickers com backfill assíncrono
- [ ] Deploy automatizado via GitHub Actions na Oracle Cloud VM

### Out of Scope

- App mobile — web-first
- Notificações / alertas de preço — fora do escopo v2
- Integração com corretoras / execução de ordens — fora do escopo
- Exportação PDF — fora do escopo
- Multi-tenancy (múltiplas empresas) — fora do escopo
- Reprodutibilidade de simulações (random seed) — fora do escopo
- Migração dos CSVs históricos existentes — yfinance é source of truth
- OAuth social login — email/senha suficiente para v2

## Context

- Ativos: Açúcar NY #11 (SB=F, ~18–20 cents/lb) e USD/BRL (~5.0)
- Range histórico mínimo: 2013-01-01 (usado na função baixar_dados_mc atual)
- MC: 10.000 paths, numpy cumprod vetorizado
- Supabase: PostgreSQL + Auth (JWT RS256) + RLS
- Oracle Cloud Always Free: ARM Ampere A1, 4 vCPUs, 24GB RAM, Ubuntu 22.04
- Frontend usa Geist (Sans + Mono), shadcn/ui new-york, tema dark por padrão

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
| FastAPI valida JWT localmente (PyJWT + chave pública RS256) | Sem round-trip ao Supabase, latência mínima | — Pending |
| Cache-aside incremental no PostgreSQL | Reduz chamadas ao yfinance, histórico persistido | — Pending |
| Oracle Cloud Always Free para deploy | Zero custo, 4 vCPUs / 24GB suficientes para 100 usuários | — Pending |
| Next.js App Router + shadcn/ui new-york | Ecossistema React moderno, reutilizável | — Pending |

---
*Last updated: 2026-03-20 after milestone v2.0 start*
