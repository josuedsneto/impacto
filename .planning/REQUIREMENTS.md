# Requirements: Impacto v2.2 — Melhorias do Cliente

**Defined:** 2026-04-07
**Core Value:** Simulações corretas e confiáveis, acessíveis a 20–100 usuários internos, com dados persistidos e autenticação robusta.

## v2.2 Requirements

### Volatilidade

- [x] **VOL-01**: Verificar e documentar se o resultado exibido na página Volatilidade é diário ou anualizado; corrigir cálculo e label se necessário (cliente quer clareza sobre o parâmetro)

### Breakeven

- [x] **BREAK-01**: Adicionar campos de input na página Breakeven: "Gasto Fixo Total" e "Gasto Variável por Unidade"; integrar esses valores ao cálculo existente

### Black-Scholes

- [x] **BS-01**: Atualizar fonte de dados da página Black-Scholes (ticker/séries) para refletir base de dados atual do projeto

### Monte Carlo

- [x] **MC-01**: Revisar os bastidores do cálculo Monte Carlo: validar drift (histórico vs risk-neutral), bounds (PCT_BOUND), número de caminhos e parâmetros; confirmar ou corrigir se necessário

### VaR

- [x] **VAR-01**: Validar a implementação atual do VaR: revisar metodologia (histórico/paramétrico), horizonte de tempo, nível de confiança e apresentação dos resultados

### Fixações (ex-Mercado)

- [x] **FIX-01**: Renomear página "Mercado" para "Fixações" (rota, nav link, título)
- [x] **FIX-02**: Adicionar Estocástico Lento com períodos configuráveis pelo usuário (%K, %D)
- [x] **FIX-03**: Adicionar RSI com período configurável pelo usuário
- [x] **FIX-04**: Adicionar Bollinger Bands com períodos e desvio padrão configuráveis pelo usuário

### Regressões (atualização)

- [x] **REG-01**: Atualizar base de dados de treino da Regressão Dólar — revisar séries BCB/FRED, janela temporal e correlações do modelo OLS
- [x] **REG-02**: Atualizar base de dados de treino da Regressão Açúcar — revisar dados USDA embutidos, séries yfinance e correlações dos modelos Ridge/XGBoost

### ATR — Açúcar Total Recuperável

- [ ] **ATR-01**: Criar tabelas Supabase `usinas` (id, nome, created_at), `user_usinas` (user_id, usina_id) e `atr_simulacoes` (id, user_id, usina_id, chuva_mm, impureza_pct, atr_min, atr_esperado, atr_max, producao_total, compartilhado, created_at) com RLS por user_id. Admin gerencia usinas via service_role; usuários autenticados podem ler a lista de usinas; `atr_simulacoes` isola por user_id e expõe simulações com `compartilhado=true` para membros da mesma usina.
- [ ] **ATR-02**: Backend FastAPI: endpoints para listagem de usinas do usuário, simulação ATR (com calibração automática usando simulações anteriores como proxy de histórico real — não upload de dados externos), e listagem do histórico de simulações por usina. Calibração: usa `atr_esperado` das simulações salvas como `atr_real` proxy para recalibrar o modelo OLS/Ridge; defaults do setor (Consecana/Unica) quando há menos de 5 pontos. Admin pode criar, deletar usinas e associar usuários via rotas `/api/admin/usinas`.
- [ ] **ATR-03**: Modelo de regressão: dado histórico de Chuva (mm) e Impureza (%) da cana, estimar ATR; Ridge ou OLS dependendo do volume de dados disponíveis por usina
- [ ] **ATR-04**: Endpoint de simulação: receber Chuva e Impureza projetadas, retornar ATR previsto com intervalo de confiança para a usina selecionada
- [ ] **ATR-05**: Página Next.js `/atr`: seletor de usina, inputs Chuva + Impureza + Volume de Moagem (opcional), exibição de ATR previsto com intervalo de confiança (min/esperado/max), aba Histórico com gráfico de tendência de ATR ao longo do tempo (eixo X = data das simulações, eixo Y = atr_esperado com banda min/max) e tabela de simulações com badge "Compartilhado". Não inclui upload de dados históricos reais nem gráfico "real vs previsto" — esses não se aplicam ao design (calibração usa simulações passadas como proxy). Inclui seção de gestão de usinas no painel admin.

## Out of Scope

| Feature | Reason |
|---------|---------|
| Deletar rotas das páginas ocultas | Mantidas para possível reativação futura |
| Integração com APIs de corretoras | Fora do escopo da plataforma |
| ATR multi-usina simultâneo | Complexidade desnecessária — seleção por usina é suficiente |
| Integração com USDA PSD API (açúcar) | Adiado — defaults embutidos são suficientes por ora |
| Upload de dados históricos reais de ATR | Não necessário — calibração usa simulações passadas como proxy |
| Gráfico "real vs previsto" ATR | Não se aplica ao design — apenas tendência de ATR ao longo do tempo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOL-01 | Phase 16 | Not started |
| BREAK-01 | Phase 16 | Not started |
| BS-01 | Phase 16 | Not started |
| MC-01 | Phase 17 | Not started |
| VAR-01 | Phase 17 | Not started |
| FIX-01 | Phase 18 | Not started |
| FIX-02 | Phase 18 | Not started |
| FIX-03 | Phase 18 | Not started |
| FIX-04 | Phase 18 | Not started |
| REG-01 | Phase 19 | Not started |
| REG-02 | Phase 19 | Not started |
| ATR-01 | Phase 20 | Not started |
| ATR-02 | Phase 20 | Not started |
| ATR-03 | Phase 20 | Not started |
| ATR-04 | Phase 20 | Not started |
| ATR-05 | Phase 20 | Not started |

**Coverage:**
- v2.2 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-07*
*Source: análise do cliente GSA — itens 1, 3, 4, 7, 8, 10, 11, 13 (ficam com mudanças)*
*ATR-01, ATR-02, ATR-05 revised 2026-04-08: upload de histórico removido; calibração via proxy de simulações; gráfico é tendência, não real vs previsto.*
