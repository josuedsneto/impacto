# Linguagem clara — Especificação

## Problem Statement

O app fala a língua de quem o programou, não de quem o usa. Campos aparecem como "Limite percentual (pct_bound)", "S (Preço atual)", "T (Anos até vencimento)", "σ (Volatilidade)", "λ saltos", "Steps"; taxas são digitadas como decimal ("0.105" para 10,5%); ativos aparecem pelo código do Yahoo ("SB=F", "USDBRL=X"); e os resultados mostram números sem dizer o que significam. A equipe de usina e de trading precisa entender o resultado sem um analista quantitativo do lado.

## Goals

- [ ] Nenhum rótulo de campo usa nome de variável de código ou símbolo matemático como texto principal.
- [ ] Todo campo e todo resultado numérico mostra a unidade.
- [ ] Toda ferramenta mostra, junto do resultado principal, uma frase em português que diz o que o número significa.

## Out of Scope

| Item | Motivo |
|------|--------|
| Tradução para outros idiomas | Usuários são brasileiros. |
| Tutorial interativo / tour guiado | A premissa é simplicidade; frases de leitura resolvem a maior parte. |
| Mudar fórmulas ou modelos | Esta feature só muda texto, unidades e forma de entrada. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Taxas e volatilidades | O usuário digita em % (10,5) e o front converte para decimal (0,105) antes de enviar | Ninguém fora do quant pensa em 0.105 | n |
| Símbolos matemáticos | Aparecem só entre parênteses depois do nome: "Volatilidade anual (σ)" | Mantém a referência para quem conhece | n |
| Nomes dos ativos | Mapa único `lib/ativos.ts`: SB=F → "Açúcar NY nº 11", USDBRL=X → "Dólar (USD/BRL)", CL=F → "Petróleo WTI"; código aparece pequeno ao lado | Tickers sugeridos pelos usuários sem nome mostram o código | n |
| Nomes no menu | "Jump Diffusion" → "Simulação com saltos"; "ARIMA" → "Previsão de preço (ARIMA)"; "VaR" → "Perda máxima (VaR)"; "Stress Test" → "Teste de estresse"; "Risco (EBITDA)" → "Risco do EBITDA" | Nome do que a ferramenta responde, com o termo técnico entre parênteses | n |
| Campo decimal no navegador | Inputs aceitam vírgula e ponto como separador decimal | `type="number"` rejeita vírgula em alguns navegadores pt-BR | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Campos que qualquer pessoa entende ⭐ MVP

**User Story**: Como analista da usina, quero preencher qualquer formulário sem conhecer a notação financeira.

**Acceptance Criteria**:

1. The rótulos de campo SHALL ser frases em português com a unidade no fim: ex. "Preço atual do ativo (¢/lb)", "Prazo até o vencimento (anos)", "Volatilidade anual (%)".
2. The rótulos SHALL não conter nomes de variáveis de código (`pct_bound`, `num_simulacoes`, `Steps`).
3. WHERE o campo é taxa, volatilidade ou percentual o campo SHALL receber o valor em % e a interface SHALL converter para decimal antes de enviar à API.
4. WHEN o usuário digita "10,5" num campo numérico THEN o app SHALL interpretar como 10.5.
5. The todo campo SHALL ter um texto de ajuda (`FieldTooltip`) de no máximo 2 frases explicando o efeito do campo no resultado.
6. IF o usuário digita um valor fora do intervalo permitido THEN o app SHALL mostrar abaixo do campo "Use um valor entre <mín> e <máx> <unidade>." e SHALL não enviar a requisição.

**Independent Test**: revisar os ~60 rótulos (lista em `grep "<Label"`); em Opções, digitar taxa "10,5" e conferir que a API recebe `r: 0.105`.

### P1: Resultado com leitura em português ⭐ MVP

**User Story**: Como gestor, quero saber o que o número significa para a usina.

**Acceptance Criteria**:

1. The cada ferramenta SHALL mostrar, acima ou ao lado do resultado principal, uma frase de leitura gerada com os valores do resultado.
2. WHEN o VaR é calculado THEN a frase SHALL seguir o modelo "Com <confiança>% de confiança, a queda em <horizonte> dia(s) não deve passar de <valor> (<percentual>)."
3. WHEN a simulação Monte Carlo termina THEN a frase SHALL seguir o modelo "Em <dias> dias úteis, o preço deve ficar entre <P5> e <P95> em 90% dos cenários; o valor central é <P50>."
4. WHEN o breakeven de Cenários é calculado THEN a frase SHALL seguir o modelo "O EBITDA zera com <variável> em <breakeven>. A chance de ficar abaixo disso é <probabilidade>."
5. The demais ferramentas (Volatilidade, Stress, ARIMA, Jump Diffusion, Risco, Metas, Breakeven, Regressões, ATR, Opções) SHALL ter frase de leitura definida no `design.md` desta feature antes da implementação.
6. The todo valor numérico de resultado SHALL ser exibido com `lib/format.ts` e com unidade.

**Independent Test**: rodar cada ferramenta e conferir a frase com os números exibidos.

### P1: Ativos pelo nome ⭐ MVP

**User Story**: Como usuário, quero ver "Açúcar NY nº 11", não "SB=F".

**Acceptance Criteria**:

1. The seletores de ativo, títulos e frases de leitura SHALL mostrar o nome do ativo de `lib/ativos.ts`.
2. IF o ticker não está no mapa THEN o app SHALL mostrar o próprio código.

**Independent Test**: abrir VaR, Volatilidade e Monte Carlo; nenhum seletor mostra só o código para SB=F e USDBRL=X.

### P2: Menu com nomes do que a ferramenta responde

**User Story**: Como usuário novo, quero achar a ferramenta pelo problema que tenho.

**Acceptance Criteria**:

1. The menu lateral SHALL usar os nomes definidos em Assumptions (com o termo técnico entre parênteses quando houver).
2. The cada item do menu SHALL ter uma descrição de uma linha visível no `PageHeader` da página.

**Independent Test**: leitura do menu e dos cabeçalhos.

### P3: Glossário

**User Story**: Como usuário, quero consultar o significado de termos como ATR, VHP, CBIO, VaR, volatilidade.

**Acceptance Criteria**:

1. The app SHALL ter a página `/app/glossario` com termos em ordem alfabética, cada um com definição de até 3 frases.
2. WHEN um termo do glossário aparece num `FieldTooltip` THEN o tooltip SHALL ter o link "Ver no glossário".

**Independent Test**: abrir o glossário pelo menu "Conta" e por um tooltip.

---

## Edge Cases

- IF o resultado não tem valor (API devolveu `null`) THEN a frase de leitura SHALL ser substituída por "Sem dados suficientes para este cálculo."
- WHEN a probabilidade é menor que 1% THEN o app SHALL mostrar "menos de 1%" em vez de "0,00%".

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| LING-01 | P1: Campos (rótulos e unidades) | - | Pending |
| LING-02 | P1: Campos (entrada em %, vírgula, validação) | - | Pending |
| LING-03 | P1: Resultado com leitura (VaR, MC, Cenários) | - | Pending |
| LING-04 | P1: Resultado com leitura (demais ferramentas) | - | Pending |
| LING-05 | P1: Ativos pelo nome | - | Pending |
| LING-06 | P2: Menu com nomes claros | - | Pending |
| LING-07 | P3: Glossário | - | Pending |

**Coverage:** 7 total, 0 mapeados (Large: precisa de design.md com o texto de cada tela).

## Success Criteria

- [ ] Um analista de usina sem formação em finanças explica o resultado do VaR e do Monte Carlo lendo só a tela.
