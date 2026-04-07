# Roadmap: Impacto — Plataforma Escalável

## Milestones

- ✅ **v1.0 Streamlit Audit & Fix** — Phases v1-1 to v1-3 (shipped 2026-03-20)
- ✅ **v2.0 Plataforma Escalável** — Phases 1–12 (shipped 2026-04-01)
- 📋 **v2.1 Client Necessities** — Phases 13–15 (in progress)

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
- [x] Phase 7: Admin (2/2 plans) — completed 2026-03-21
- [x] Phase 8: CI/CD & Polish (1/1 plan) — completed 2026-03-22
- [x] Phase 9: Fix MKT-03 + PARAM-01 (2/2 plans) — completed 2026-03-22
- [x] Phase 10: CI/CD Artifacts + ADM-01 + FOUC Fix (3/3 plans) — completed 2026-04-01
- [x] Phase 11: Login + Auth (1/1 plan) — completed 2026-04-01
- [x] Phase 12: Feature Pages (3/3 plans) — completed 2026-04-01

Full archive: `.planning/milestones/v2.0-ROADMAP.md`

</details>

## v2.1 Client Necessities

### Phase 13: Navigation Cleanup

**Goal:** Ocultar 9 páginas da navegação do sidebar Next.js, mantendo as rotas acessíveis via URL direta.

**Requirements:** NAV-01, NAV-02

**Success criteria:**
1. Sidebar não exibe: Metas, Jump Diffusion, Payoff Opções, Risco, Cenários, Relatório Focus, ARIMA Açúcar, ARIMA Dólar, Opções
2. Acessar as URLs dessas páginas diretamente continua funcionando
3. Nenhuma rota foi deletada — apenas removida do componente de navegação

**Plans:** 1/1 plans complete

Plans:
- [x] 13-01-PLAN.md — Audit and verify nav exclusions in layout.tsx + human sign-off (completed 2026-04-06)

---

### Phase 14: Regressão Dólar

**Goal:** Endpoint FastAPI OLS com dados do BCB e FRED, tabela Supabase `regression_runs`, e página Next.js com inputs editáveis, resultados e histórico.

**Requirements:** DOLAR-01, DOLAR-02, DOLAR-03, DOLAR-04, DOLAR-05

**Success criteria:**
1. `POST /api/regression/dolar/run` retorna `{ taxa_prevista, r2, rmse, coeficientes, correlacao }` com inputs do usuário
2. `GET /api/regression/dolar/defaults` retorna os valores mais recentes das séries BCB + FRED
3. Modelo OLS treinado em dados mensais históricos (mínimo 24 meses) via APIs externas
4. Run salvo em `regression_runs` com user_id, tipo="dolar", inputs JSONB, resultado JSONB
5. Página `/regressao-dolar` pré-preenche inputs com defaults, exibe taxa prevista + R² + RMSE, heatmap de correlação, gráfico de coeficientes do modelo OLS, e lista de runs anteriores do usuário

**Plans:** 2/2 plans complete

Plans:
- [x] 14-01-PLAN.md — Supabase migration (regression_runs) + FastAPI OLS backend (BCB/FRED data, run + defaults endpoints) (completed 2026-04-07)
- [x] 14-02-PLAN.md — Next.js page /regressao-dolar with DolarForm, DolarMetrics, DolarCharts components + nav link (completed 2026-04-07)

---

### Phase 15: Regressão Açúcar

**Goal:** Endpoint FastAPI Ridge/XGBoost com dados yfinance + defaults USDA, tabela Supabase reutilizada, e página Next.js com inputs editáveis, preço previsto com range e histórico.

**Requirements:** ACUCAR-01, ACUCAR-02, ACUCAR-03, ACUCAR-04, ACUCAR-05, ACUCAR-06

**Success criteria:**
1. `POST /api/regression/acucar/run` aceita `model` ("ridge" | "xgboost") e inputs anuais, retorna `{ sb_f_previsto, sb_f_min, sb_f_max, r2, rmse }`
2. `GET /api/regression/acucar/defaults` retorna preços yfinance mais recentes (SB=F, USDBRL=X, CL=F) + defaults USDA de oferta/demanda
3. Modelo treinado em dados anuais históricos (yfinance 2014–hoje + defaults USDA embutidos)
4. Run salvo em `regression_runs` com tipo="acucar"
5. Página `/regressao-acucar` pré-preenche inputs, exibe preço previsto SB=F com intervalo (mín/máx), R², RMSE, gráfico e histórico de runs

**Plans:** 1/2 plans executed

Plans:
- [ ] 15-01-PLAN.md — FastAPI backend: get_acucar_defaults + fetch_acucar_history + run_acucar_regression (Ridge/XGBoost) + two auth-guarded routes
- [ ] 15-02-PLAN.md — Next.js page /regressao-acucar with AcucarForm, AcucarMetrics, AcucarCharts + nav link + human verify checkpoint

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 13. Navigation Cleanup | v2.1 | Complete    | 2026-04-07 | 2026-04-06 |
| 14. Regressão Dólar | v2.1 | Complete    | 2026-04-07 | 2026-04-07 |
| 15. Regressão Açúcar | 1/2 | In Progress|  | — |

**v2.0 history:**

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Infra & Schema | v2.0 | 3/3 | Complete | 2026-03-20 |
| 2. Auth | v2.0 | 3/3 | Complete | 2026-03-20 |
| 3. Market Cache | v2.0 | 3/3 | Complete | 2026-03-21 |
| 4. MC Simulation | v2.0 | 3/3 | Complete | 2026-03-21 |
| 5. Options & Pricing | v2.0 | 2/2 | Complete | 2026-03-21 |
| 6. Params & Watchlist | v2.0 | 3/3 | Complete | 2026-03-21 |
| 7. Admin | v2.0 | 2/2 | Complete | 2026-03-21 |
| 8. CI/CD & Polish | v2.0 | 1/1 | Complete | 2026-03-22 |
| 9. Fix MKT-03 + PARAM-01 | v2.0 | 2/2 | Complete | 2026-03-22 |
| 10. CI/CD Artifacts + FOUC | v2.0 | 3/3 | Complete | 2026-04-01 |
| 11. Login + Auth | v2.0 | 1/1 | Complete | 2026-04-01 |
| 12. Feature Pages | v2.0 | 3/3 | Complete | 2026-04-01 |
