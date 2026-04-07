# Requirements: Impacto v2.1 — Client Necessities

**Defined:** 2026-04-06
**Core Value:** Simulações corretas e confiáveis, acessíveis a 20–100 usuários internos, com dados persistidos e autenticação robusta.

## v2.1 Requirements

### Navigation

- [x] **NAV-01**: Usuário não vê as páginas Metas, Jump Diffusion, Payoff Opções, Risco, Cenários, Relatório Focus, ARIMA Açúcar, ARIMA Dólar e Opções no sidebar da navegação
- [x] **NAV-02**: As rotas das páginas ocultas continuam acessíveis via URL direta (rotas não deletadas)

### Regressão Dólar

- [x] **DOLAR-01**: Backend expõe endpoint POST `/api/regression/dolar/run` que recebe inputs de projeção e retorna taxa prevista USD/BRL, R², RMSE, coeficientes e matriz de correlação
- [x] **DOLAR-02**: Backend busca séries históricas mensais automaticamente via BCB API (Selic 432, M2 1837, Prod. Industrial 21859) e FRED API (FEDFUNDS, M2SL, INDPRO) para treinar o modelo OLS
- [x] **DOLAR-03**: Endpoint GET `/api/regression/dolar/defaults` retorna os valores mais recentes das séries para pré-preencher os inputs do frontend
- [x] **DOLAR-04**: Resultado de cada run é persistido na tabela `regression_runs` do Supabase (user_id, tipo, inputs JSONB, resultado JSONB, timestamp)
- [x] **DOLAR-05**: Página Next.js `/regressao-dolar` exibe inputs editáveis com defaults carregados da API, métricas do modelo (taxa prevista, R², RMSE), heatmap de correlação, gráfico real vs previsto e histórico de runs do usuário

### Regressão Açúcar

- [x] **ACUCAR-01**: Backend expõe endpoint POST `/api/regression/acucar/run` que recebe inputs de projeção (estoque inicial/final, produção, demanda, estoque/uso %, USD/BRL, CL=F) e retorna preço previsto SB=F com intervalo de incerteza, R², RMSE
- [x] **ACUCAR-02**: Endpoint suporta seleção de modelo: Ridge Regression (padrão) ou XGBoost
- [x] **ACUCAR-03**: Backend busca preços padrão mais recentes via yfinance (SB=F, USDBRL=X, CL=F); dados anuais de oferta/demanda são defaults USDA aproximados embutidos no backend
- [x] **ACUCAR-04**: Endpoint GET `/api/regression/acucar/defaults` retorna preços yfinance recentes e defaults de oferta/demanda
- [x] **ACUCAR-05**: Resultado de cada run é persistido em `regression_runs` (mesmo schema de DOLAR-04, campo `tipo` = "acucar")
- [ ] **ACUCAR-06**: Página Next.js `/regressao-acucar` exibe inputs editáveis com defaults carregados da API, preço previsto SB=F com range mín/máx, R², RMSE, gráfico de preço histórico vs previsto e histórico de runs do usuário

## v2.2 Requirements (deferred)

- Testes end-to-end automatizados (Playwright ou Cypress)
- Rate limiting nas rotas de simulação
- Notificações de preço via email
- Exportação de relatório PDF por simulação
- Onboarding: tela de boas-vindas para novos usuários
- Integração com USDA PSD API para dados reais de oferta/demanda de açúcar

## Out of Scope

| Feature | Reason |
|---------|---------|
| Deletar rotas das páginas ocultas | Cliente pode querer reativar futuramente; ocultar na nav é suficiente |
| Regressão com dados de corretoras | Fora do escopo da plataforma |
| API key do FRED no frontend | Segurança — chamadas ao FRED ficam exclusivamente no backend |
| Reprodutibilidade de modelos (seed) | Não solicitado pelo cliente |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 13 | Complete |
| NAV-02 | Phase 13 | Complete |
| DOLAR-01 | Phase 14 | Complete |
| DOLAR-02 | Phase 14 | Complete |
| DOLAR-03 | Phase 14 | Complete |
| DOLAR-04 | Phase 14 | Complete |
| DOLAR-05 | Phase 14 | Complete |
| ACUCAR-01 | Phase 15 | Complete |
| ACUCAR-02 | Phase 15 | Complete |
| ACUCAR-03 | Phase 15 | Complete |
| ACUCAR-04 | Phase 15 | Complete |
| ACUCAR-05 | Phase 15 | Complete |
| ACUCAR-06 | Phase 15 | Pending |

**Coverage:**
- v2.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
