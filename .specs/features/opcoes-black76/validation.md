# Validação — opcoes-black76

## Requisitos e evidências

| Requisito | Evidência | Resultado |
|---|---|---|
| Black-76 AC1 — paridade put-call | `pytest tests/test_options.py::test_paridade_put_call_black76` | PASS |
| Black-76 AC2 — referência ATM 1,51541 | `pytest tests/test_options.py::test_black76_referencia_atm` | PASS |
| Black-76 AC3 — MC converge (seed 42, 200k) | `pytest tests/test_options.py::test_mc_converge_para_black76_com_seed_fixa` | PASS |
| Black-76 AC4 — `/api/options/bs-price` com `F` | `pytest tests/test_options.py::test_bs_price_usa_futuro_black76` | PASS |
| Entrada AC1–AC4, AC6 — 422 e 400 | `pytest tests/test_options.py -k "entrada_invalida or sem_pernas"` | PASS |
| Entrada AC5 — `ValueError` para posição desconhecida | `pytest tests/test_options.py::test_compute_payoff_rejeita_posicao_desconhecida` | PASS |
| GK AC1 — paridade | `pytest tests/test_options.py::test_gk_paridade_put_call` | PASS |
| GK AC2 — igual a Black-76 com futuro implícito | `pytest tests/test_options.py::test_gk_igual_black76_com_futuro_implicito` | PASS |
| GK AC3 — não positivo levanta erro | `pytest tests/test_options.py::test_gk_rejeita_spot_nao_positivo` | PASS |
| P2 AC1–AC5 — textos, recálculo, unidade | Frontend: `npm test`, `npm run lint`, `npm run build` | PENDENTE — checks do frontend: pendentes, coordenadora roda após integração |

## Comandos executados

```
cd backend
C:/Users/jdlmg/OneDrive/Documentos/Josue/impacto/backend/.venv/Scripts/python.exe -m pytest tests -q
→ 45 passed, 5 warnings in 35.20s

C:/Users/jdlmg/OneDrive/Documentos/Josue/impacto/backend/.venv/Scripts/python.exe test_calcs.py
→ ok
```

Os avisos são de dependências (`gotrue`, `anyio`, `statsmodels`), não do código de opções.

## Decisões registradas

- Caminhos `/api/options/bs-price` e `/api/options/mc-price` mantidos; o campo `S` virou `F`.
- `mc-price` passou de 10/min para 60/min para acompanhar o recálculo automático.
- Literais são sensíveis a maiúsculas: "Long" recebe 422.
- Monte Carlo usa seed fixa (42): mesma entrada, mesmo preço na tela.
- Revisão do advisor Opus sobre a spec aplicada (ver spec.md, colunas de decisão).

## Passo a passo de UAT (para o usuário)

1. Abrir `/app/options`. As abas devem ser "Estratégia", "Preço justo (fórmula)" e "Simulação (Monte Carlo)".
2. Aba "Preço justo (fórmula)": com os valores padrão, o preço aparece em ¢/lb e muda ao digitar, sem botão.
3. Apagar o campo "Volatilidade anual" (ou digitar 0): o preço some e aparece "Preencha os campos destacados para ver o preço."
4. Aba "Simulação (Monte Carlo)": o preço recalcula sozinho após digitar; repetir a mesma entrada dá o mesmo número.
5. Aba "Estratégia": montar uma call comprada e calcular. Os eixos do gráfico mostram "¢/lb" e o tooltip também.
6. Conferir que a aba de fórmula dá preço próximo ao da simulação com a mesma entrada.
