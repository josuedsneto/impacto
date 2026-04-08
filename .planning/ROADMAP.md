# Roadmap: Impacto — Plataforma Escalável

## Milestones

- ✅ **v1.0 Streamlit Audit & Fix** — Phases v1-1 to v1-3 (shipped 2026-03-20)
- ✅ **v2.0 Plataforma Escalável** — Phases 1–12 (shipped 2026-04-01)
- ✅ **v2.1 Client Necessities** — Phases 13–15 (shipped 2026-04-07)
- 🚧 **v2.2 Melhorias do Cliente** — Phases 16+ (in progress)

## Phases

<details>
<summary>✅ v1.0 Streamlit Audit & Fix — SHIPPED 2026-03-20</summary>

- [x] v1-Phase-1: Monte Carlo Core — Fixed simulacao_monte_carlo() signature, bounds, call site
- [x] v1-Phase-2: Options Pricing — deferred (superseded by v2.0)
- [x] v1-Phase-3: Quant Audit — deferred (superseded by v2.0)

</details>

<details>
<summary>✅ v2.0 Plataforma Escalável — SHIPPED 2026-04-01</summary>

- [x] Phase 1: Infra & Schema (3/3 plans) — completed 2026-03-20
- [x] Phase 2: Auth (3/3 plans) — completed 2026-03-20
- [x] Phase 3: Market Cache (3/3 plans) — completed 2026-03-21
- [x] Phase 4: MC Simulation (3/3 plans) — completed 2026-03-21
- [x] Phase 5: Options & Pricing (2/2 plans) — completed 2026-03-21
- [x] Phase 6: Params & Watchlist (3/3 plans) — completed 2026-03-21
- [x] Phase 7: Admin (2/2 plans) — completed 2026-03-22
- [x] Phase 8: CI/CD & Polish (1/1 plan) — completed 2026-03-22
- [x] Phase 9: Fix MKT-03 + PARAM-01 (2/2 plans) — completed 2026-03-22
- [x] Phase 10: CI/CD Artifacts + ADM-01 + FOUC Fix (3/3 plans) — completed 2026-04-01
- [x] Phase 11: Login + Auth (1/1 plan) — completed 2026-04-01
- [x] Phase 12: Feature Pages (3/3 plans) — completed 2026-04-01

Full archive: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Client Necessities (Phases 13–15) — SHIPPED 2026-04-07</summary>

- [x] Phase 13: Navigation Cleanup (1/1 plan) — completed 2026-04-06
- [x] Phase 14: Regressão Dólar (2/2 plans) — completed 2026-04-07
- [x] Phase 15: Regressão Açúcar (2/2 plans) — completed 2026-04-07

See `.planning/milestones/v2.1-ROADMAP.md` for full details.

</details>

## v2.2 Melhorias do Cliente

### Phase 16: Correções Pontuais

**Goal:** Corrigir Volatilidade (verificar diária vs anualizada), Breakeven (adicionar campos de custo), e Black-Scholes (atualizar base de dados).

**Requirements:** VOL-01, BREAK-01, BS-01

**Plans:** 2/2 plans complete

Plans:
- [ ] 16-01-PLAN.md — Volatilidade: adicionar labels diária/anualizada com sqrt(252)
- [ ] 16-02-PLAN.md — Breakeven: campos de gasto fixo/variável; Black-Scholes: atualizar contrato SBK26 → SBN26/SBV26

---

### Phase 17: Validação Monte Carlo e VaR

**Goal:** Revisar os bastidores do cálculo do Monte Carlo (drift, bounds, paths) e validar a implementação atual do VaR.

**Requirements:** MC-01, VAR-01

**Plans:** 2/2 plans complete

Plans:
- [ ] 17-01-PLAN.md — Monte Carlo: corrigir drift GBM (mu - 0.5*sigma^2) e alinhar métricas P5/P50/P95
- [ ] 17-02-PLAN.md — VaR: adicionar cache yfinance, corrigir labels e exibir VaR como perda absoluta

---

### Phase 18: Fixações (ex-Mercado)

**Goal:** Renomear página "Mercado" para "Fixações" e adicionar indicadores de análise técnica: Estocástico Lento, RSI e Bollinger Bands com parâmetros configuráveis pelo usuário.

**Requirements:** FIX-01, FIX-02, FIX-03, FIX-04

**Plans:** 1/1 plans complete

Plans:
- [ ] 18-01-PLAN.md — Renomear para Fixações e expor parâmetros configuráveis de Estocástico Lento, RSI e Bollinger Bands

---

### Phase 19: Atualização Regressões

**Goal:** Atualizar base de dados de treino e revisar correlações dos modelos de Regressão Dólar e Regressão Açúcar.

**Requirements:** REG-01, REG-02

**Plans:** 2/2 plans complete

Plans:
- [ ] 19-01-PLAN.md - Regressao Dolar: dados live BCB/FRED + janela 72 meses
- [ ] 19-02-PLAN.md - Regressao Acucar: dados live yfinance + USDA 2025

---

### Phase 20: ATR — Açúcar Total Recuperável

**Goal:** Nova feature: simular ATR em função de Chuva e Impureza da cana, com histórico por usina persistido no Supabase, endpoint de regressão FastAPI e página Next.js completa.

**Requirements:** ATR-01, ATR-02, ATR-03, ATR-04, ATR-05

**Plans:** 3 plans

Plans:
- [ ] 20-01-PLAN.md — Migration Supabase: tabelas usinas, user_usinas e atr_simulacoes com RLS
- [ ] 20-02-PLAN.md — Backend FastAPI: módulo atr.py com calibração ATR + rotas /api/atr/* e /api/admin/usinas
- [ ] 20-03-PLAN.md — Frontend Next.js: página /app/atr com formulário, métricas, histórico e admin de usinas

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 13. Navigation Cleanup | v2.1 | 1/1 | Complete | 2026-04-06 |
| 14. Regressão Dólar | v2.1 | 2/2 | Complete | 2026-04-07 |
| 15. Regressão Açúcar | v2.1 | 2/2 | Complete | 2026-04-07 |
| 16. Correções Pontuais | 2/2 | Complete   | 2026-04-08 | — |
| 17. Validação MC + VaR | 2/2 | Complete    | 2026-04-08 | — |
| 18. Fixações | 1/1 | Complete    | 2026-04-08 | — |
| 19. Atualização Regressões | 2/2 | Complete    | 2026-04-08 | — |
| 20. ATR | v2.2 | 0/0 | Not started | — |

**v2.0 history:**

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infra & Schema | v2.0 | 3/3 | Complete | 2026-03-20 |
| 2. Auth | v2.0 | 3/3 | Complete | 2026-03-20 |
| 3. Market Cache | v2.0 | 3/3 | Complete | 2026-03-21 |
| 4. MC Simulation | v2.0 | 3/3 | Complete | 2026-03-21 |
| 5. Options & Pricing | v2.0 | 2/2 | Complete | 2026-03-21 |
| 6. Params & Watchlist | v2.0 | 3/3 | Complete | 2026-03-21 |
| 7. Admin | v2.0 | 2/2 | Complete | 2026-03-22 |
| 8. CI/CD & Polish | v2.0 | 1/1 | Complete | 2026-03-22 |
| 9. Fix MKT-03 + PARAM-01 | v2.0 | 2/2 | Complete | 2026-03-22 |
| 10. CI/CD Artifacts + FOUC | v2.0 | 3/3 | Complete | 2026-04-01 |
| 11. Login + Auth | v2.0 | 1/1 | Complete | 2026-04-01 |
| 12. Feature Pages | v2.0 | 3/3 | Complete | 2026-04-01 |
