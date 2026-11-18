# Validação — regressao-dolar-cenario

## Requisitos

| ID | Requisito | Evidência | Resultado |
|---|---|---|---|
| DOL-01 | Fora do menu; rota com aviso e link para Câmbio | `frontend/components/layout/NavLinks.tsx` sem a entrada; `DolarMetrics.tsx` com `Link href="/app/cambio"` | PASS (código) · link quebrado até merge de `cambio-previsao` |
| DOL-02 | Walk-forward vs random walk; `supera_random_walk` exige ≥ 24 previsões | `backend/tests/test_regression_dolar.py::test_passeio_aleatorio_nao_e_superado`, `::test_relacao_real_e_detectada`, `::test_poucas_previsoes_nao_declara_superacao` | PASS |
| DOL-03 | Resposta sem `r2`, `rmse`, `correlacao`; heatmap removido | `regression.py::run_dolar_regression`; `DolarCharts.tsx` só com `CoeficientesChart`; `npm test` 250 PASS; `tsc` exit 0 | PASS |
| DOL-04 | Campo ausente → erro explícito | `::test_campo_ausente_do_dolar_da_erro` | PASS |
| DOL-05 | Mês corrente fora das séries | `::test_mes_corrente_e_removido` | PASS |

## Comandos e resultados

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q
34 passed   (inclui 8 do açúcar e 5 do dólar)

cd frontend && npm run build -> exit 0
cd frontend && npx eslint app/app/regressao-dolar app/app/regressao-acucar components/regression components/layout -> exit 0
```

## UAT (passo a passo para o usuário)

1. O item **Modelo do dólar** não aparece mais no menu.
2. Abrir `/app/regressao-dolar` pela URL. A descrição começa com "Cenário macro".
3. Preencher os seis campos e calcular. Conferir "Dólar hoje", "Dólar no cenário", "Acerto fora da amostra" e "Erro médio fora da amostra".
4. Se o modelo não supera o random walk, aparece o aviso "Neste histórico o modelo não erra menos que supor que o câmbio fica parado…".
5. O link "Câmbio" leva à tela de previsão do dólar. **Só funciona depois do merge da thread `cambio-previsao`.**
6. Conferir que não há heatmap de correlação.

## Decisões do usuário pendentes

- Apagar de vez a tela e o código (`run_dolar_regression`, `DolarForm`, `DolarMetrics`, `DolarCharts`) ou manter despriorizada.
