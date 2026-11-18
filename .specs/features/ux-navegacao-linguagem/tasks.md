# Tarefas — UX de navegação e linguagem

Legenda: [x] feito · [ ] pendente

- [x] T1 (UXN-01) Renomear `app/app/cenarios` → `breakeven-safra` (git mv); título "Ponto de equilíbrio da safra (EBITDA zero)".
- [x] T2 (UXN-01) Menu em 5 grupos e entradas reservadas comentadas em `NavLinks.tsx`.
- [x] T3 (UXN-01) Títulos iguais aos rótulos do menu (breakeven, ARIMA "Projeção de preço", Monte Carlo, Mercado).
- [x] T4 (UXN-01) Redirects permanentes: cenarios, market, fixacoes (`next.config.ts`, `permanent: false`).
- [x] T5 (UXN-02) `/app/mercado` com abas Preços / Indicadores / Sinais na URL (`?aba=`); conteúdo montado e escondido com `hidden`.
- [x] T6 (UXN-02) Aviso "Sinais técnicos automáticos, não são recomendação de operação." na aba Sinais, com tabela de sinais.
- [x] T7 (UXN-03) Monte Carlo: "Cenário ruim (5% das chances)", "Cenário central", "Cenário bom".
- [x] T8 (UXN-03) Regressões: "Qualidade do ajuste (R²)" e "Erro médio da previsão (RMSE)" com tooltip.
- [x] T9 (UXN-03) VaR: cartão de destaque, horizonte visível, "Detalhes técnicos" em `<details>`.
- [x] T10 (UXN-03) Jump Diffusion: "% ao dia" e ajuda com exemplo de −2.
- [x] T11 (UXN-04) Breakeven da safra: NY e câmbio do último fechamento (15 dias corridos) com data; fallback com aviso.
- [x] T12 (UXN-04) Faixa por variável (NY 1–200, moagem 1.000–100.000.000, câmbio 0,5–20, etanol 100–20.000).
- [x] T13 (UXN-04) Metas: meta padrão = última usada (`localStorage`, chave `metas.ultimaMeta`), R$ 2.600 sem valor salvo; slider cobre valor salvo.
- [x] T14 (UXN-05) VaR, Stress e Volatilidade usam `TickerSelect`; abas e botões saíram.
- [x] T15 (UXN-06) `campo-numero`: prop `erro`; `errosDosCampos` no envio; `errosDaApi` para o 422; `aria-invalid` por campo.
- [x] T16 (UXN-06) `api.ts`: `ApiError.campos` a partir do `detail` do 422.
- [x] T17 (UXN-07) Monte Carlo: aviso "Isso pode levar até 1 minuto." e botão Cancelar (AbortController).
- [x] T18 (UXN-08) VaR: `useEffect` com AbortController; resposta marcada com a chave do pedido.
- [x] T19 Testes: `regras-linguagem` e `regras-exportar` atualizados; `lib/navegacao.test.ts` novo (redirects e erros por campo).
- [ ] T20 Jump Diffusion mantém os botões de ativo (fora de UXN-05, que lista só VaR, Stress e Volatilidade). Decisão pendente do usuário: padronizar também ali.
