# Fundação de UI — Especificação

## Problem Statement

O visual do app é montado peça por peça: cores escritas direto no código em 15 arquivos (`#9ca3af`, `#3b82f6`…), dois sistemas de tema convivendo sem funcionar, números com ponto decimal (`toFixed`, 91 usos) num app em português, cada página com espaçamento e título próprios, erros ora em texto vermelho, ora em toast — e o `<Toaster>` nem está montado, então os toasts de Fixações, Mercado e Admin nunca aparecem. O layout não tem nenhuma regra responsiva: no celular o menu ocupa a tela. Gráficos usam duas bibliotecas (Recharts e Plotly) com estilos diferentes.

## Goals

- [ ] Toda cor da interface sai de tokens; zero hex escritos em componentes de página.
- [ ] Tema claro e escuro funcionando em todas as telas, com botão de troca.
- [ ] Todo número exibido segue o padrão brasileiro (vírgula decimal, ponto de milhar) e mostra a unidade.
- [ ] Todas as páginas usam o mesmo cabeçalho, espaçamento e padrão de feedback.
- [ ] Todas as páginas usáveis em tela de 360px sem rolagem horizontal da página.

## Out of Scope

| Item | Motivo |
|------|--------|
| Nova identidade visual (logo, marca) | Fora do pedido; usa-se a marca atual "SUGARCANE". |
| Trocar Plotly por Recharts em `FixacoesChart` (candlestick) | Recharts não tem candlestick nativo; reescrever custa mais que o ganho. Os outros 3 gráficos Plotly migram (UI-12). |
| Textos e unidades específicos de cada tela | Feature `linguagem-clara`. Esta feature entrega as ferramentas (formatador, componentes). |
| Animações e transições | Não ajudam a clareza; a premissa é simplicidade. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| Tema inicial de quem nunca escolheu | Segue o sistema operacional (`prefers-color-scheme`) | Hoje o padrão força escuro enquanto o layout é branco fixo | n |
| Sistema de tema | `ThemeProvider` próprio; remover `next-themes` e ajustar `ui/sonner.tsx` | AD-002: um sistema só | y |
| Base de tokens | Variáveis CSS do shadcn já em `globals.css` (`--background`, `--primary`, `--chart-1..5`…) + tokens novos `--positive`, `--negative`, `--sidebar-*` | Já existem e o Tailwind já as mapeia | n |
| Biblioteca de gráficos | Recharts para tudo exceto o candlestick de Fixações | Já é usada em 8 componentes | n |
| Breakpoint do menu | Gaveta abaixo de 1024px (`lg`) | AD-005 | y |
| Precisão padrão | Preços em ¢/lb: 2 casas; câmbio: 4 casas; percentuais: 2 casas; R$: 2 casas | Padrão de mercado para cada grandeza | n |

**Open questions:** none - todas resolvidas ou registradas acima.

---

## User Stories

### P1: Números no padrão brasileiro ⭐ MVP

**User Story**: Como usuário, quero ler "1.234,56" e "R$ 5,4321", não "1234.56".

**Acceptance Criteria**:

1. The app SHALL ter um único módulo `frontend/lib/format.ts` com funções para: número, moeda R$, preço em ¢/lb, câmbio R$/US$, percentual e data.
2. WHEN `formatNumber(1234.5, 2)` é chamada THEN ela SHALL retornar "1.234,50".
3. WHEN `formatPercent(0.0523)` é chamada THEN ela SHALL retornar "5,23%".
4. WHEN `formatBRL(1234.5)` é chamada THEN ela SHALL retornar "R$ 1.234,50".
5. WHEN `formatCents(21.456)` é chamada THEN ela SHALL retornar "21,46 ¢/lb".
6. WHEN `formatFX(5.43219)` é chamada THEN ela SHALL retornar "R$ 5,4322".
7. IF o valor é `null`, `undefined` ou `NaN` THEN toda função de formatação SHALL retornar "—".
8. The código de páginas e componentes (exceto `lib/format.ts`) SHALL não usar `toFixed` para texto exibido ao usuário.

**Independent Test**: teste unitário de `format.ts` com os valores acima; `grep -rn "toFixed" app components` vazio.

### P1: Layout responsivo ⭐ MVP

**User Story**: Como usuário no celular, quero navegar e usar qualquer ferramenta.

**Acceptance Criteria**:

1. WHILE a largura da tela é menor que 1024px o app SHALL esconder o menu lateral e mostrar um botão "Menu" no topo.
2. WHEN o usuário toca em "Menu" THEN o app SHALL abrir o menu como gaveta sobre o conteúdo, com foco no primeiro link.
3. WHEN o usuário escolhe um link ou toca fora da gaveta ou aperta Esc THEN o app SHALL fechar a gaveta.
4. WHILE a largura da tela é menor que 768px as grades de cartões SHALL empilhar em uma coluna.
5. The app SHALL não ter rolagem horizontal da página em 360px em nenhuma rota de `/app`.
6. WHERE a página tem tabela larga a tabela SHALL rolar horizontalmente dentro do próprio cartão.

**Independent Test**: abrir cada rota em 360px, 768px e 1280px; verificar ausência de rolagem horizontal (`document.documentElement.scrollWidth <= innerWidth`).

### P1: Tema claro e escuro ⭐ MVP

**User Story**: Como usuário, quero escolher tema claro ou escuro e ter tudo legível nos dois.

**Acceptance Criteria**:

1. The menu do usuário SHALL ter a opção "Tema escuro"/"Tema claro" que alterna o tema.
2. WHEN o usuário alterna o tema THEN o app SHALL aplicar o novo tema em todas as áreas (cabeçalho, menu, conteúdo, gráficos, toasts) sem recarregar a página.
3. WHEN o usuário volta ao app THEN o app SHALL abrir no último tema escolhido, sem piscar o tema errado.
4. IF o usuário nunca escolheu THEN o app SHALL usar o tema do sistema operacional.
5. The arquivos em `app/` e `components/` (exceto `components/ui/` e `globals.css`) SHALL não conter cores hexadecimais nem `rgb(...)` literais.
6. The texto principal SHALL ter contraste mínimo 4,5:1 contra o fundo nos dois temas.

**Independent Test**: alternar o tema em cada rota; `grep -rnE "#[0-9a-fA-F]{3,6}\b" app components --include=*.tsx | grep -v components/ui` vazio.

### P1: Feedback consistente ⭐ MVP

**User Story**: Como usuário, quero sempre saber se algo está carregando, deu certo ou deu errado.

**Acceptance Criteria**:

1. The layout raiz SHALL montar um único `<Toaster>`.
2. WHEN uma ação do usuário (salvar, simular, aprovar) conclui com sucesso THEN o app SHALL mostrar um toast de sucesso com o que foi feito (ex.: "Simulação salva").
3. IF uma ação do usuário falha THEN o app SHALL mostrar um toast de erro com a mensagem vinda de `apiFetch`.
4. WHILE uma tela carrega dados iniciais o app SHALL mostrar esqueletos no formato do conteúdo.
5. IF o carregamento inicial de uma tela falha THEN o app SHALL mostrar, no lugar do conteúdo, a mensagem de erro e um botão "Tentar novamente".
6. WHILE uma ação está em andamento o botão que a disparou SHALL ficar desabilitado e mostrar o verbo no gerúndio (ex.: "Simulando…").
7. IF uma lista não tem itens THEN o app SHALL mostrar um estado vazio com uma frase e, quando houver, a ação para criar o primeiro item.

**Independent Test**: em Monte Carlo: simular (toast de sucesso), forçar erro de validação (toast de erro), abrir histórico vazio (estado vazio).

### P2: Página padrão

**User Story**: Como usuário, quero que toda ferramenta tenha a mesma estrutura, para não reaprender cada tela.

**Acceptance Criteria**:

1. The app SHALL ter um componente `PageHeader` com título, uma frase de descrição e área opcional de ações.
2. The todas as rotas de `/app` SHALL usar `PageHeader` e o mesmo espaçamento lateral e vertical.
3. WHERE a página tem formulário e resultado o formulário SHALL ficar à esquerda e o resultado à direita em telas ≥1280px, e empilhados abaixo disso.

**Independent Test**: inspeção visual de todas as rotas; `grep -rn "<h1" app/app` só dentro de `PageHeader`.

### P2: Gráficos com um só estilo

**User Story**: Como usuário, quero gráficos com as mesmas cores, fontes e tooltips em todo o app.

**Acceptance Criteria**:

1. The gráficos SHALL usar as cores `--chart-1` a `--chart-5` e acompanhar o tema ativo.
2. The tooltips e eixos dos gráficos SHALL formatar valores com `lib/format.ts`.
3. The `AtrHistorico`, `AcucarCharts` e `DolarCharts` SHALL usar Recharts.

**Independent Test**: alternar tema numa página com gráfico; cores mudam; `grep -rln plotly components` só lista `FixacoesChart.tsx`.

---

## Edge Cases

- IF o `localStorage` está bloqueado (modo privado) THEN o app SHALL usar o tema do sistema sem erro.
- WHEN um valor é negativo THEN `formatBRL(-10)` SHALL retornar "-R$ 10,00".
- WHEN um número é muito grande (≥ 1 milhão) em cartões de resumo THEN o app SHALL abreviar ("R$ 27,8 mi") e mostrar o valor completo no tooltip.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| UI-01 | P1: Números no padrão brasileiro (módulo e regras) | - | Verified |
| UI-02 | P1: Números no padrão brasileiro (sem toFixed) | - | Verified |
| UI-03 | P1: Layout responsivo (gaveta) | - | Implementing |
| UI-04 | P1: Layout responsivo (grades e tabelas) | - | Implementing |
| UI-05 | P1: Tema claro e escuro (alternância e persistência) | - | Implementing |
| UI-06 | P1: Tema claro e escuro (tokens, sem hex) | - | Verified |
| UI-07 | P1: Feedback consistente (toasts) | - | Implementing |
| UI-08 | P1: Feedback consistente (carregando, erro, vazio) | - | Implementing |
| UI-09 | P2: Página padrão (PageHeader) | - | Verified |
| UI-10 | P2: Página padrão (formulário + resultado) | - | Implementing |
| UI-11 | P2: Gráficos com um só estilo (cores e formato) | - | Implementing |
| UI-12 | P2: Gráficos com um só estilo (migrar Plotly) | - | Verified |

**Coverage:** 12 total, 0 mapeados (Large: precisa de design.md e tasks.md antes de executar).

## Success Criteria

- [ ] Um usuário novo usa 3 ferramentas diferentes no celular sem pedir ajuda.
- [ ] Zero cor literal e zero `toFixed` em telas.
