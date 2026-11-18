# Validação — ux-acessibilidade

## Evidências automáticas

| Comando | Resultado |
|---|---|
| `cd frontend && npx vitest run` (`npm test`) | 13 arquivos, 253 testes passando |
| `cd frontend && npx tsc --noEmit -p .` | 0 erros de tipo |
| `cd frontend && npm run build` | build concluído (BUILD_EXIT=0), rodado antes da última rodada de rótulos |
| `cd frontend && npm run lint` | **1 erro pré-existente** em `components/ui/input.tsx:4` (`no-empty-object-type`), igual ao branch base; arquivo não alterado nesta feature |
| `cd backend && python test_calcs.py` | não rodado: backend não foi alterado nesta feature |

Testes novos: `lib/regras-ui.test.ts` ganha o bloco "tokens nos primitivos de UI", que falha se `text-white` ou `bg-white` voltar em `components/ui/button.tsx` ou `components/ui/slider.tsx` (UXA-09).

## Requisitos

| ID | Status | Evidência |
|---|---|---|
| UXA-01 | Feito | `components/ui/field-tooltip.tsx` (botão + Popover do `radix-ui`); `components/ui/popover.tsx` |
| UXA-02 | Feito | `htmlFor`/`id` em fixacoes (De/Até); `aria-label` nos Selects de var, arima e TickerSelect; grupos com `aria-labelledby` em jump-diffusion e cenarios; `aria-pressed` em Fixações e Jump |
| UXA-03 | Feito | "Fechamento de DD/MM/AAAA" em `PriceCard` (último `date`), VaR, ARIMA, Stress e Volatilidade (`ultimo_dado`) |
| UXA-04 | Feito | `app/app/layout.tsx`: "SELIC fim de ano (Focus)" |
| UXA-05 | Feito (parcial no "se der") | `role="img"` + `aria-label` em todos os gráficos Recharts e no Plotly de Fixações. FanChart com títulos de eixo, prop `unidade` e `<details>` com tabela. Tabela recolhível só no FanChart (decisão da spec) |
| UXA-06 | Feito | `cenarios/page.tsx`: texto e ícone acima de 30%, legenda do limite, marcador "▼" com `sr-only` na grade de percentis |
| UXA-08 | Feito | `app/page.tsx` sem texto abaixo de 11 px; login com "Link por e-mail" |
| UXA-09 | Feito | `--destructive-foreground` em `globals.css`; `button.tsx` e `slider.tsx` sem branco fixo; teste em `regras-ui.test.ts` |
| UXA-10 | Feito no código, não verificado no navegador | `<title>{titulo} · Sugarcane</title>` em `components/layout/PageHeader.tsx` |
| UXA-11 | Feito, não verificado no celular | `risco/page.tsx`: `max-sm:` transforma a tabela em cartões; `metas/page.tsx`: primeira coluna `sticky` dentro de `overflow-x-auto` |

Decisões que mudaram em relação à spec inicial, todas com base na revisão do advisor Opus:
- Mini-gráfico do `PriceCard` removido, sem sparkline.
- Popover sem `aria-describedby` (o texto já está no `aria-label`) e sem abertura por foco (abrir por Enter/Espaço já é o padrão do `<button>`).
- Título por rota feito via `<title>` do React 19 no `PageHeader`, porque as páginas são `"use client"` e `export const metadata` não serve nelas.

## UAT para o usuário

Use Chrome em tela de 360 px e em desktop.

1. **Ajuda de campo (UXA-01).** Em Breakeven, Volatilidade ou Cenários, toque no "i" ao lado de um campo. Deve abrir um balão com o texto. Toque fora ou aperte Esc: fecha. Com Tab, chegue ao "i" e aperte Enter: deve abrir.
2. **Data de referência (UXA-03).** No Dashboard, os cartões de Açúcar e Dólar mostram "Fechamento de DD/MM/AAAA". Em VaR, ARIMA, Teste de estresse e Volatilidade, após um cálculo, aparece a mesma frase. Se o dado não existir, a frase some e não aparece "undefined".
3. **Título da aba (UXA-10).** Abra Risco e depois VaR. A aba do navegador deve mudar para "Risco · Sugarcane" e "Perda máxima (VaR) · Sugarcane". Esta é a verificação que ficou pendente: confirme no navegador.
4. **Breakeven (UXA-06).** Em Cenários, com probabilidade acima de 30%, deve aparecer o ícone de alerta e "Acima de 30%: alerta…". Abaixo, aparece a legenda do limite. Na grade de percentis, as células abaixo do breakeven têm "▼".
5. **Celular (UXA-11).** Em Risco, abaixo de 640 px, cada variável vira um cartão com os três campos rotulados. Em Metas, a coluna do açúcar fica fixa ao rolar a matriz para o lado. Confirme no celular real.
6. **Gráfico do leque (UXA-05).** Em Simulação, após simular, o gráfico tem títulos "Dias" e "Preço (¢/lb)". Abaixo, "Ver dados em tabela" abre a tabela de percentis.
7. **Landing e login (UXA-08).** Na landing, nenhum texto está pequeno demais. Na tela de login, a aba se chama "Link por e-mail".
8. **Header (UXA-04).** O item de juros no topo do app diz "SELIC fim de ano (Focus)".

Pendências conhecidas:
- Lint: erro pré-existente em `components/ui/input.tsx` (base `refactor/auditoria`). Corrigir ali afeta outras telas, então fica para a coordenadora.
- `SBV24.csv` aparece modificado na worktree. Não pertence a esta feature e não foi incluído nos commits.
