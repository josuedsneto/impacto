# Estado do projeto

## Decisões

| ID | Data | Decisão | Motivo |
|----|------|---------|--------|
| AD-001 | 2026-10-05 | Premissa do refactoring: **simples, bonito e claro para o usuário final** (equipe de usina/trading, UI em português). Toda spec é julgada contra essa premissa. | Pedido do usuário após a auditoria. |
| AD-002 | 2026-10-05 | Tema claro + escuro, com botão de troca no menu do usuário. Um único sistema de tema (o `ThemeProvider` próprio); `next-themes` sai. | Decisão do usuário. Hoje coexistem dois sistemas e nenhum funciona. |
| AD-003 | 2026-10-05 | Dados reais de ATR entram por upload de planilha (histórico) **e** por formulário mensal (lançamentos novos). | Decisão do usuário. `Historico Impurezas.xlsx` serve de carga inicial. |
| AD-004 | 2026-10-05 | Exportação em CSV padrão Excel BR: separador `;`, vírgula decimal, UTF-8 com BOM. | Decisão do usuário. Abre direto no Excel pt-BR, sem dependência nova. |
| AD-005 | 2026-10-05 | Responsivo completo: menu vira gaveta abaixo de 1024px; todas as páginas usáveis a partir de 360px. | Decisão do usuário. |
| AD-006 | 2026-10-05 | O app Streamlit legado sai do repositório. A remoção dos arquivos é feita pelo usuário (o agente foi bloqueado pela política de permissões). | Decisão do usuário. |
| AD-007 | 2026-10-05 | Correções de cálculo da auditoria já entregues no commit `39c87a1` (branch `refactor/auditoria`): volatilidade anual→diária no Monte Carlo, passo diário no Jump Diffusion, breakeven de Cenários via `brentq`, MC call exato, endpoints síncronos, cliente Supabase único, menu completo. | Bugs inequívocos, corrigidos antes das specs. |
| AD-008 | 2026-10-05 | Toda cor de interface vem de token em `frontend/app/globals.css` (paleta de gráficos validada com o dataviz); todo número exibido passa por `frontend/lib/format.ts`. `lib/regras-ui.test.ts` faz valer as duas regras. | Feature `fundacao-ui`; evita a volta de cores e formatação espalhadas. |

## Ordem de execução

As features dependem umas das outras nesta ordem. Cada uma tem `spec.md` em `features/`.

1. `limpeza-legado` — tira o ruído antes de mexer no resto.
2. `cliente-api` — base de toda chamada do frontend.
3. `fundacao-ui` — tokens, tema, formatação, feedback, layout responsivo.
4. `linguagem-clara` — textos, unidades e ajuda por página (usa `fundacao-ui`).
5. `exportar-csv` — usa o formatador de `fundacao-ui`.
6. `dados-mercado-cache` — backend.
7. `regressao-acucar-honesta` — backend + tela.
8. `atr-dados-reais` — backend + tela (a maior; depende de 2, 3, 4).
9. `backend-robustez` — ajustes P2.

## Handoff

- **Branch:** `refactor/auditoria` (sem push).
- **Concluído:** `cliente-api` (validação em `features/cliente-api/validation.md`, PASS; UAT de 2 telas pendente). `limpeza-legado` LEG-02..04.
- **Pendente do usuário:** rodar o `git rm` do Streamlit (LEG-01, comando em `features/limpeza-legado/spec.md`); UAT do login (2 passos em `features/cliente-api/validation.md`).
- **Próximo passo:** `fundacao-ui` — escrever `design.md` e `tasks.md` (feature Large) antes de implementar.
- **Ambiente:** `frontend/node_modules` instalado; testes do front com `npm test` (vitest).
