# Dados do frontend — Especificação

## Problem Statement

A auditoria do frontend achou quatro problemas de dados. (1) No servidor, `BACKEND_URL = NEXT_PUBLIC_API_URL ?? ""`: com URL vazia ou relativa o `fetch` falha, o `catch` devolve `[]`/`null` e os widgets aparecem vazios sem aviso. (2) `layout.tsx` e `dashboard/page.tsx` repetem `fetchPrices` e `fetchFocus`, e `/api/focus` é chamado duas vezes por página. (3) Quando a API cai, o dashboard mostra "—" e o header mostra "Mercado fechado": o usuário não sabe que é falha. (4) Cada tela reimplementa loading, erro e retry no client, e o timeout aparece como "Sem conexão com o servidor".

## Goals

- [ ] Sem URL absoluta do backend, o servidor falha alto (log + estado de erro na tela), nunca em silêncio.
- [ ] Uma carga de dados por requisição: `layout` e `dashboard` compartilham `/api/focus` e as cotações.
- [ ] Falha de cotação mostra "Não foi possível carregar a cotação" no dashboard; header mostra "Status indisponível" quando o status não é conhecido.
- [ ] Timeout tem mensagem própria, diferente de falta de conexão.
- [ ] Números de data/quantidade passam por `lib/format.ts`; a regra é verificada por `regras-ui.test.ts`.
- [ ] Tela de breakeven usa um hook de carga (`useApi`) como referência; plano das outras telas registrado.
- [ ] Os três `any` de `FixacoesChart.tsx` saem.
- [ ] Tamanho do bundle do Plotly medido e decisão de troca registrada (sem executar a troca).

## Out of Scope

| Item | Motivo |
|------|--------|
| Migrar todas as telas para `useApi` | Pedido: uma ou duas telas como referência. Plano fica na spec. |
| SWR / React Query | `cliente-api` já excluiu; sem necessidade comprovada. Ver AS-03. |
| Geração automática dos tipos do OpenAPI (`openapi-typescript`) | Exige backend no ar ou `openapi.json` versionado; ver AS-04. |
| Trocar Plotly por Recharts | Só proposta na spec; exige aprovação do advisor e da coordenadora. |
| Backend devolver `UNKNOWN` e parar de engolir exceção em `/api/market/status` | Thread `cache-yahoo`. Aqui o frontend já trata `UNKNOWN` e falha. |
| Testes de página com testing-library | Não instalado; adicionar dependência sem necessidade clara (regra da casa). |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| AS-01: URL do backend no servidor | Continua `NEXT_PUBLIC_API_URL`, validada no servidor como URL absoluta `http(s)`. Sem nova variável. | Não cria configuração nova na Vercel; `apiFetch` já usa a mesma variável. | n |
| AS-02: Dedupe server-side | `React.cache` em `lib/dados-servidor.ts`. Cotações usam o mesmo intervalo (365 dias) para layout e dashboard compartilharem a carga. | Nativo do React 19; sem dependência. Vale só dentro da requisição de Server Component. | n |
| AS-03: Hook de client | `lib/useApi.ts`, pequeno, sobre `apiFetch`, com descarte de respostas antigas. SWR fica de fora. | `cliente-api` excluiu SWR; cada tela tem carga simples e sem cache compartilhado. | n (advisor) |
| AS-04: Tipos da API | Centralizar os tipos duplicados em `lib/types/`; gerador OpenAPI fica como plano. | O build da Vercel não tem o backend no ar; gerar exigiria versionar `openapi.json`, não compensa com três tipos duplicados. | n (advisor) |
| AS-05: Timeout | Mensagem própria: "O servidor demorou demais para responder. Tente novamente." | Vale para qualquer GET (cotação, histórico), não só cálculo. Detectado por `TimeoutError` do `AbortSignal.timeout`. Substitui a proposta original "O cálculo demorou…" (advisor). | n |
| AS-06: Tamanho das séries | Dashboard e layout: cotações de 1 ano (~250 pontos), sem decimação. `app/app/market/page.tsx` não tem teto (o usuário escolhe o intervalo; 10 anos ≈ 2.500 candles). Não decimar agora; se passar de ~2.000 pontos, limitar o intervalo no formulário. | Plotly aguenta essa ordem; a decimação só se justifica no market. | n (advisor) |
| AS-07: Status com falha | Fonte única: o campo `state` (não `open`). Falha de rede, resposta não 2xx ou `UNKNOWN` mostram "Status indisponível". Só `REGULAR` mostra "Mercado aberto"; outro valor conhecido mostra "Mercado fechado". O `fetchMarketStatus` antigo devolvia `{open:false,state:"CLOSED"}` na falha; isso sai. | Evita que falha pareça fechamento. | n (advisor) |
| AS-08: Formato de retorno das cargas | `Carga<T>` = `{ok:true, dados} \| {ok:false, erro}`, em todos os casos. Vazio é `ok:true` com lista vazia. | Separa vazio de falha. | n (advisor) |
| AS-09: Erro no Server Component | Sem botão de retry nos cards de servidor (não são client). O usuário recarrega a página. | `ErrorState` aceita `onRetry` opcional; no servidor não passamos. | n (advisor) |
| AS-10: Log da URL inválida | Logado a cada carga que falha (não no topo do módulo), porque a falha só acontece quando a carga é chamada. | Mantém o motivo perto da chamada. | n (advisor) |

**Open questions:** nenhuma bloqueante. A decisão de trocar Plotly por Recharts depende de aprovação (ver item 8 em Goals).

---

## User Stories

### P1: Servidor falha alto ⭐ MVP

**User Story**: Como equipe que opera o app, quero que uma URL inválida do backend apareça no log e na tela, não como dashboard vazio.

**Acceptance Criteria**:

1. WHEN o servidor lê `NEXT_PUBLIC_API_URL` THEN `lib/dados-servidor.ts` SHALL aceitar só URL absoluta `http://` ou `https://`, sem barra final.
2. IF a URL estiver vazia ou for inválida THEN cada carga SHALL registrar `console.error` e devolver `{ ok: false, erro }` sem chamar `fetch`.
3. IF uma carga falha (rede, timeout, status não 2xx) THEN a carga SHALL registrar `console.error` com o caminho e devolver `{ ok: false, erro }`.
4. WHEN a cotação de um ticker falha no dashboard THEN o cartão desse ticker SHALL virar `ErrorState` com "Não foi possível carregar a cotação do açúcar." (SB=F) ou "…do dólar." (USDBRL=X). O outro cartão continua.

**Independent Test**: `lib/dados-servidor.test.ts`: URL `""` e `"/api"` não chamam `fetch` e devolvem `ok: false` com log; HTTP 503 e falha de rede devolvem `ok: false`; lista vazia devolve `ok: true`.

### P1: Uma carga por requisição ⭐ MVP

**User Story**: Como desenvolvedor, quero que layout e dashboard peçam cada dado uma vez por requisição.

**Acceptance Criteria**:

1. WHEN layout e dashboard rodam na mesma requisição THEN `/api/focus` e `/api/market/prices` (SB=F e USDBRL=X, 365 dias) SHALL ser chamados uma única vez por requisição.
2. The código SHALL não conter `fetchPrices` nem `fetchFocus` em `app/app/layout.tsx` nem em `app/app/dashboard/page.tsx`; ambos importam de `lib/dados-servidor.ts`.

**Independent Test**: não testado em vitest (`React.cache` só deduplica dentro de um Server Component). Verificação manual: log do servidor na Vercel mostra uma chamada a `/api/focus` por página. Nota (advisor): cada chamada passa seu próprio `signal`, então o Next pode não deduplicar; o `React.cache` é o que garante a unicidade. Não verifiquei isso na doc do Next 16 (a pasta `docs` não vem no pacote instalado).

### P1: Erro visível no header e no dashboard ⭐ MVP

**User Story**: Como usuário, quero saber quando um dado não carregou e não confundir isso com mercado fechado.

**Acceptance Criteria**:

1. IF o status de mercado falha THEN o header SHALL mostrar "Status indisponível" em tom neutro (`bg-muted`, `text-muted-foreground`) (AS-07, AS-08).
2. IF a API responde `state: "UNKNOWN"` THEN o header SHALL mostrar "Status indisponível".
3. IF `state` é conhecido e diferente de `REGULAR` THEN o header SHALL mostrar "Mercado fechado" (comportamento atual).
4. Os valores exibidos no header SHALL continuar como "—" quando faltarem; o estado de erro não substitui a faixa de cotações.

**Independent Test**: função pura `rotuloMercado(status)` em `lib/` com casos: `null` (falha) → "Status indisponível"; `UNKNOWN` → "Status indisponível"; `REGULAR` → "Mercado aberto"; `CLOSED` e `PRE` → "Mercado fechado".

### P2: Hook de carga para o client ⭐ referência

**User Story**: Como desenvolvedor, quero um hook que traga loading, erro e retry, para não reescrever isso em cada tela.

**Acceptance Criteria**:

1. WHEN `useApi(caminho)` monta THEN ele SHALL chamar `apiFetch(caminho)` e expor `{ dados, carregando, erro, recarregar }`.
1a. WHEN `caminho` muda ou o componente desmonta antes da resposta THEN a resposta antiga SHALL ser descartada (sem sobrescrever o estado novo).
2. WHEN `recarregar()` é chamado THEN o hook SHALL chamar `apiFetch` de novo e zerar o `erro` enquanto carrega.
3. IF `caminho` é `null` THEN o hook SHALL não chamar a API (carga condicional).
4. The tela de breakeven (`app/app/breakeven/page.tsx`) SHALL usar `useApi` para a cotação ao vivo, e o `ErrorState` com "Tentar novamente" SHALL aparecer quando a carga falha.

**Independent Test**: `lib/useApi.test.ts` testa `buscar` (a parte sem efeito, com `apiFetch` mockado): sucesso e erro em português sem lançar. O descarte de resposta antiga é revisado no código (`ignorar` no efeito); sem testing-library não há teste de render.

### P2: Mensagem de timeout própria

**User Story**: Como usuário, quero saber que o cálculo demorou, não que a internet caiu.

**Acceptance Criteria**:

1. IF a requisição estoura o tempo limite THEN `apiFetch` SHALL lançar `ApiError` com "O servidor demorou demais para responder. Tente novamente." e status 0.
2. IF a falha é de rede (não timeout) THEN a mensagem SHALL continuar "Sem conexão com o servidor. Verifique sua internet e tente novamente."

**Independent Test**: `lib/api.test.ts`: o teste de timeout passa a esperar a nova mensagem; o de falha de rede continua igual.

### P2: Formatação única

**User Story**: Como usuário, quero datas e quantidades no mesmo padrão em todas as telas.

**Acceptance Criteria**:

1. The código de `app/` e `components/` SHALL não chamar `toLocale*String(` nem `Intl.` diretamente; datas usam `formatDataHora`/`formatDate`/`formatHora` e quantidades `formatInteiro`, todos em `lib/format.ts`.
2. `lib/regras-ui.test.ts` SHALL falhar se houver `toLocale*String(` ou `Intl.` em `app/` ou `components/`.
3. Os cinco pontos da auditoria SHALL usar essas funções. `breakeven/page.tsx:112` não tem `toLocaleString` (é um `replace` de vírgula): achado já resolvido, sem mudança. Três chamadas fora da lista (`SuggestionQueue.tsx`, `simulation/page.tsx`, a hora em `noticias`) entram na mesma regra.

**Independent Test**: `npm test` com a nova regra; `formatDataHora("2026-11-18T14:05:00Z")` e `formatInteiro(1234567)` com casos em `lib/format.test.ts`.

### P2: Tipos e `any`

**User Story**: Como desenvolvedor, quero tipos da API em um lugar só.

**Acceptance Criteria**:

1. `FixacoesChart.tsx` SHALL não conter `any`. As séries são `Record<string, unknown>` e a conversão para `Data[]` / `Partial<Layout>` fica só em `<Plot>` (decisão: tipar as séries com nulos exigia casts espalhados; ver validation.md).
2. Os tipos duplicados de cotação e Focus (`PriceRow`, `FocusData`, `MarketStatus`) SHALL ser definidos uma vez em `lib/types/`.

**Independent Test**: `grep -rn ": any\|<any>\|as any" frontend/components/market/FixacoesChart.tsx` não retorna nada; `npx tsc --noEmit` passa.

### P3: Bundle do Plotly medido

**User Story**: Como equipe, quero saber quanto o Plotly pesa antes de decidir mantê-lo.

**Acceptance Criteria**:

1. WHEN `npm run build` roda THEN o tamanho dos chunks que contêm `plotly` SHALL ser registrado em `validation.md`.
2. The spec SHALL registrar a proposta de troca do candlestick por Recharts, com os recursos perdidos (zoom e pan nativos, modebar, oscilador em painéis) e a recomendação. Sem execução.

---

## Plano de telas restantes (`useApi`)

Telas que ainda reimplementam loading/erro/retry e devem migrar depois (ordem por tamanho de duplicação): `simulation`, `var`, `arima`, `stress`, `volatilidade`, `cenarios`, `regressao-acucar`, `regressao-dolar`, `atr`, `options`, `market`, `fixacoes`, `noticias`, `focus`, `metas`, `params`, `jump-diffusion`. Migrar uma por commit, com `npm test` e `npm run build` a cada um. Migrar só quando a tela for tocada por outra feature.

## Edge Cases

- Cotação vazia (array vazio sem erro): não é falha; o cartão mostra "—" como hoje.
- `NEXT_PUBLIC_API_URL` com barra no fim: normalizar removendo a barra final.
- Falha do `/api/focus`: o `FocusWidget` mostra "Dados indisponíveis no momento." (texto já existente), sem `ErrorState`; as cotações continuam.
- `state: "UNKNOWN"` e falha de rede juntos: mesma mensagem, sem duplicar log.
- Status de mercado usa timeout de 5 s (não 8 s), para não atrasar o header de todas as páginas.

## Requirement Traceability

| ID | Requisito | Story |
|---|---|---|
| FD-01 | URL absoluta exigida no servidor, falha logada | Servidor falha alto |
| FD-02 | Falha de carga logada e devolvida como `ok: false` | Servidor falha alto |
| FD-03 | Dashboard mostra erro de cotação | Servidor falha alto |
| FD-04 | `/api/focus` uma vez por requisição | Uma carga por requisição |
| FD-05 | Header "Status indisponível" em falha e `UNKNOWN` | Erro visível |
| FD-06 | Hook `useApi` com loading/erro/retry | Hook de carga |
| FD-07 | Breakeven usa `useApi` | Hook de carga |
| FD-08 | Timeout com mensagem própria ("O servidor demorou demais…") | Timeout |
| FD-09 | Sem `toLocaleString` fora de `format.ts`; regra no teste | Formatação |
| FD-10 | Sem `any` em `FixacoesChart.tsx` | Tipos |
| FD-11 | Tipos duplicados centralizados em `lib/types/` | Tipos |
| FD-12 | Tamanho do bundle Plotly medido e proposta registrada | Plotly |
