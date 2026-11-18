# Minhas análises — Especificação

## Problem Statement

Monte Carlo, ATR, Breakeven manual, Risco e Cenários já guardam histórico, cada um na sua tabela e com formato próprio. VaR e Opções (payoff) não salvam nada, e Risco do EBITDA só tem o endpoint `/api/risco/save`, que nenhuma tela chama. Quando o analista fecha a tela, o resultado some. Não dá para comparar dois cenários lado a lado nem levar um resumo para a diretoria em papel ou PDF. A única saída é o CSV, que é uma planilha de dados, não um relatório.

## Goals

- [ ] Uma análise salva em qualquer ferramenta tem o mesmo formato: título, ferramenta, parâmetros, resumo do resultado, data de referência.
- [ ] O usuário lista, renomeia, exclui, reabre e compara até 3 análises da mesma ferramenta.
- [ ] Um relatório para impressão/PDF sai pelo navegador, sem biblioteca nova.

## Out of Scope

| Item | Motivo |
|------|--------|
| Migrar `simulations`, `regression_runs`, `breakeven_simulations`, `risco_simulations`, `cenarios_simulations` | Essas telas já funcionam com as próprias tabelas. Migrar muda dados em produção sem ganho para o usuário. Ver ANA-D1. |
| Listar histórico antigo na tela "Minhas análises" | Mistura formatos diferentes numa lista só. Ver ANA-D1. |
| Comparar análises de ferramentas diferentes | Os parâmetros não se alinham; a tabela ficaria sem sentido. Ver ANA-D2. |
| Biblioteca de PDF (jsPDF, react-pdf) | `window.print()` com `@media print` cobre o relatório sem dependência nova. |
| Salvar análises de Monte Carlo, ARIMA, Volatilidade, Stress, Jump Diffusion, Fixações | Pedido só para VaR, Breakeven, Risco e Opções. Mesmo formato serve depois. |
| Compartilhar análise com outros usuários | Não pedido; RLS fica por dono. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
|---|---|---|---|
| ANA-D1: tabela nova `analises`, sem migrar nem ler as tabelas antigas | Tabelas antigas ficam como estão; `/api/analises` lê só `analises` | Solução mais simples: nenhuma migração de dados, nenhuma mudança nas telas que já salvam. Custo: o histórico antigo não aparece em "Minhas análises". | n (advisor revisa) |
| ANA-D2: comparação só entre análises da mesma ferramenta | Checkbox desabilitado para ferramenta diferente, com dica | Tabela de parâmetros e resultados precisa de colunas comparáveis | n |
| Limite de tamanho | `parametros` ≤ 4 KB e `resultado_resumo` ≤ 8 KB (JSON serializado); título 1–120 caracteres | Evita linha gigante; resumo não guarda séries | n |
| Paginação | `limit` 1–100 (padrão 50), `offset` ≥ 0 | Igual ao histórico existente, com teto | n |
| Leitura no relatório | Frase de `lib/leitura.ts` é gravada em `resultado_resumo.leitura` no momento do salvamento (≤ 500 caracteres) | Relatório mostra o texto que o usuário viu; não precisa recalcular com a forma antiga do resultado | n |
| Reabrir | Rota `/app/<ferramenta>?reabrir=<id>`; a página busca `/api/analises/{id}` e preenche o formulário; se a ferramenta não bater, ignora e mostra aviso | Querystring só carrega o id, sem parâmetros na URL | n |
| Dono da linha | Backend usa service role (bypass RLS), então cada query filtra `user_id = user["id"]` explicitamente; RLS fica como segunda camada | Mesmo padrão do restante de `main.py` | n |
| Data de referência | Obrigatória no salvamento (`AAAA-MM-DD`), vinda da ferramenta (último preço usado ou data do cálculo) | Relatório precisa dela (pedido) | n |
| Impressão | Botão "Imprimir / salvar PDF" chama `window.print()` numa área `hidden print:block` da própria tela "Minhas análises" (relatório de uma análise ou da comparação selecionada); `@media print` esconde menu e controles | Sem dependência nova e sem rota extra. Modal imprime mal (advisor), então o relatório não fica em modal. | n |
| Breakeven | O botão "Salvar simulação" da aba Manual vira "Salvar análise" (`BotaoSalvarAnalise`); o histórico antigo de breakeven continua só leitura | Não deixar dois botões de salvar na mesma tela | n |
| Reabrir no VaR | VaR não tem botão de calcular: ao reabrir, preenche a confiança e o resultado volta sozinho pelo efeito existente | Regra de "não recalcular" só vale onde há botão de calcular (Breakeven, Risco, Opções) | n |
| Data de referência | VaR e Breakeven: data do último preço usado (quando a API devolve), senão a data do cálculo. Risco e Opções: data do cálculo | Relatório precisa de uma data; evita mudar a API do VaR só para isso | n |
| Taxa e dono | Rotas novas com `@limiter.limit`; PATCH/DELETE usam `.eq("id").eq("user_id")` e devolvem 404 se nenhuma linha mudou; `id` é tipado `UUID` na rota (id inválido → 422, não 500) | Mesmo padrão de `main.py` | n |
| Tamanho | Medido no backend: `len(json.dumps(x).encode())`; `leitura` cortada em 500 caracteres | Cliente não é fonte de verdade | n |
| Banco | Quatro políticas RLS (SELECT, INSERT, UPDATE, DELETE); `CHECK (ferramenta IN ('var','breakeven','risco','opcoes'))`; índice `(user_id, created_at desc)` | UPDATE é necessário para renomear | n |

**Open questions:** ANA-D1 e ANA-D2 são decisões de design — o advisor revisa antes da implementação.

---

## User Stories

### P1: Salvar uma análise ⭐ MVP

**User Story**: Como analista, quero salvar o resultado de VaR, Breakeven, Risco ou Opções com um título, para voltar a ele depois.

**Acceptance Criteria**:

1. WHERE a ferramenta exibe um resultado (VaR, Breakeven, Risco do EBITDA, Opções/payoff) THE tela SHALL mostrar o botão "Salvar análise" ao lado de "Exportar CSV".
2. WHILE não há resultado na tela o botão "Salvar análise" SHALL ficar desabilitado com a dica "Gere um resultado para salvar."
3. WHEN o usuário salva THEN o sistema SHALL gravar ferramenta, título, parâmetros, resumo do resultado (com a frase de leitura) e data de referência, e confirmar com mensagem em português.
4. IF o título está vazio ou tem mais de 120 caracteres THEN o sistema SHALL recusar com mensagem em português antes de chamar a API.
5. IF o JSON de parâmetros passa de 4 KB ou o resumo passa de 8 KB THEN a API SHALL responder 422 e a tela SHALL mostrar "Os dados desta análise são grandes demais para salvar."

**Independent Test**: teste da API (POST com parâmetros grandes → 422; sem título → 422); salvar uma análise de cada uma das quatro ferramentas e ver a linha em `analises`.

### P1: Listar, renomear e excluir ⭐ MVP

**User Story**: Como analista, quero ver minhas análises salvas e organizá-las.

**Acceptance Criteria**:

1. WHEN o usuário abre "Minhas análises" THEN a tela SHALL listar as análises do usuário, mais recentes primeiro, com ferramenta, título, data de referência e data de salvamento.
2. WHERE há mais de uma ferramenta, o usuário SHALL poder filtrar a lista por ferramenta.
3. WHEN o usuário renomeia THEN o título SHALL ser atualizado (mesmas regras de tamanho do AC-4 de P1 salvar).
4. WHEN o usuário exclui THEN a tela SHALL pedir confirmação e, confirmada, remover a análise.
5. The API SHALL responder 404 para id de outro usuário (não revelar que existe).
6. The lista SHALL paginar com `limit` (≤ 100) e `offset`.

**Independent Test**: testes de API (outro usuário → 404; limit=101 → 422; filtro por ferramenta).

### P2: Reabrir uma análise

**User Story**: Como analista, quero reabrir uma análise salva e ver a ferramenta com os parâmetros de volta.

**Acceptance Criteria**:

1. WHEN o usuário clica em "Reabrir" THEN o navegador SHALL ir para `/app/<ferramenta>?reabrir=<id>`.
2. WHEN a página recebe `reabrir` THEN SHALL preencher o formulário com os parâmetros salvos e não recalcular sozinha (o resultado aparece quando o usuário clicar em calcular).
3. IF a análise não é da ferramenta da página, ou não existe, THEN a página SHALL mostrar aviso em português e manter o formulário padrão.

**Independent Test**: teste unitário de `lib/analises.ts` (`ehReabertura` / parse do id); abrir uma análise de VaR e conferir o formulário.

### P2: Comparar até 3 lado a lado

**User Story**: Como analista, quero ver duas ou três análises da mesma ferramenta lado a lado.

**Acceptance Criteria**:

1. WHEN o usuário marca análises na lista THEN o sistema SHALL aceitar de 2 a 3 seleções da mesma ferramenta; a quarta marcação SHALL ser recusada com "Compare no máximo 3 análises."
2. WHEN o usuário clica em "Comparar" THEN a tela SHALL mostrar uma tabela com uma coluna por análise, uma linha por parâmetro e uma linha por campo do resumo; campo ausente em uma análise aparece como "—".
3. WHEN a comparação é mostrada THEN SHALL usar os mesmos formatadores de `lib/format.ts` do restante do app.

**Independent Test**: teste unitário de `montarComparacao` (união de chaves, campo ausente → "—", limite de 3).

### P2: Relatório para a diretoria

**User Story**: Como analista, quero imprimir ou salvar em PDF o relatório de uma análise ou de uma comparação.

**Acceptance Criteria**:

1. WHEN o usuário clica em "Imprimir / salvar PDF" THEN o navegador SHALL abrir a caixa de impressão com o relatório.
2. The relatório SHALL conter: título, ferramenta, data de referência, data de salvamento, premissas (parâmetros em "Nome: valor"), resultado e a frase de leitura.
3. WHILE imprimindo, o menu lateral, os botões e os filtros SHALL ficar ocultos (`@media print`).
4. The relatório de comparação SHALL seguir a mesma regra, com uma coluna por análise. A frase de leitura de cada análise SHALL aparecer como texto abaixo da tabela, não dentro dela.

**Independent Test**: imprimir pré-visualização (Ctrl+P) de uma análise e de uma comparação; conferir que o menu não aparece.

---

## Edge Cases

- WHEN a análise salva é de uma versão antiga da ferramenta com parâmetros faltando THEN "Reabrir" SHALL preencher o que existe e deixar o restante no padrão.
- IF a API está fora THEN a tela SHALL mostrar a mensagem de rede já existente (`MSG_REDE`), sem apagar a lista exibida.
- WHEN a lista está vazia THEN SHALL mostrar `EmptyState` com a dica de salvar a partir de uma ferramenta.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| ANA-01 | Tabela `analises` com RLS por usuário | - | Pending |
| ANA-02 | API: criar, listar (filtro e paginação), ler, renomear, excluir; limites de tamanho e dono | - | Pending |
| ANA-03 | Botão "Salvar análise" nas quatro ferramentas | - | Pending |
| ANA-04 | Tela "Minhas análises": lista, filtro, renomear, excluir | - | Pending |
| ANA-05 | Reabrir (querystring `reabrir`) | - | Pending |
| ANA-06 | Comparar 2 a 3 da mesma ferramenta | - | Pending |
| ANA-07 | Relatório por `window.print()` + `@media print` | - | Pending |
| ANA-08 | Entrada "Minhas análises" no menu | - | Pending |
| ANA-D1 | Decisão: tabelas antigas não migram | - | Decided (advisor aprovou) |
| ANA-D2 | Decisão: comparação só na mesma ferramenta | - | Decided (advisor aprovou) |

## Success Criteria

- [ ] Salvar, reabrir, comparar e imprimir funcionam nas quatro ferramentas sem recarregar a página inteira.
- [ ] A API recusa dono errado, paginação acima de 100 e JSON acima do limite.
- [ ] `npm test`, `npm run lint`, `npm run build` e `pytest` passam.
