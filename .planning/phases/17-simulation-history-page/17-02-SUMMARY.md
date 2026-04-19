---
phase: 17-simulation-history-page
plan: "02"
subsystem: ui
tags: [streamlit, yfinance, scipy, VaR, EWMA, risk]

requires: []
provides:
  - "VaR paramétrico EWMA com cache no download yfinance, z-score left-tail documentado, VaR exibido como perda positiva, e label Vol. EWMA Diária mostrando a volatilidade efetivamente usada"
affects: []

tech-stack:
  added: []
  patterns:
    - "@st.cache_data(ttl=3600) em funções de download yfinance para evitar re-download a cada interação"
    - "z_score = norm.ppf(1 - confianca/100) com comentário explícito sobre left-tail"
    - "VaR exibido como abs() para representar perda positiva ao usuário"

key-files:
  created: []
  modified:
    - pages/15_VaR.py

key-decisions:
  - "z_score = norm.ppf(1 - confianca/100): resultado idêntico ao original mas intenção de left-tail agora explícita com comentário"
  - "ewma_vol_final retornado por calcular_var() para exibir a volatilidade EWMA diária efetivamente usada, não std bruto histórico"
  - "abs(VaR_EWMA) na exibição: VaR é uma perda esperada, deve ser apresentada como valor positivo"

patterns-established:
  - "Funções de download yfinance sempre decoradas com @st.cache_data(ttl=3600)"

requirements-completed: [VAR-01]

duration: 5min
completed: 2026-04-08
---

# Phase 17 Plan 02: VaR EWMA Cache, Z-Score e Labels Summary

**VaR paramétrico EWMA corrigido: cache no yfinance, z-score left-tail documentado, perda exibida como abs() e label Vol. EWMA Diária mostrando a volatilidade real do cálculo**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-08T00:00:00Z
- **Completed:** 2026-04-08T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extraído download yfinance para função `baixar_dados_var()` com `@st.cache_data(ttl=3600)` — elimina re-download a cada interação com slider/selectbox
- Corrigido z_score para `norm.ppf(1 - confianca/100)` com comentário explícito de left-tail
- `calcular_var()` agora retorna `ewma_vol_final` (5 valores) para expor a volatilidade EWMA diária usada no cálculo
- Métrica "VaR (Perda Máx.)" exibe `abs(VaR_EWMA)` — perda como valor positivo
- Label "Volatilidade Histórica" substituído por "Vol. EWMA Diária" mostrando a EWMA vol efetivamente usada

## Task Commits

1. **Task 1: Adicionar cache e corrigir z-score, labels e exibição do VaR** - `29b1e09` (feat)

**Plan metadata:** (docs commit — próximo)

## Files Created/Modified
- `pages/15_VaR.py` - Cache adicionado, z-score corrigido, 5o valor de retorno em calcular_var(), labels e abs() na exibição do VaR

## Decisions Made
- z_score = norm.ppf(1 - confianca/100): resultado numericamente idêntico ao anterior (ppf(0.05) com confianca=95), mas a intenção de left-tail fica explícita via comentário
- ewma_vol_final exposto como 5o valor de retorno para não recalcular externamente e manter consistência entre cálculo e exibição

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- VaR page com cache, z-score correto e labels adequados — pronta para uso
- Sem bloqueadores para próximas fases

---
*Phase: 17-simulation-history-page*
*Completed: 2026-04-08*
