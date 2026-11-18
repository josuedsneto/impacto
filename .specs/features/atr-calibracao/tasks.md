# Tasks — atr-calibracao

- [x] T1 Spec revisada pelo advisor Opus e ajustada (colinearidade, PGRST205/42P01, colunas de `atr_medicoes`, sem arredondar a calibração).
- [x] T2 `backend/atr.py`: `calibrate_atr` com sigma = sqrt(SSR/(n-3)), `cov`, `gl`, mínimo de 12, colinearidade, descarte de valores ausentes/não finitos; `predict_atr` com intervalo de previsão t quando há `cov`. (ATRC-01..05)
- [x] T3 `backend/main.py`: `_medicoes_para_calibracao` lê `atr_medicoes` (tabela ausente = setor); `atr_simulate` não lê `atr_simulacoes`; resposta traz `calibracao`, `meses_usados`, `aviso`. (ATRC-06, ATRC-07)
- [x] T4 `backend/main.py`: `atr_historico` filtra na query com `or_` antes do limit; sem `user_id`; `minha: bool`. (ATRC-08)
- [x] T5 `backend/tests/test_atr.py`: coeficientes conhecidos, IC, sigma, statsmodels `obs_ci`, 11 meses, colinearidade, z do setor, histórico.
- [x] T6 Frontend: `AtrForm` (tipo), `AtrMetrics` (aviso/indicação), `AtrHistorico` (`minha`), `page.tsx` (remove `currentUserId`). (ATRC-09)
- [ ] T7 Gates: pytest, test_calcs, test_mensagens, npm test, lint, build.
- [ ] T8 Revisão do diff pelo advisor Opus antes do commit.
- [ ] T9 `validation.md` com evidências e UAT.

**Dependência aberta:** `atr-dados-reais` cria `atr_medicoes` (colunas fixadas na spec). Até lá a calibração usa o setor e a tela mostra o aviso.
