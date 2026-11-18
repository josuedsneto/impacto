# UX de navegação e linguagem — Especificação

Continuação de `linguagem-clara` (já entregue). Premissa: AD-001, "simples, bonito e claro" para a equipe de usina e de trading.

## Problem Statement

O menu tem 21 itens em 5 grupos que não respondem a uma pergunta de negócio. Duas telas de breakeven têm nomes parecidos e uma delas (`/app/cenarios`) tem URL e título que não batem. "Mercado e sinais" e "Preços diários" se sobrepõem. Os resultados ainda têm jargão ("P5", "P95", "R²", "RMSE"), seis cartões iguais no VaR, unidades ausentes no Jump Diffusion e defaults presos (NY = 20 ¢/lb, faixa de 100.000.000, meta fixa de R$ 2.600/t). Há quatro formatos diferentes de seletor de ativo, e as regressões só mostram um toast quando um campo está errado. O Monte Carlo longo não tem cancelamento, e o VaR pode mostrar resposta de uma requisição antiga.

## Goals

- [ ] O menu tem 5 grupos nomeados por pergunta de negócio, com lugar reservado para as 5 entradas que outras threads vão adicionar.
- [ ] Cada tela tem um nome igual no menu, no título e na URL; as rotas antigas redirecionam.
- [ ] Nenhum resultado mostra "P5", "P95", "R²" ou "RMSE" sem explicação em português.
- [ ] Defaults de mercado (NY, câmbio, meta) vêm do último dado disponível, com origem e data visíveis.
- [ ] VaR, Stress e Volatilidade usam o mesmo `TickerSelect`.
- [ ] Erros de campo aparecem no próprio campo, com `aria-invalid` e mensagem em português.

## Out of Scope

| Item | Motivo |
|------|--------|
| `field-tooltip`, rótulos `htmlFor`, gráficos e header | Domínio da thread `ux-acessibilidade`. |
| Cálculo de R² e RMSE (backend) | Thread `regressoes-honestas`. Aqui só o texto. |
| Criar as telas Câmbio, Alertas, Posições da safra, Receita em R$, Minhas análises | Outras threads; aqui só o grupo reservado. |
| Salvar meta no banco | Backend não tem campo de meta; usa `localStorage` (ver Assumptions). |
| Mudar fórmulas, endpoints ou respostas da API | Esta feature é só interface e roteamento. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Estrutura do menu | 5 grupos: Preço e mercado; Cenários e simulações; Risco e resultado; Modelos; Conta (ver mapeamento abaixo) | Pergunta de negócio por grupo; nomes validados pelo advisor Opus | n |
| Rota do breakeven da safra | `/app/cenarios` → `/app/breakeven-safra` com redirect permanente em `next.config.ts` | URL = título = menu | n |
| Nomes dos dois breakevens | Menu e título: "Preço de equilíbrio do açúcar (R$/saca)" (`/app/breakeven`) e "Preço de equilíbrio do EBITDA" (`/app/breakeven-safra`) | Diferencia pela pergunta que cada tela responde | n |
| Mercado unificado | Nova rota `/app/mercado` com abas Preços / Indicadores / Sinais. `/app/fixacoes` e `/app/market` redirecionam para `/app/mercado`. Conteúdo das duas telas vira componentes reaproveitados | Remove a sobreposição sem backend novo | n |
| Sinais técnicos | Aba Sinais mostra a lista de entradas e saídas com o aviso "Sinais técnicos automáticos, não são recomendação de operação." | Pedido da auditoria | n |
| Nomes sem termo técnico no menu | "Simulação de preços (Monte Carlo)", "Simulação com saltos", "Projeção de preço" (descrição cita ARIMA), "Perda máxima (VaR)" (mantido, já aprovado em `linguagem-clara`) | Termo técnico só entre parênteses | n |
| Defaults NY e câmbio (breakeven da safra) | Último fechamento de `SB=F` e `USDBRL=X` via `GET /api/market/prices` (últimos 10 dias). Mostra "último fechamento de dd/mm/aaaa". Se falhar, cai no valor anterior e mostra o aviso | Usa endpoint existente, sem backend novo | n |
| Faixa por variável (breakeven da safra) | NY: 0,01 a 500 ¢/lb; Moagem: 1.000 a 50.000.000 t; Câmbio: 0,01 a 20 R$/US$; Etanol: 1 a 20.000 R$/m³ | Faixas realistas, uma por variável | n |
| Meta (Metas) | Padrão = última meta usada, salva em `localStorage` (`metas.ultimaMeta`); sem valor salvo, R$ 2.600/t | Backend não guarda meta; sem tabela nova | n |
| Seletor de ativo | `TickerSelect` (já existe) usado em VaR, Stress e Volatilidade; abas e botões saem | Um padrão só | n |
| Erros de backend | `ApiError` ganha `campos` com o `loc` do 422 do Pydantic; formulário mapeia para o rótulo em português | Mostra o campo certo | n |

**Open questions:** nenhuma aberta. A meta fica em `localStorage` por decisão de default; se o usuário quiser salvar no banco, vira feature nova.

---

## Decisões após revisão do advisor Opus

Estas decisões valem sobre as tabelas abaixo quando houver conflito.

1. Mantém 5 grupos pedidos pelo usuário: Preço e mercado; Cenários e simulações; Risco e resultado; Modelos; Conta. Entradas reservadas: Câmbio e Alertas (Preço e mercado); Fixações e hedge e Receita da safra (R$) (Risco e resultado); Análises salvas (Conta).
2. Breakeven da safra: título e menu "Ponto de equilíbrio da safra (EBITDA zero)", rota `/app/breakeven-safra`.
3. Redirects com `permanent: false` (não ficam gravados no navegador). `/app/market` → `/app/mercado?aba=precos`; `/app/fixacoes` → `/app/mercado?aba=sinais`; `/app/cenarios` → `/app/breakeven-safra`. A aba fica na URL (`?aba=precos|indicadores|sinais`).
4. Faixas por variável (validação do campo, LING-02 AC6): NY 1 a 200 ¢/lb; Moagem 1.000 a 100.000.000 t; Câmbio 0,5 a 20 R$/US$; Etanol 100 a 20.000 R$/m³.
5. Fallback de defaults: busca 15 dias corridos; se falhar, usa o default fixo atual (20 ¢/lb e câmbio 5,25).
6. Meta: o desenho separa a origem. Só a meta usa `localStorage` (chave `metas.ultimaMeta`), lida em `useEffect`, aceita só número finito > 0. Não é "dado de mercado".
7. VaR: "Perda máxima em 1 dia com <confiança>%".
8. Divergências mantidas por pedido explícito do usuário (anotadas para decisão dele): "Projeção de preço" (advisor sugeria manter "Previsão de preço (ARIMA)"); rótulos "Cenário ruim/central/bom" do Monte Carlo (advisor sugeria rótulos neutros, pois o sinal depende de comprar ou vender).
9. Testes: `regras-linguagem.test.ts` troca `cenarios` por `breakeven-safra`; novo teste lê `next.config.ts` e confere os redirects.

## Mapeamento do menu (LING-06 revisado)

| Grupo | Item (label = título da página) | Rota | Estado |
|---|---|---|---|
| Dashboard (sem grupo) | Dashboard | `/app/dashboard` | existente |
| **Preço e mercado** | Mercado | `/app/mercado` | nova (fusão de fixacoes + market) |
| | Notícias | `/app/noticias` | existente |
| | Boletim Focus | `/app/focus` | existente |
| | Metas | `/app/metas` | existente |
| | *Câmbio* | reservado | outra thread |
| | *Alertas* | reservado | outra thread |
| **Cenários e simulações** | Simulação de preços (Monte Carlo) | `/app/simulation` | renomeado |
| | Simulação com saltos | `/app/jump-diffusion` | renomeado |
| | Opções | `/app/options` | movido |
| | *Minhas análises* | reservado | outra thread |
| **Risco e resultado** | Perda máxima (VaR) | `/app/var` | existente |
| | Volatilidade | `/app/volatilidade` | existente |
| | Teste de estresse | `/app/stress` | existente |
| | Risco do EBITDA | `/app/risco` | existente |
| | Preço de equilíbrio do açúcar (R$/saca) | `/app/breakeven` | renomeado |
| | Preço de equilíbrio do EBITDA | `/app/breakeven-safra` | renomeado (era `/app/cenarios`) |
| | *Posições da safra* | reservado | outra thread |
| | *Receita em R$* | reservado | outra thread |
| **Modelos** | Projeção de preço | `/app/arima` | renomeado |
| | Modelo do açúcar | `/app/regressao-acucar` | existente |
| | Modelo do dólar | `/app/regressao-dolar` | existente |
| | ATR da usina | `/app/atr` | movido de Análise |
| **Conta** | Parâmetros | `/app/params` | existente |
| | Glossário | `/app/glossario` | existente |

Entradas reservadas aparecem só neste mapa; o `NavLinks.tsx` ganha um comentário por grupo, sem placeholder visível. Uma thread que adicionar a tela inclui o item no grupo indicado.

Redirects em `next.config.ts` (permanentes): `/app/cenarios` → `/app/breakeven-safra`; `/app/fixacoes` → `/app/mercado`; `/app/market` → `/app/mercado`.

---

## User Stories

### P1: Menu por pergunta de negócio ⭐ MVP

**User Story**: Como usuário novo, quero achar a ferramenta pelo problema que tenho.

**Acceptance Criteria**:

1. The menu SHALL ter os 5 grupos e os itens do mapeamento acima, com o `label` igual ao `titulo` da página (`lib/regras-linguagem.test.ts`).
2. WHEN o usuário abre `/app/cenarios`, `/app/fixacoes` ou `/app/market` THEN o app SHALL redirecionar para a rota nova.
3. The duas telas de breakeven SHALL ter nomes diferentes, com a unidade ou a variável no nome.
4. The menu SHALL ter comentário em cada grupo listando as entradas reservadas (sem exibir nada).

**Independent Test**: `npm test` (regras de menu e títulos); abrir cada rota antiga e conferir o redirect.

### P1: Mercado unificado ⭐ MVP

**User Story**: Como analista, quero ver preço, indicadores e sinais na mesma tela.

**Acceptance Criteria**:

1. The `/app/mercado` SHALL ter abas Preços, Indicadores e Sinais.
2. The aba Preços SHALL manter a consulta de preços e o formulário de sugestão de ticker.
3. The aba Indicadores SHALL manter a análise com os indicadores e o tipo de gráfico.
4. The aba Sinais SHALL listar entradas e saídas (data, sinal, indicador, preço) e mostrar "Sinais técnicos automáticos, não são recomendação de operação." acima da lista.

**Independent Test**: abrir Mercado, trocar as três abas, conferir o aviso na aba Sinais.

### P1: Resultados sem jargão ⭐ MVP

**User Story**: Como gestor, quero ler o resultado sem saber a sigla.

**Acceptance Criteria**:

1. The Monte Carlo SHALL mostrar "Cenário ruim (5% das chances)", "Cenário central" e "Cenário bom" nos lugares de P5, P50 e P95.
2. The regressões SHALL mostrar "Qualidade do ajuste (R²)" e "Erro médio da previsão (RMSE)" com tooltip explicando cada uma em 1–2 frases.
3. The VaR SHALL mostrar um cartão de destaque com "Perda máxima em 1 dia com 95%: <valor>" e o horizonte "1 dia" visível; os demais números ficam em "Detalhes técnicos" (`<details>`).
4. The Jump Diffusion SHALL ter unidades nos rótulos: "Volatilidade diária (% ao dia)"; "Tamanho médio do salto (%)" com ajuda "−2 é uma queda de 2%".

**Independent Test**: rodar cada tela e conferir os rótulos.

### P1: Defaults ligados ao mercado ⭐ MVP

**User Story**: Como usuário, quero que a tela comece com o preço de hoje, não com um número antigo.

**Acceptance Criteria**:

1. WHEN o breakeven da safra abre THEN NY e câmbio SHALL vir do último fechamento disponível, com a frase "último fechamento de dd/mm/aaaa".
2. IF o último fechamento não puder ser buscado THEN o app SHALL usar os valores anteriores e mostrar "Não foi possível buscar o preço de hoje; use os valores padrão.".
3. WHEN o usuário escolhe uma variável THEN a faixa aceita SHALL ser a da tabela de Assumptions.
4. WHEN a tela Metas abre THEN a meta SHALL vir de `localStorage` (última usada) ou R$ 2.600/t; ao calcular, o valor SHALL ser salvo.

### P1: Seletor de ativo único ⭐ MVP

**User Story**: Como usuário, quero escolher o ativo do mesmo jeito em toda tela.

**Acceptance Criteria**:

1. VaR, Teste de estresse e Volatilidade SHALL usar `TickerSelect`.
2. The VaR SHALL trocar de ativo sem abas (o estado do ativo é o mesmo do seletor).

### P2: Erros no campo ⭐ MVP

**User Story**: Como usuário, quero ver em qual campo está o erro.

**Acceptance Criteria**:

1. WHEN o usuário envia um formulário de regressão com campo vazio ou fora da faixa THEN cada campo inválido SHALL ter `aria-invalid` e a mensagem abaixo dele, e o envio SHALL não ser feito.
2. IF a API responde 422 com `detail` por campo THEN o formulário SHALL marcar o campo com o nome em português ("Estoque inicial mundial: valor inválido.").
3. The toast genérico "Preencha todos os campos..." SHALL virar "Revise os campos destacados."

### P2: Monte Carlo longo

**User Story**: Como usuário, quero saber quanto tempo falta e poder cancelar.

**Acceptance Criteria**:

1. WHILE a simulação roda THEN o app SHALL mostrar "Isso pode levar até 1 minuto." e o botão "Cancelar".
2. WHEN o usuário clica em Cancelar THEN a requisição SHALL ser abortada (AbortController), sem toast de erro, e o formulário volta ao estado inicial.

### P2: VaR sem corrida

**User Story**: Como usuário, quero que o resultado mostrado seja o do ativo e nível escolhidos agora.

**Acceptance Criteria**:

1. WHEN o ativo ou o nível de confiança muda THEN a requisição anterior SHALL ser abortada (AbortController no `useEffect`), e só a última resposta SHALL aparecer.

---

## Edge Cases

- IF a resposta chega depois de o usuário trocar de ativo THEN ela SHALL ser descartada.
- IF o último fechamento vier vazio (feriado) THEN o app SHALL buscar até 10 dias úteis e usar o mais recente.
- IF a meta salva em `localStorage` não for número THEN o app SHALL usar R$ 2.600/t.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| UXN-01 | P1: Menu por pergunta de negócio | - | Implementing |
| UXN-02 | P1: Mercado unificado | - | Implementing |
| UXN-03 | P1: Resultados sem jargão | - | Implementing |
| UXN-04 | P1: Defaults ligados ao mercado | - | Implementing |
| UXN-05 | P1: Seletor de ativo único | - | Implementing |
| UXN-06 | P2: Erros no campo | - | Implementing |
| UXN-07 | P2: Monte Carlo longo | - | Implementing |
| UXN-08 | P2: VaR sem corrida | - | Implementing |

**Coverage:** 8 total, 0 mapeados. Mapeamento de reservas: seção "Mapeamento do menu".

## Success Criteria

- [ ] Nenhuma tela do menu tem nome diferente entre menu, título e URL.
- [ ] Um analista consegue dizer, lendo só o VaR, quanto pode perder em 1 dia com 95%.
- [ ] `npm test`, `npm run lint` e `npm run build` passam; `test_calcs.py` e `test_mensagens.py` não mudam.
