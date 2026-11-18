# Validação — regressao-acucar-honesta

## Requisitos

| ID | Requisito | Evidência | Resultado |
|---|---|---|---|
| REG-01 | R² e RMSE LOO; `r2_treino` fora da tela | `backend/tests/test_regression_honesta.py::test_ruido_puro_da_r2_loo_baixo_e_confianca_baixa`, `::test_relacao_linear_da_r2_loo_alto`, `::test_historico_traz_previsao_fora_da_amostra` | PASS |
| REG-02 | Faixa = previsão ∓ 1,645 × RMSE LOO; baseline "ano anterior" | `::test_faixa_e_de_1_645_vezes_rmse_loo`, `::test_baseline_ano_anterior_e_calculado` | PASS |
| REG-03 | Tela mostra métricas fora da amostra, baseline e aviso "Baixa" | Código: `frontend/components/regression/AcucarMetrics.tsx` (`AcucarMetrics`, `AvisoConfianca`); `npm test` 250 PASS; `npx tsc --noEmit` exit 0 | PASS (teste de código) · UAT pendente |
| REG-04 | Pipeline com StandardScaler; previsão invariante a escala | `::test_escala_de_uma_variavel_nao_muda_a_previsao` | PASS |
| REG-05 | `estoque_uso_pct` fora do modelo, request e form | `::test_estoque_uso_pct_saiu_do_modelo`; grep do frontend sem `estoque_uso_pct` | PASS |
| REG-06 | Campo ausente → erro explícito | `::test_campo_ausente_da_erro_explicito` | PASS |

## Comandos e resultados

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q
34 passed

cd backend && python test_calcs.py   -> ok
cd backend && python test_mensagens.py -> ok

cd frontend && npm test              -> 250 passed (13 files)
cd frontend && npx tsc --noEmit      -> exit 0
cd frontend && npx eslint <arquivos alterados> -> exit 0
cd frontend && npm run build         -> exit 0
```

Lint do projeto: 1 erro pré-existente em `components/ui/input.tsx` (`no-empty-object-type`), arquivo não tocado nesta feature. Fora do escopo.

## UAT (passo a passo para o usuário)

1. Abrir **Modelo do açúcar**, preencher os campos (sem "Estoque sobre consumo") e clicar em **Calcular previsão**.
2. Conferir os cards: "Açúcar previsto", "Faixa provável", "Erro médio em anos não vistos", "Erro do chute 'mesmo preço do ano anterior'", "Acerto fora da amostra (R²)".
3. Conferir que **não** aparece R² de treino.
4. Se a confiança for "Baixa", aparece o aviso "Com N anos de histórico, esta previsão é só indicativa…".
5. No gráfico, a linha tracejada é "Previsto sem ver o ano".
6. Exportar CSV e conferir as linhas de confiança e o erro do chute.
7. No Histórico, conferir "Confiança" e "Erro médio fora da amostra".

## Limitações conhecidas

- LOO com ~11 anos treina usando anos posteriores ao ano testado: o resultado é otimista. O baseline "ano anterior" é o contraste.
- Alinhamento ano-safra USDA × ano civil não foi alterado (registrado na spec).
