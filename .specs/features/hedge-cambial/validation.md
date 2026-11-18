# Validação: hedge cambial

## Evidências de teste

| Comando | Resultado |
|---|---|
| `backend/.venv/Scripts/python.exe -m pytest tests -q` (em `backend/`) | 255 passed (231 anteriores + 24 novos de hedge) |
| `python test_calcs.py` | ok |
| `python test_mensagens.py` | ok |
| `pytest tests/test_hedge_cambial.py tests/test_endpoints_hedge_cambial.py -q` | 24 passed |
| `npm test` (frontend) | 24 arquivos, 353 testes passed |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` (com URLs públicas de placeholder, só para o build) | exit 0; rota `/app/hedge-cambial` gerada |

## Requisitos

| ID | Status | Evidência |
|---|---|---|
| HED-01 | Atendido | `test_responde_cinco_estrategias_com_premissas` (formato das cinco estratégias, p5 ≤ p50 ≤ p95) |
| HED-02 | Atendido | `test_orcamento_*` e `test_arrependimento_e_probabilidade_abaixo_em_caminhos_conhecidos`. Medido sobre a taxa líquida (com prêmio), conforme revisão do advisor |
| HED-03 | Atendido | `test_arrependimento_e_probabilidade_abaixo_em_caminhos_conhecidos` (forward arrepende-se em 50% com ST simétrico em F) |
| HED-04 | Atendido | `test_forward_acima_do_spot_aparece_no_carrego`, `test_travar_100...`; `premio_rs`, `carrego_rs`, `premissas` na resposta |
| HED-05 | Atendido | `test_taxas_gk_reproduzem_o_forward`; `sigma = sigma_proximo` da mesma `janela` usada em `cambio.simular` (`routers/hedge_cambial.py`) |
| HED-06 | Atendido | `test_premio_put_bate_formula_fechada` (fórmula fechada com `math.erf`, rel 1e-9); `test_premio_put_bate_monte_carlo_risco_neutro` (2 milhões de caminhos, tolerância 0,5%) |
| HED-07 | Atendido | `test_vol_zero_travar_100_no_forward_da_V_vezes_F` |
| HED-08 | Atendido | `test_vol_zero_put_e_collar_com_strike_no_forward_dao_V_vezes_F` (put e collar com K = F, vol zero) |
| HED-09 | Atendido | `test_collar_com_k1_igual_k2_da_V_vezes_F_em_todo_caminho`; collar com K1 > K2 responde 400 (`test_collar_com_k1_maior_que_k2_responde_400_em_portugues`) |
| HED-10 | Atendido, com desvio | Limites em `HedgeIn` (`test_entrada_fora_dos_limites_responde_422`); 503 sem juros e sem histórico. **Desvio:** entrada inválida responde 422 (convenção de `posicoes` e `analises`), não 400. Mensagens em português só para K1 > K2 e 503 |
| HED-11 | Atendido, sem teste automatizado próprio | `Literal` de `routers/analises.py` e `FERRAMENTAS` de `lib/analises.ts` incluem `hedge_cambial`; migration `20261118000008_analises_hedge_cambial.sql`; `BotaoSalvarAnalise` com `ferramenta="hedge_cambial"`. Conferir no UAT (passo 8) |
| HED-12 | Atendido | `leituraHedge` em `lib/leitura.test.ts` (frase e AUSENTE); aviso e premissas na tela |
| HED-13 | Atendido | `test_sinais_media_das_cinco_estrategias_igual_V_vezes_F_sob_risco_neutro` (tolerância 0,03% de V·F) e `test_put_capitaliza_o_premio_pelo_selic` (identidade exata) |

## Desvios e limitações conhecidos

1. **NaN no corpo JSON** responde 500, não 422: o FastAPI tenta serializar o NaN que ecoa no erro de validação. O modelo rejeita NaN (`test_modelo_rejeita_nan_e_inf`). O frontend nunca envia NaN (`JSON.stringify` converte para `null`). Correção estrutural (handler global de `RequestValidationError` em `main.py`) fica fora desta frente.
2. **Autenticação de `/api/cambio/previsao` não é aplicada** (já existia antes desta frente). Em `routers/cambio.py`, `user` é anotado com `Annotated[...]` sob `from __future__ import annotations`, então o FastAPI o trata como query param, e a rota fica sem `get_current_user`. Verificado com `main.app.routes`. O endpoint novo (`/api/hedge-cambial`) não tem esse problema. Correção sugerida: remover o `from __future__ import annotations` de `routers/cambio.py`, depois conferir os testes. Não foi feita aqui por ser mudança de comportamento em rota já entregue.
3. **Premissas da medida:** a simulação é drift zero; o forward e o prêmio são de risco neutro. Forward e put tendem a ter média acima do aberto, e o collar, abaixo. A tela mostra `carrego_rs` e o texto de premissas.
4. **Gráfico:** mostra a faixa p5–p95 por estratégia, sem marcador da mediana (a tabela traz a mediana).
5. **Strikes padrão** centrados no spot, não no forward (sugestão do advisor, não aplicada por simplicidade).
6. **Orçamento vazio** usa o forward do prazo escolhido (o campo não traz valor fixo, para não ficar preso ao prazo de 63 dias). **Volume** aceita milhar com ponto ("500.000" = 500 mil); "1000.5" continua lido como decimal.

## UAT (passos para o usuário)

Pré-requisito: aplicar `20261118000008_analises_hedge_cambial.sql` no Supabase (depois de `20261118000007`).

1. Abrir **Risco e resultado → Hedge cambial** no menu.
2. Conferir que os campos já vêm preenchidos: orçamento = preço de travar hoje; put K = spot × 0,95; collar K1 = spot × 0,95 e K2 = spot × 1,05.
3. Clicar em **Comparar estratégias**. Conferir que a tabela tem cinco linhas e que "Travar 100% no forward" tem faixa p5 = p95.
4. Conferir o aviso "Comparação de cenários, não recomendação." e o parágrafo sobre o forward acima do spot pelo diferencial de juros.
5. Trocar o prazo para 6 meses e recalcular; a receita mediana deve mudar.
6. Digitar K1 maior que K2 e clicar em comparar: deve aparecer o aviso de erro, sem chamar a API.
7. **Exportar CSV** e abrir no Excel: separador `;`, vírgula decimal, acentos corretos.
8. **Salvar análise**, dar um título e abrir **Minhas análises**: a análise aparece com a ferramenta "Hedge cambial". O botão de reabrir só leva à tela (não restaura os campos; ver pendências).

## Pendências fora desta frente

- Aplicar a migration `20261118000008`.
- Corrigir a autenticação de `/api/cambio/previsao` (item 2).
- Reabrir análise de hedge ainda não restaura os campos: a tela não usa `useReabrirAnalise` (o link só navega).
- Layout em celular (360px) não foi verificado em navegador nesta rodada.
