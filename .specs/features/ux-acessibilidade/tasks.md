# Tarefas — ux-acessibilidade

| # | Tarefa | Requisitos | Status |
|---|--------|-----------|--------|
| T1 | Criar `components/ui/popover.tsx` (wrapper shadcn de `radix-ui`) | UXA-01 | feito |
| T2 | Reescrever `FieldTooltip` como botão com popover (área 24 px, aria-label) | UXA-01 | feito |
| T3 | Tokens: `--destructive-foreground`; `button` e `slider` sem branco fixo; teste | UXA-09 | feito |
| T4 | Teste de regra para `text-white`/`bg-white` em button e slider | UXA-09 | feito |
| T5 | Rótulos: Selects (var, arima, TickerSelect), datas (fixacoes), slider (metas), grupos (jump-diffusion, cenarios) | UXA-02 | feito |
| T6 | `aria-pressed` nos botões de tipo de gráfico (Fixações) e de ativo (Jump) | UXA-02 | feito |
| T7 | "Fechamento de DD/MM/AAAA": PriceCard (remove mini-gráfico), VaR, ARIMA, Stress, Volatilidade | UXA-03 | feito |
| T8 | SELIC fim de ano (Focus) no header | UXA-04 | feito |
| T9 | FanChart: prop `unidade`, títulos de eixo, `role="img"`, `<details>` com tabela; simulation passa `unidadeAtivo` | UXA-05 | feito |
| T10 | `role="img"` + aria-label nos demais gráficos (arima, cenarios, jump, metas, risco, volatilidade, atr, regressões, fixações) | UXA-05 | feito |
| T11 | Breakeven: texto + ícone acima de 30%, legenda, marcador "▼" com sr-only na grade | UXA-06 | feito |
| T12 | Landing: nenhum texto abaixo de 11 px | UXA-08 | feito |
| T13 | Login: "Link por e-mail" | UXA-08 | feito |
| T14 | `<title>` por rota via `PageHeader` | UXA-10 | feito no código; verificação no navegador pendente (UAT) |
| T15 | Risco: cartões abaixo de 640 px (CSS); Metas: primeira coluna fixa | UXA-11 | feito; comportamento no celular pendente (UAT) |
| T16 | Mini-gráfico do PriceCard removido (decisão do advisor) | — | feito |
| T17 | `npm test`, `tsc`, `npm run lint`, `npm run build` | todos | rodados; lint com 1 erro pré-existente (ver validation.md) |
| T18 | Rótulos corrigidos após revisão do advisor: ATR = açúcar total recuperável; tooltips fora de `<Label>` (nome acessível limpo); descrição de Risco, Metas e coeficientes do dólar | UXA-02, UXA-05 | feito |
