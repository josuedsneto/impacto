# Validação — UX de navegação e linguagem

## Evidências

| Requisito | Evidência |
|---|---|
| UXN-01 menu 5 grupos, label = título, redirects | `npx vitest run lib/regras-linguagem.test.ts lib/regras-exportar.test.ts` → 97 passed; `lib/navegacao.test.ts` (redirects) → passed |
| UXN-02 Mercado com abas | build webpack compilou a rota `/app/mercado`; teste manual pendente (UAT) |
| UXN-03 linguagem dos resultados | regras-linguagem (sem `input type="number"`, `<Leitura>` presente) → passed |
| UXN-04 defaults de mercado | build; comportamento de fallback descrito em código; UAT pendente |
| UXN-05 TickerSelect em VaR/Stress/Volatilidade | build + tsc; UAT pendente |
| UXN-06 erros por campo | `lib/navegacao.test.ts` (camposDeErro, errosDosCampos, errosDaApi) → passed |
| UXN-07 cancelar Monte Carlo | build + tsc; UAT pendente |
| UXN-08 VaR sem corrida | build + tsc; UAT pendente |

## Comandos e resultados

```
cd frontend && npx tsc --noEmit -p .                  → sem erros
cd frontend && npx vitest run                         → Test Files 14 passed (14); Tests 254 passed (254)
cd frontend && npx eslint app components lib          → 1 erro PRÉ-EXISTENTE em components/ui/input.tsx:4
                                                         (no-empty-object-type; arquivo não alterado nesta feature)
cd frontend && npx next build --webpack               → exit 0 ("Compiled successfully") — rodado antes dos
                                                         últimos ajustes de cancelamento/defaults; tsc e testes rodados depois
cd backend && python test_calcs.py                    → ok (exit 0)
cd backend && python test_mensagens.py                → ok (exit 0)
```

Observação de ambiente: `npm run build` (Turbopack) falha nesta worktree com "Symlink [project]/node_modules is invalid". Causa: `node_modules` é uma junção para a checkout principal, para evitar um `npm ci` que travou. A build com `--webpack` passou.

## UAT (passos para o usuário)

1. **Menu:** abrir o app. Conferir os 5 grupos: Preço e mercado, Cenários e simulações, Risco e resultado, Modelos, Conta.
2. **Redirects:** digitar `/app/cenarios`, `/app/market` e `/app/fixacoes` na barra de endereço. Devem cair em "Ponto de equilíbrio da safra (EBITDA zero)", "Mercado" aba Preços e "Mercado" aba Sinais.
3. **Mercado:** em Indicadores, clicar em Analisar. Trocar para Sinais: a análise continua lá e aparece o aviso "Sinais técnicos automáticos, não são recomendação de operação.".
4. **Breakeven da safra:** abrir a tela. Deve aparecer "último fechamento de dd/mm/aaaa" e NY/câmbio preenchidos. Digitar outro valor de moagem e trocar de variável: o valor digitado não deve ser perdido ao chegar o preço.
5. **Faixas:** digitar NY = 500 no breakeven da safra. Deve aparecer "Use um valor entre 1 e 200 ¢/lb." sem enviar.
6. **Metas:** calcular com meta 2.650. Recarregar a página: a meta deve continuar 2.650 com "última meta usada neste navegador".
7. **VaR:** trocar o ativo e o nível de confiança. Deve haver um cartão "Perda máxima em 1 dia com X%" e a seção "Detalhes técnicos" fechada. Trocar rápido de ativo: só o último resultado aparece.
8. **Monte Carlo:** rodar uma simulação com muitos cenários. Deve aparecer "Isso pode levar até 1 minuto." e o botão Cancelar, que volta ao formulário sem erro.
9. **Regressões:** deixar um campo vazio e enviar: o campo mostra "Informe um número." com o contorno de erro. Ao digitar, a mensagem some.
10. **Jump Diffusion:** conferir "Volatilidade diária (% ao dia)" e a ajuda de "−2".

## Decisões do usuário pendentes

- "Projeção de preço" (pedido) vs. "Previsão de preço (ARIMA)" (advisor).
- Rótulos do Monte Carlo "Cenário ruim/central/bom" (pedido); o advisor sugeriu rótulos neutros, porque o sinal depende de quem compra ou vende.
- Padronizar também o seletor do Jump Diffusion (hoje tem botões próprios).
- A meta fica em `localStorage` por navegador, sem separar por usuário.
