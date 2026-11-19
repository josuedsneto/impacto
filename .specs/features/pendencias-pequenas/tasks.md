# Tasks: pendencias-pequenas

- [x] T1 Reabrir hedge: `frontend/lib/hedge-reabrir.ts` (`camposDeAnalise`) + teste (PEN-01, PEN-03)
- [x] T2 Reabrir hedge: `useReabrirAnalise("hedge_cambial")` na página; padrão só preenche vazio (PEN-01, PEN-02)
- [x] T3 Lote: `_validar_lote` e `_mensagem_linha` em `backend/routers/posicoes.py`; testes de 422 por linha e de tudo-ou-nada (PEN-04, PEN-06)
- [x] T4 Lote: aviso de erro na tela (PEN-05), sem mudança de código: `apiFetch` já mostra `detail` em string
- [x] T5 Metas: `backend/tests/test_pendencias_pequenas.py` pelo `TestClient`, sem monkeypatch de `main.get_prices` (PEN-07)
- [x] T6 Pregão: `backend/pregao.py` com `FERIADOS_ICE` (2026 do PDF oficial; 2027 derivado, Good Friday corrigida para 26/03) e `main.py` só importa (PEN-08, PEN-09, PEN-10)
- [x] T7 MC: `MCPriceRequest.num_simulacoes` com `ge=100` em `backend/main.py` + teste de 422/200 (PEN-11, PEN-12)
- [x] T8 Validation: `validation.md` desta frente; atualização das pendências em `hedge-cambial`, `posicoes-fixacoes` e `cambio-previsao`
