# Tarefas — cambio-previsao

1. `backend/cambio.py`: `limpar`, `retornos`, `vol_ewma`, `simular` (EWMA ou constante, drift), `bandas`, `prob_acima`, `prob_abaixo`, `prob_tocar`, `forward`. Testes em `backend/tests/test_cambio.py` (forward, invariante de toque, bandas ordenadas, cobertura GBM).
2. `backend/focus.py`: `fetch_indicator(name, ano)` extraído de `main.py`; `/api/focus` passa a chamá-lo.
3. `backend/backtest_cambio.py`: walk-forward, CRPS, pinball, Kupiec, Brier, Diebold-Mariano; grava `backtest.md`. Rodar e registrar a decisão.
4. `backend/routers/cambio.py` + uma linha `app.include_router` em `main.py`.
5. `/api/metas`: eixo do dólar centrado no spot (grade 0,05).
6. `frontend/lib/cambio.ts`: dias úteis até o fim da safra; `frontend/lib/leitura.ts`: `leituraCambio`.
7. `frontend/app/app/cambio/page.tsx` seguindo `arima/page.tsx`; entrada em `NavLinks.tsx`.
8. `validation.md` com requisitos, evidências e UAT.
