# Previsão do câmbio (USD/BRL) como faixa de possibilidades — Especificação

## Problem Statement

A usina precisa decidir quando e quanto travar o dólar. Hoje o app não mostra nada sobre o câmbio futuro. Câmbio é quase um random walk: uma previsão pontual não bate "amanhã igual a hoje". O que ajuda a decidir é a **distribuição** de possíveis dólares, a probabilidade de passar de um nível de hedge e o preço de travar hoje pela paridade coberta.

## Goals

- [ ] Mostrar uma faixa p5–p95 do dólar para 1 semana, 1, 3 e 6 meses e o fim da safra.
- [ ] Para níveis de hedge K informados pelo usuário, mostrar P(dólar acima de K no vencimento) e P(tocar K antes do vencimento).
- [ ] Mostrar o forward pela paridade coberta como "preço de travar hoje", com as aproximações explícitas.
- [ ] Escolher o modelo de produção por backtest offline, com regra de decisão escrita antes de rodar.

## Out of Scope

| Item | Motivo |
|------|--------|
| ML (XGBoost, LSTM) | Não bate random walk em câmbio; fora do desenho. |
| Previsão intradiária | Dado diário basta para hedge de safra. |
| PTAX como fonte | Fica para v2, como fallback. |
| GARCH (`arch`) | Só entra se um backtest futuro mostrar ganho. Dependência nova sem necessidade hoje. |
| Previsão pontual como número principal | Contraria a premissa: o que importa é a faixa. |
| Correção de Broadie-Glasserman para toque intradiário | Toque é medido no fechamento diário; a tela diz isso. Custo sem ganho para a decisão. |
| Cache de resultado por (ultimo_dado, horizonte) | 10.000 caminhos × 252 dias roda em milissegundos; cache é complexidade sem medida que justifique. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Limpeza da série | Remover fechamentos ≤ 0, datas duplicadas e retornos logarítmicos com \|r\| > 10%; mesma regra em produção e no backtest | Ticks ruins do Yahoo viram resíduos extremos no bootstrap | n |
| Modelo de produção | M1: log-retorno, vol EWMA (λ=0,94) atualizada ao longo de cada caminho, resíduos padronizados por bootstrap (média 0, desvio 1 após renormalização), drift zero | Candidato do desenho; ~40 linhas de NumPy | n |
| Semente da EWMA | Variância dos 30 primeiros retornos da janela; depois recursão λ | Simples e determinística | n |
| Histórico mínimo em produção | 252 fechamentos limpos; abaixo disso 503 | Bootstrap de 30 resíduos é fraco | n |
| M1f (drift de carry) | Só avaliado no backtest. Substitui o M1 só se CRPS menor com Diebold-Mariano (HAC Newey-West, lag ⌈h/21⌉−1) p<0,05 | Evita escolha sem evidência | n |
| Regra de decisão de produção (escrita antes do backtest) | 1) M1 entra se CRPS skill contra M0 ≥ 0 em h=5 e h=21. 2) M1f substitui M1 só pelo teste DM acima. 3) Kupiec não rejeita a 5% em h ∈ {5, 21} para 80/90/95. 4) Se nenhum modelo passa em 3, vai o M0 com aviso na tela | Remove a circularidade do gate; cobertura testada onde o N é suficiente | n |
| Cobertura ±3 pp | Virou meta descritiva, não gate. Erro-padrão da cobertura com ~200 origens é ~2 pp: ±3 pp não separa modelo bom de ruído | Advisor: gate estatisticamente inviável | n |
| Kupiec em h=63 e 126 | Informativo, com N efetivo = N·21/h. Fora do gate | Overlap de janelas autocorrelaciona as falhas | n |
| Horizontes | 5, 21, 63, 126 dias úteis no backtest; API aceita `horizonte` de 1 a 262 | 262 cobre a safra inteira (abril a março ≈ 260 dias úteis) | n |
| Fim da safra | Frontend calcula dias úteis (seg–sex, sem feriados) até o próximo 31/03. Se hoje é 31/03 ou depois, vai para o 31/03 seguinte | Safra centro-sul vai de abril a março. Aproximação. | n |
| Níveis K padrão | spot × 0,95 e spot × 1,05 quando `niveis` não é informado | Ponto de partida sem digitação | n |
| Formato de `niveis` | CSV em query string (`niveis=5.20,5.80`), até 10 valores, cada um finito entre 0,5 e 20 (`math.isfinite`) | Rejeita "nan" e "inf" | n |
| Toque (direção) | K > S0: toca se max(S_1..S_h) ≥ K. K < S0: toca se min(S_1..S_h) ≤ K. K = S0: 1. Invariante testado: P(tocar) ≥ P(acima no vencimento) quando K > S0 | Definição precisa | n |
| Níveis abaixo do spot | Resposta traz também `p_abaixo_vencimento` = P(S_h < K); a tela mostra a coluna certa conforme K vs spot | Para K < spot, P(acima) pouco ajuda a decidir | n |
| Forward | `F = S·(1+i_BRL)^(du/252) / (1 + i_USD·dc/360)`. i_BRL = Selic meta (SGS 432, % a.a. em base 252). i_USD = Fed funds (FRED DFF, money market ACT/360 simples), dc = dias corridos | Convenções de cada mercado | n |
| Fonte do Fed funds | CSV público `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF`, sem chave. No backtest, valor vigente em cada origem | Não depende de `FRED_API_KEY` | n |
| Aproximações do forward | Texto da resposta: "Usa a Selic meta, não a taxa do DI, e o juro americano, não o cupom cambial. É uma aproximação." | Duas aproximações reais, ambas mostradas | n |
| Benchmark Focus | `fetch_indicator(name, ano)` extraído para `backend/focus.py`. Mostra o ano corrente; a partir de outubro mostra também o ano seguinte | Em nov/dez o ano corrente está a menos de 2 meses do horizonte de 6 meses | n |
| Ponto de previsão no backtest | Mediana (p50) do modelo, mas MAE/RMSE só para M1f. Para M0/M1 a métrica é CRPS sobre log(S_h/S0), reportado em % e como skill contra M0 | Com drift zero o p50 é o spot por construção; MAE vs RW não informa | n |
| Escala do CRPS | Log-retorno, para não dar mais peso a 2020+ (dólar ~5,5) que a 2011 (~1,6) | Comparação justa entre épocas | n |
| CRPS | Fórmula de amostras ordenadas, O(n log n) | Forma por pares seria 10⁸ operações por origem | n |
| Brier | Reportado com skill contra M0 só para h ≥ 21 | Em h=5 a probabilidade fica perto de 0 e o Brier é quase sempre ~0 | n |
| Dados do backtest | `yfinance` direto em `USDBRL=X` desde 2007 (2007–2009 só para aquecer a janela de 3 anos), depois a mesma limpeza | Script offline; não passa pelo cache do Supabase | n |
| Autenticação e limite | `Depends(get_current_user)` e `@limiter.limit`, como `/api/arima` | Custo e acesso | n |
| Seed da simulação | Derivada de `ultimo_dado` (resultado estável entre recargas) | Faixa não muda a cada clique | n |
| Dependência nova | Nenhuma. NumPy, pandas, yfinance, `bcb` e `requests` já estão no projeto | Regra de dependência | n |
| Touch "antes do vencimento" | Medido no fechamento diário | Definição padrão | n |
| Eixo do mapa de calor | Spot arredondado à grade de 0,05; 11 valores com o spot no meio | Advisor item 7 | n |

**Open questions:** o dono do produto confirma se "fim da safra" é 31/03.

---

## User Stories

### P1: Faixa de possibilidades do dólar ⭐ MVP

**User Story**: Como gestor de hedge, quero ver a faixa provável do dólar nos próximos meses para decidir quanto travar.

**Acceptance Criteria**:

1. WHEN `GET /api/cambio/previsao` é chamado THEN o backend SHALL devolver `bandas` com p5, p50 e p95 para cada dia de 1 a `horizonte`, em nível de preço.
2. The resposta SHALL incluir `ultimo_dado` (data do último fechamento limpo) e `spot`.
3. The tela SHALL mostrar a faixa p5–p95 em área (Recharts `Area`) e a frase "faixa de possibilidades, não previsão".
4. WHEN `horizonte` está fora de 1–262 THEN o endpoint SHALL responder 400 com mensagem em português.
5. WHEN há menos de 252 fechamentos limpos THEN o endpoint SHALL responder 503 "Dados insuficientes para o câmbio. Tente novamente em alguns minutos."

**Independent Test**: `test_cambio.py` com série de GBM conhecido: p5 < p50 < p95 em todos os dias; bandas se alargam com o horizonte.

### P1: Probabilidade por nível de hedge ⭐ MVP

**User Story**: Como gestor de hedge, quero saber a chance de o dólar passar de um nível que me interessa.

**Acceptance Criteria**:

1. WHEN `niveis` é informado THEN o backend SHALL calcular, para cada K, `p_acima_vencimento` = fração dos caminhos com S_h > K, `p_abaixo_vencimento` = fração com S_h < K, e `p_tocar_antes` pela direção definida em Assumptions.
2. WHEN `niveis` não é informado THEN o backend SHALL usar spot × 0,95 e spot × 1,05.
3. `niveis` SHALL aceitar até 10 valores, cada um finito e entre 0,5 e 20. Fora disso THEN 400.
4. The tela SHALL mostrar a tabela "nível → P(acima no vencimento) | P(tocar antes)" (ou P(abaixo) quando o nível está abaixo do spot), com a nota "toque medido no fechamento diário".

**Independent Test**: caminhos determinísticos conhecidos dão as probabilidades exatas; teste do invariante P(tocar) ≥ P(acima) para K > S0.

### P1: Forward como preço de travar hoje ⭐ MVP

**User Story**: Como gestor, quero saber quanto custa travar o dólar hoje para o vencimento.

**Acceptance Criteria**:

1. The resposta SHALL incluir `forward` com `valor`, `selic_meta_aa`, `fed_funds_aa`, `tau_anos` e `aproximacao` (texto da tabela de Assumptions).
2. The tela SHALL chamar o valor de "preço de travar hoje", não de previsão.
3. WHEN a SGS ou o FRED falham THEN `forward.valor` SHALL ser `null` e a tela SHALL mostrar "Sem dados suficientes para este cálculo." (AUSENTE).

**Independent Test**: com S=5,00, i_BRL=10%, du=252 (τ=1), i_USD=5%, dc=360: F = 5,00 × 1,10 / 1,05 ≈ 5,2381.

### P2: Benchmark do Focus

**User Story**: Como gestor, quero comparar a faixa com a expectativa do mercado.

**Acceptance Criteria**:

1. The resposta SHALL incluir `focus` com `cambio_ano_corrente` (mediana) e `ano_corrente`; e `cambio_ano_seguinte` quando a data é de outubro em diante. `null` se o BCB estiver fora.
2. `fetch_indicator` SHALL sair de `main.py` para `backend/focus.py` com `(name, ano)`, reutilizado por `/api/focus`, sem mudar o retorno de `/api/focus`.

### P2: Backtest que escolhe o modelo

**User Story**: Como dono do produto, quero saber se o modelo acerta mais do que o random walk antes de mostrá-lo.

**Acceptance Criteria**:

1. WHEN `backend/backtest_cambio.py` roda THEN SHALL fazer walk-forward a cada 21 dias úteis, janela móvel de 756 dias úteis, 10.000 caminhos, sem dado futuro na estimação.
2. The script SHALL reportar, para M0, M1 e M1f: CRPS em log-retorno (% e skill contra M0); cobertura 80/90/95% com Kupiec (gate em h ∈ {5, 21}; informativo em 63 e 126 com N efetivo); pinball em p5, p50 e p95; Brier de P(acima de K) com K = spot ±5% (skill contra M0, h ≥ 21); MAE/RMSE do p50 contra spot só para M1f.
3. The script SHALL gravar a tabela em `.specs/features/cambio-previsao/backtest.md`, com a decisão aplicando a regra de Assumptions.

### P2: Higiene do mapa de calor

**User Story**: Como usuário das metas, quero o eixo do dólar centrado no câmbio de hoje.

**Acceptance Criteria**:

1. WHEN `/api/metas` roda THEN o eixo `dolares` SHALL ter 11 valores com passo 0,05, centrados no último fechamento de `USDBRL=X` arredondado à grade de 0,05 (não mais 4,80–5,25 fixo).

---

## Edge Cases

- IF `ultimo_dado` é hoje ou o horizonte é 0 (fim da safra no próprio dia 31/03) THEN o frontend SHALL usar o 31/03 seguinte, e o backend SHALL rejeitar h=0 com 400.
- IF a volatilidade EWMA é zero THEN as bandas SHALL ser o spot constante (sem erro de divisão).
- IF a SGS ou o FRED falham THEN a resposta SHALL vir com `forward.valor = null`, sem derrubar as bandas.
- IF `niveis` contém "nan" ou "inf" THEN 400.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| CAM-01 | P1: Faixa (bandas por dia) | - | Pending |
| CAM-02 | P1: Faixa (validação de horizonte e histórico mínimo) | - | Pending |
| CAM-03 | P1: Probabilidade por nível (P acima, abaixo e tocar) | - | Pending |
| CAM-04 | P1: Probabilidade por nível (niveis padrão e validação) | - | Pending |
| CAM-05 | P1: Forward | - | Pending |
| CAM-06 | P2: Focus (fetch_indicator extraído, ano seguinte) | - | Pending |
| CAM-07 | P2: Backtest (walk-forward e métricas) | - | Pending |
| CAM-08 | P2: Backtest (regra de decisão de produção) | - | Pending |
| CAM-09 | P2: Higiene do mapa de calor | - | Pending |
| CAM-10 | Edge cases (fim da safra, vol zero, FRED/SGS fora, nan/inf) | - | Pending |

**Coverage:** 10 total, 0 mapeados (Medium).

## Success Criteria

- [ ] Teste de cobertura com GBM de vol conhecida: N=1.000 origens sem overlap (h=5), 2.000 caminhos, seed fixa; cobertura de 90% entre 87% e 93%.
- [ ] Backtest gravado em `backtest.md`, com a decisão de produção escrita e a regra aplicada.
- [ ] `pytest tests -q`, `test_calcs.py`, `test_mensagens.py`, `npm test`, `npm run lint` e `npm run build` passam.

---

## Revisão do advisor Opus (aplicada antes da implementação)

Aplicado: gate sem circularidade (M0 como referência, M1f por DM); Kupiec só em h 5 e 21; ±3 pp virou meta descritiva; limite de 262 dias para a safra; direção do toque; log-retorno com CRPS; Brier só h ≥ 21; FHS com EWMA ao longo do caminho; limpeza da série; mínimo de 252; `Depends` e limiter; `isfinite`; Focus com ano seguinte; forward com ACT/360 e fonte FRED sem chave; eixo do mapa com grade de 0,05.

Não aplicado, com motivo: cache por (ultimo_dado, horizonte) (ver Out of Scope); Broadie-Glasserman (ver Out of Scope). O teste de GBM foi fixado em N=1.000 origens sem overlap, como sugerido.
