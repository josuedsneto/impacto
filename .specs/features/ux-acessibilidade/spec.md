# UX e acessibilidade — Especificação

## Problem Statement

A auditoria de UX achou barreiras para o público de negócio (traders, gestores de risco, diretoria). A explicação de cada parâmetro vive num tooltip que só abre com hover: no celular e no teclado ele não abre. Campos de formulário não estão ligados aos rótulos, então leitores de tela não os anunciam. Não há data de referência nas cotações. Gráficos não têm título de eixo nem resumo textual. A tabela de Risco estoura em celular. O texto da landing chega a 8 px.

## Goals

- [ ] Toda ajuda de campo abre por clique/toque e por teclado (Enter/Espaço), com Esc para fechar.
- [ ] Todo campo listado na auditoria tem rótulo associado (`htmlFor`/`id` ou `aria-label`).
- [ ] Toda cotação e resultado de preço mostra "Fechamento de DD/MM/AAAA".
- [ ] Gráficos têm `role="img"` com `aria-label` resumindo o conteúdo; `FanChart` tem eixos com unidade e tabela recolhível.
- [ ] Nenhuma informação do breakeven depende só de cor.
- [ ] Nenhum texto da landing abaixo de 11 px.
- [ ] Rótulos de auth e header dizem o que o valor é.
- [ ] Cada rota de `/app` tem título próprio na aba.
- [ ] Risco vira cartões empilhados abaixo de 640 px; Metas mantém a matriz com rolagem horizontal e primeira coluna fixa.
- [ ] Botões e sliders usam tokens de cor (AD-008).

## Out of Scope

| Item | Motivo |
|------|--------|
| Estrutura do menu e nomes das ferramentas | Feature `ux-navegacao-linguagem`. |
| `PayoffChart` | Thread `opcoes-black76`. Não é tocado. |
| Mini-gráfico do dashboard (`PriceCard`) | Decisão: **removido**. As 90 barras sem eixo nem data não respondem nenhuma pergunta de decisão; o cartão já mostra último preço, variação, máx/mín 12m e a data. Tendência fica em `/app/market`. |
| Tooltip de hover no desktop | Substituído pelo popover; o desktop passa a usar clique também. |
| Tabela recolhível em Cenários e Fixações | Cenários já tem grade de percentis e CSV; Fixações fica com `aria-label`. |
| Testes E2E de leitor de tela | Sem infraestrutura E2E no repo; UAT manual. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Primitivo do popover | `Popover` do pacote `radix-ui` (já instalado, v1.4.3), em `components/ui/popover.tsx` no estilo shadcn | Pedido: já instalado. Sem dependência nova. | y |
| Abertura | Clique/toque e Enter/Espaço (nativo do `<button>`); Esc e clique fora fecham e devolvem o foco | Padrão de disclosure. Abrir também no foco criaria laço com Esc e brigaria com o foco do Radix. | n |
| Nome acessível | `aria-label={text}` no botão; `aria-expanded`/`aria-controls` vêm do Radix. Sem `aria-describedby` | Evita leitura duplicada do mesmo texto. | n |
| Alvo de toque | Área clicável de 24 px com o mesmo visual de 16 px | Mínimo de toque em 24 px. | n |
| Mini-gráfico do dashboard | Removido (ver Out of Scope) | Não ajuda decisão; apaga código. | n |
| Título da aba | `<title>{titulo} · Sugarcane</title>` dentro de `PageHeader` | Páginas são `"use client"`, então `export const metadata` não serve. React 19 eleva a tag ao head. | n |
| Data de referência | Último `date` de `/api/market/prices`; `ultimo_dado` de VaR, ARIMA, Stress e Volatilidade (tipado em cada página) | Backend já devolve; sem mudança em `main.py`. | y |
| Unidade do FanChart | Nova prop `unidade?: string`, passada pela página de simulação via `unidadeAtivo` | FanChart não conhece o ticker. | n |
| Tokens (UXA-09) | `button` destructive usa `text-destructive-foreground`-equivalente: `text-primary-foreground` **não serve** (cor de fundo é destructive); criar `--destructive-foreground` em `globals.css`. Slider thumb: `bg-background` | Sem token de texto sobre destructive hoje. | n |

**Open questions:** nenhuma bloqueante.

---

## User Stories

### P1: Ajuda de campo acessível ⭐ MVP

**Acceptance Criteria**:

1. The app SHALL renderizar `FieldTooltip` como `<button type="button">` com `aria-label` igual ao texto de ajuda e área de toque de 24 px.
2. WHEN o usuário clica/toca ou aperta Enter/Espaço no botão THEN o app SHALL abrir o popover com o texto e, se houver, o link "Ver no glossário".
3. WHEN o usuário aperta Esc ou toca fora THEN o popover SHALL fechar e o foco SHALL voltar ao botão.
4. WHILE aberto, o botão SHALL ter `aria-expanded="true"`.

### P1: Campos com rótulo associado ⭐ MVP

1. WHEN um campo listado na auditoria é renderizado THEN ele SHALL ter `id` e `<label htmlFor>` correspondente, ou `aria-label`.
2. WHEN os botões Candlestick e Linha de Fixações são renderizados THEN cada um SHALL ter `aria-pressed` igual ao estado ativo.

### P1: Data de referência ⭐ MVP

1. WHEN `PriceCard` mostra um preço THEN ele SHALL exibir "Fechamento de DD/MM/AAAA" com a data da última linha.
2. WHEN VaR, ARIMA, Stress ou Volatilidade têm resultado THEN a tela SHALL exibir "Fechamento de DD/MM/AAAA" a partir de `ultimo_dado`.
3. IF não há data THEN a frase SHALL ser omitida.
4. The formatação SHALL usar `formatDate` de `lib/format.ts`.

### P1: SELIC no header ⭐ MVP

1. The header SHALL mostrar "SELIC fim de ano (Focus)".

### P2: Gráficos acessíveis

1. WHEN um gráfico Recharts ou Plotly é renderizado THEN o contêiner SHALL ter `role="img"` e `aria-label` com resumo (a `Leitura` quando houver).
2. WHEN `FanChart` é renderizado THEN os eixos SHALL ter título e unidade via prop `unidade`.
3. WHEN `FanChart` é renderizado THEN SHALL existir `<details>` "Ver dados em tabela".
4. The `PayoffChart` SHALL não ser alterado.

### P2: Breakeven sem depender de cor

1. WHEN a probabilidade de cenário passa do limite de 30% THEN a tela SHALL mostrar o texto "Acima de 30%: alerta" ao lado do número e um ícone, além da cor.
2. A grade de percentis SHALL marcar células abaixo do breakeven com "▼" e texto `sr-only` "abaixo do breakeven".

### P2: Landing e login

1. The landing SHALL não ter texto menor que 11 px.
2. The login SHALL mostrar "Link por e-mail" no lugar de "Magic Link".

### P2: Tokens de cor

1. `button.tsx` (destructive) SHALL usar `text-destructive-foreground`, token novo em `globals.css`; `slider.tsx` SHALL usar `bg-background`.
2. Um teste em `lib/regras-ui.test.ts` (ou arquivo próprio) SHALL falhar se `text-white`/`bg-white` aparecer em `components/ui/button.tsx` ou `components/ui/slider.tsx`.

### P2: Título da aba

1. `PageHeader` SHALL renderizar `<title>{titulo} · Sugarcane</title>`.

### P2: Celular

1. WHILE a largura é menor que 640 px THEN a tabela de Risco SHALL virar cartões empilhados (CSS, sem duplicar inputs).
2. WHILE a largura é menor que 640 px THEN a matriz de Metas SHALL rolar horizontalmente dentro do cartão, com a primeira coluna fixa.

---

## Requirement traceability

| ID | Requisito resumido | Stories |
|----|--------------------|---------|
| UXA-01 | FieldTooltip é botão com popover por clique/Enter; área 24 px | Ajuda |
| UXA-02 | Campos da auditoria com rótulo; aria-pressed | Campos |
| UXA-03 | Data de fechamento em preços e resultados | Data |
| UXA-04 | SELIC fim de ano (Focus) | Header |
| UXA-05 | Gráficos com role/aria-label; FanChart com unidade e tabela | Gráficos |
| UXA-06 | Breakeven com texto/ícone; grade com marcador | Breakeven |
| UXA-08 | Landing ≥ 11 px; "Link por e-mail" | Landing/login |
| UXA-09 | Tokens em button/slider + teste | Cores |
| UXA-10 | `<title>` por rota via PageHeader | Título |
| UXA-11 | Risco em cartões; Metas com rolagem e coluna fixa | Celular |
