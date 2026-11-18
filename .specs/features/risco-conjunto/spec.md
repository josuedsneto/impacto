# Risco conjunto da receita (açúcar × dólar) — Especificação

## Problem Statement

A receita da usina em R$ por tonelada é o produto do preço do açúcar (¢/lb) pelo dólar (R$/US$). Hoje `/api/metas`, `/api/breakeven` e `/api/risco` tratam açúcar e dólar separados ou numa grade fixa, e não respondem a pergunta de negócio: **"qual a probabilidade de a receita por tonelada ficar abaixo da minha meta?"**. Como os dois preços andam correlacionados, somar os riscos separadamente erra a resposta.

## Goals

- [ ] Uma simulação bivariada (açúcar e dólar, com a correlação observada) dá P(receita < meta), p5, p50 e p95 da receita em R$/t no horizonte escolhido.
- [ ] O usuário vê quanto cada fator (e a correlação) contribui para esse risco.
- [ ] A parte já fixada da safra reduz o risco calculado sobre a parte aberta.

## Out of Scope

| Item | Motivo |
|------|--------|
| Saída em R$/saca na tela | Pedido em R$/t; saca = t × 0,05 pode entrar depois se o usuário pedir. |
| Fixações lidas do banco (`posicoes-fixacoes`) | Essa thread cria as tabelas; aqui a entrada é manual. |
| Bootstrap histórico dos retornos | Ver decisão AS-01 (fica como caminho de upgrade). |
| Drift (tendência) de preço | Premissa neutra: média zero dos log-retornos. Mudança de premissa é decisão do usuário. |
| Persistir simulações | Cálculo sob demanda; nada gravado. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| AS-01 Método | Gaussiano bivariado com a Cholesky 2×2 em forma fechada: `X_s = σ_s√T·Z1`, `X_f = σ_f√T·(ρ·Z1 + √(1−ρ²)·Z2)` | Atende "vol de cada série + correlação" do escopo; funciona com σ = 0 (a forma fechada não precisa de matriz definida positiva). Limitação: caudas finas. Caminho de upgrade: bootstrap conjunto dos pregões. Oráculo de teste: ln R ~ N(ln R0, V), V = (σs²+σf²+2ρσsσf)·T/252, dá P(<meta) em forma fechada (com parte fixada, meta' = (meta−f·PF)/(1−f)). | y (advisor aprovou)
| AS-02 Horizonte | Em pregões (dias úteis), padrão 63, de 1 a 252. Como a soma de T passos i.i.d. é normal com variância T·σ_d², a simulação vai direto ao horizonte (sem passo a passo) | Exato sob AS-01; sem matriz N×T | n |
| AS-03 Vol diária | `σ_d = σ_anual / √252` (convenção do CLAUDE.md) | Convenção do projeto | y |
| AS-04 Estimativa | Log-retornos diários de `SB=F` e `USDBRL=X` nas últimas `janela` datas em comum (fechamentos ≤ 0 descartados); σ anual = desvio-padrão amostral × √252; ρ = correlação de Pearson, limitada a [−1, 1]; se alguma σ = 0, ρ = 0 (sem NaN). Janela padrão 756 pregões (3 anos), faixa 60–1260. Busca `janela×7/5 + 30` dias corridos. Limitação: o `SB=F` é série contínua com saltos de rolagem, o que infla a σ | Pedido: janela de 3 anos | y |
| AS-05 Drift | Zero nos log-retornos | Premissa neutra; sem tendência estimada | n |
| AS-06 Fator de conversão | `FATOR = 22,0462 × 1,04` (o mesmo de `/api/metas`), R$/t = FATOR × ¢/lb × R$/US$. Atenção: `/api/breakeven` usa outro fator (admin_config, 1,12045 R$/saca ≈ 22,41/t); esta tela não o usa | 22,0462 converte ¢/lb em US$/t; 1,04 é coerente com prêmio de polarização | n (usuário confirma o 1,04 e qual fator vale) |
| AS-07 Parte fixada | Entrada manual: `% fixado` (0–100) e `preço fixado` em R$/t, com açúcar e câmbio já travados. Receita = f·PF + (1−f)·R_simulada. Fixação só em ¢/lb (sem câmbio travado) não é coberta: continua com risco de dólar. Upgrade: f·FATOR·PF_c·X_T | Converter ¢/lb em R$/t exige câmbio, que é aleatório | n |
| AS-08 Número de simulações | 20 000 por padrão, máximo 100 000, `float32`, seed opcional | Com 20 000 amostras o erro-padrão de P é ≤ 0,35 pp (IC 95% ≈ ±0,7 pp) | y |
| AS-09 Contribuição de cada fator | Mesmos Z1 e Z2 (mesma seed) nos quatro cenários: total; correlação = 0; σ_dólar = 0 (só açúcar); σ_açúcar = 0 (só dólar). As probabilidades não se somam; a decomposição aditiva exata vem das parcelas σs², σf² e 2ρσsσf de V | Compara a P(<meta) com o efeito isolado de cada fator | y |

**Open questions:** AS-06 (1,04) e AS-07 (unidade do preço fixado) devem ser confirmados pelo usuário antes de uso em decisão real.

---

## User Stories

### P1: Probabilidade da receita abaixo da meta ⭐ MVP

**User Story**: Como gestor, quero saber a chance de a receita por tonelada ficar abaixo da minha meta.

**Acceptance Criteria**:

1. WHEN o usuário envia meta, horizonte e janela THEN o endpoint `POST /api/risco-conjunto` SHALL responder `prob_abaixo_meta` (0 a 1), `p5`, `p50`, `p95` (R$/t) e `meta`.
2. The cálculo SHALL usar só `get_prices` para preços históricos (sem `yf.download`).
3. WHEN `seed` é informada THEN duas chamadas idênticas SHALL devolver o mesmo resultado.
4. The módulo `backend/risco_conjunto.py` SHALL usar `float32` nas amostras da simulação.

**Independent Test**: `test_risco_conjunto.py` com seed fixa; repetir a chamada e comparar.

### P1: Correlação correta ⭐ MVP

**User Story**: Como gestor, quero que o risco reflita o fato de que açúcar e dólar andam juntos.

**Acceptance Criteria**:

1. WHEN 10 000 retornos sintéticos com ρ = 0,6 são estimados THEN a correlação estimada SHALL ficar a até 0,03 de 0,6 (erro-padrão ≈ 0,008).
2. WHEN a simulação usa a correlação estimada THEN a correlação dos choques terminais simulados (200 000 amostras, função `_choques`) SHALL ficar a até 0,01 da estimada.
3. The resposta SHALL incluir `correlacao` estimada e os `vol_acucar` e `vol_dolar` anuais usados.

**Independent Test**: séries com ρ conhecido, comparar estimada e simulada com tolerância.

### P1: Contribuição dos fatores ⭐ MVP

**User Story**: Como gestor, quero ver quanto do risco vem do açúcar, do dólar e da correlação.

**Acceptance Criteria**:

1. The resposta SHALL trazer `contribuicao` com `prob_sem_correlacao`, `prob_so_acucar` (σ_dólar = 0) e `prob_so_dolar` (σ_açúcar = 0), todas com a mesma seed.
2. WHEN σ_dólar = 0 THEN `prob_abaixo_meta` SHALL coincidir com o caso univariado analítico `Φ((ln(meta/(FATOR·S0·X0)))/(σ_açúcar·√T))` a até 0,005, com 200 000 amostras (erro-padrão ≈ 0,001). O caso bivariado com mistura SHALL também bater com a forma fechada a até 0,005.

**Independent Test**: teste com σ_dólar = 0 e comparação com `scipy.stats.norm.cdf`.

### P2: Parte já fixada

**User Story**: Como gestor, quero informar o que já foi fixado e ver o risco só da parte aberta.

**Acceptance Criteria**:

1. WHEN `percentual_fixado` > 0 THEN `preco_fixado` (R$/t, > 0) SHALL ser obrigatório; senão 422.
2. The receita simulada SHALL ser `f·PF + (1−f)·R_simulada`, com `f = percentual_fixado / 100`.
3. WHEN `percentual_fixado` = 100 THEN a receita SHALL ser constante igual a `preco_fixado` e `prob_abaixo_meta` SHALL ser 1 se meta > PF e 0 caso contrário.

---

## Edge Cases

- IF há menos de 60 datas em comum entre as duas séries THEN o endpoint SHALL responder 503 "Histórico insuficiente para estimar o risco conjunto. Tente novamente em alguns minutos." (mesma linha dos demais 503 de mercado).
- IF `get_prices` não devolve preço atual para açúcar ou dólar THEN 503 com a mensagem de preço atual já usada em `/api/breakeven`.
- IF `σ_açúcar` ou `σ_dólar` = 0 THEN a simulação roda sem erro (forma fechada).
- Entradas fora da faixa (meta ≤ 0, horizonte fora de 1–252, janela fora de 60–1260, `percentual_fixado` fora de 0–100, simulações fora de 1 000–100 000) → 422 pelo pydantic.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| RC-01 | P1: Probabilidade abaixo da meta (contrato da resposta) | - | Pending |
| RC-02 | P1: Probabilidade abaixo da meta (só `get_prices`) | - | Pending |
| RC-03 | P1: Probabilidade abaixo da meta (seed reprodutível) | - | Pending |
| RC-04 | P1: Probabilidade abaixo da meta (float32) | - | Pending |
| RC-05 | P1: Correlação correta (estimada = ρ conhecido) | - | Pending |
| RC-06 | P1: Correlação correta (simulada ≈ estimada) | - | Pending |
| RC-07 | P1: Correlação correta (expõe correlacao, vols) | - | Pending |
| RC-08 | P1: Contribuição (campos de `contribuicao`) | - | Pending |
| RC-09 | P1: Contribuição (σ_dólar = 0 = univariado) | - | Pending |
| RC-10 | P2: Parte fixada (preco_fixado obrigatório) | - | Pending |
| RC-11 | P2: Parte fixada (mistura da receita) | - | Pending |
| RC-12 | P2: Parte fixada (100% fixado) | - | Pending |
| RC-13 | Edge: 503 com menos de 60 datas e preço atual ausente | - | Pending |
| RC-14 | Edge: validação 422 de entradas | - | Pending |
| RC-15 | Tela: formulário, histograma com meta, cartão "X% de chance…", leitura e CSV | - | Pending |
| RC-16 | Menu: entrada "Receita em R$ (açúcar × dólar)" em `NavLinks.tsx` | - | Pending |

**Coverage:** 16 total, 0 mapeados (Medium).

## Success Criteria

- [ ] Com 20 000 simulações e janela padrão, a resposta chega em menos de 2 s com o cache aquecido.
- [ ] Cartão principal lê "X% de chance de a receita ficar abaixo de R$ Y/t" com X e Y iguais aos da resposta.
