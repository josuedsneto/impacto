# Dados do frontend — Validação

**Spec**: `.specs/features/frontend-dados/spec.md`
**Gate executado em**: 2026-11-18, worktree `bb/melhoria-frontend-dados-thr_x8etdrks5p`

## Evidências por comando

| Comando | Resultado |
|---|---|
| `cd frontend && npm test` | **15 arquivos, 270 testes: todos passam** (saída: `Test Files 15 passed`, `Tests 270 passed`) |
| `cd frontend && npx tsc --noEmit -p .` | exit 0, sem erros |
| `npx eslint <arquivos tocados>` | exit 0, sem erros |
| `cd frontend && npm run build` | exit 0; 28 páginas geradas |
| `npm run lint` (projeto inteiro) | **não rodado** nesta etapa; só os arquivos tocados. |

Testes Python (`backend/`) não foram rodados: nenhuma linha de backend mudou nesta feature.

## Requisitos

| ID | Requisito | Evidência |
|---|---|---|
| FD-01 | URL absoluta exigida no servidor | `lib/dados-servidor.test.ts`: URL `""` e `/api` não chamam `fetch` (passa) |
| FD-02 | Falha de carga logada e devolvida como `ok: false` | `lib/dados-servidor.test.ts`: HTTP 503 e falha de rede (passa); `console.error` verificado |
| FD-03 | Dashboard mostra erro de cotação por ticker | `app/app/dashboard/page.tsx`: `ErrorState` por ticker. Não há teste de render (sem testing-library). Verificação: UAT passo 3 |
| FD-04 | `/api/focus` e cotações uma vez por requisição | Código: `React.cache` em `lib/dados-servidor.ts`; layout e dashboard usam as mesmas funções com 365 dias. **Não testado em vitest** (só vale em Server Component). Verificação: UAT passo 6 |
| FD-05 | Header "Status indisponível" em falha e `UNKNOWN` | `lib/format.test.ts` (`rotuloMercado`, 6 casos passam) |
| FD-06 | Hook `useApi` | `lib/useApi.test.ts` testa `buscar` (2 casos passam). O descarte de resposta antiga é por chave (caminho + tentativa) guardada com a resposta; sem teste de render |
| FD-07 | Breakeven usa `useApi` | `app/app/breakeven/page.tsx` migrado; `ErrorState` com "Tentar novamente" chama `recarregar` |
| FD-08 | Timeout com mensagem própria | `lib/api.test.ts`: timeout espera "O servidor demorou demais para responder. Tente novamente." (passa); falha de rede mantém a mensagem antiga (passa) |
| FD-09 | Sem `toLocale*String(` nem `Intl.` fora de `format.ts` | `lib/regras-ui.test.ts` (passa); `breakeven/page.tsx:112` não tinha `toLocaleString` (achado da auditoria já resolvido) |
| FD-10 | Sem `any` em `FixacoesChart.tsx` | `grep ": any\|as any" components/market/FixacoesChart.tsx` vazio. Desvio: séries tipadas como `Record<string, unknown>` e convertidas em `<Plot>` (ver decisões) |
| FD-11 | Tipos duplicados em `lib/types/` | `lib/types/api.ts`: `PriceRow`, `FocusData`, `MarketStatus`, `SimulationRow`. `FocusWidget`, `PriceCard`, `AccountSummary`, `dados-servidor` importam daqui. `PriceChart` mantém o `PriceRow` local (não migrado) |
| FD-12 | Bundle do Plotly medido | Chunk com Plotly no `next build`: **4.621.863 bytes sem compressão; 1.365.690 bytes gzip** (medido com `gzip -c \| wc -c`). Proposta de troca: ver spec |

## Decisões tomadas nesta feature (além da spec)

- **Erro de cotação sem botão de retry.** O card de servidor não é client; a spec (AS-09) manda o usuário recarregar a página.
- **`FixacoesChart` com `Record<string, unknown>`.** Tipar as séries com `Data` do Plotly exigia converter `null`/`undefined` que o gráfico aceita; o cast fica só em `<Plot>`. Sem `any`.
- **`lib/useApi.ts` com `buscar(caminho, chamar?)`.** O terceiro parâmetro (função de busca com padrão `apiFetch`) deixa o teste sem `vi.mock`: o mock que lança exceção assíncrona fazia o vitest reportar a rejeição como falha do teste.
- **Três `toLocale*` fora da lista da auditoria** (`SuggestionQueue.tsx`, `simulation/page.tsx`, hora em `noticias`) foram trocados para a regra valer sem exceção.

## O que ficou de fora e por quê

- **Migração das outras telas para `useApi`**: plano na spec (lista de 17 telas), uma por commit quando forem tocadas.
- **Geração de tipos OpenAPI**: AS-04.
- **Troca do Plotly por Recharts**: só proposta na spec (aprovação pendente).
- **Teste de página com testing-library**: não instalado; dependência nova sem necessidade clara.
- **Backend devolve `CLOSED` quando o status falha** (`backend/main.py`, `market_status`): a thread `cache-yahoo` precisa trocar por `UNKNOWN`. O frontend já trata `UNKNOWN` e falha como "Status indisponível".
- **Decimação de séries do `market`**: não feita (AS-06); o intervalo do market não tem teto.

## Passo a passo de UAT

Pré-requisito: `NEXT_PUBLIC_API_URL` apontando para o backend (URL absoluta). Entrar com um usuário válido.

1. **Dashboard normal**: cartões de açúcar e dólar com valores, Focus e resumo de simulações aparecem.
2. **Header**: com mercado aberto aparece "Mercado aberto" em verde; fechado, "Mercado fechado".
3. **Falha de cotação**: parar o backend (ou apontar `NEXT_PUBLIC_API_URL` para uma porta sem serviço), recarregar `/app/dashboard`. Esperado: os dois cartões de preço viram "Não foi possível carregar a cotação do açúcar." e "…do dólar." e o log do servidor mostra `[dados-servidor]`. Nenhum cartão mostra "—" em silêncio.
4. **Status indisponível**: com a API fora, o header mostra "Status indisponível" (cinza), não "Mercado fechado".
5. **URL inválida**: definir `NEXT_PUBLIC_API_URL=/api` e recarregar. Esperado: mensagem de erro nos cartões e log "NEXT_PUBLIC_API_URL ausente ou não é URL absoluta".
6. **Uma chamada por requisição**: no log do servidor (Vercel), uma única linha de `/api/focus` por carregamento da página.
7. **Breakeven ao vivo**: abrir `/app/breakeven`. Esperado: cards com valores. Com a API fora, aparece o erro com "Tentar novamente"; clicar recarrega.
8. **Timeout**: (se possível) forçar um endpoint lento. Esperado: "O servidor demorou demais para responder. Tente novamente."
9. **Datas**: em `/app/noticias` e no card "Última simulação" do dashboard, datas no formato "18 nov, 14:05".
10. **Volume**: em `/app/market`, a coluna de volume usa separador de milhar ("1.234.567").
