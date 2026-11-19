# Painel "Hoje" — spec

## Problem Statement

Quem abre o app de manhã quer saber **"o que mudou desde ontem e o que eu preciso olhar?"**. O dashboard mostra cotações, Focus, notícias e a última simulação, mas não diz se um alerta disparou, se a usina saiu da política de hedge, nem o que mudou no dia ou na semana.

## Goals

- **G1.** Tela inicial "Hoje", com os cartões em ordem de urgência, cada um levando à ferramenta correspondente.
- **G2.** Um endpoint (`GET /api/painel/hoje`) só com o que é do usuário ou caro de calcular. Cotações, Focus e pregão não entram: já vêm do layout com cache (D-1).
- **G3.** Falha de uma seção não derruba o painel: vira `dados: null` com `motivo`.
- **G4.** Textos em linguagem de negócio, no padrão de `frontend/lib/leitura.ts`.

## Out of Scope

- Notícias (continuam no `NewsFeed`, busca no cliente).
- Feriados brasileiros no "último dia útil" (A-3).
- Cadastro de usina: `user_usinas` é do admin.
- Migrations: nenhuma. Sem cache novo no backend (D-2).
- Alterar `routers/alertas.py`, `alertas.py`, `routers/posicoes.py`, `routers/risco_conjunto.py`, `routers/hedge_cambial.py`. Só importamos deles.

## Assumptions

- **A-1.** Safra pela data de Brasília: a partir de abril, `AAAA/AA+1`. Em 19/11/2026 é `2026/27`.
- **A-2.** Usina do usuário = `user_usinas`. Se houver mais de uma, o painel lista todas.
- **A-3.** "Último dia útil" = último dia de segunda a sexta antes de hoje. Alertas são filtrados por `created_at >= 00:00 de Brasília desse dia` (03:00 UTC), até agora. Na segunda, isso inclui sexta e o fim de semana. Feriados ficam de fora.
- **A-4.** Dado de usuário: sem cache (`revalidate 0`, como `getSimulacoes`).
- **A-5.** Dólar em 1 mês = 21 dias úteis. Seed = data do último fechamento, janela = últimos 756 fechamentos, 10.000 caminhos (mesmo modelo de `/api/cambio/previsao`). P5, P50 e P95 são o último índice das bandas.
- **A-6.** `SB=F` é contrato contínuo: na troca de vencimento, a variação semanal pode ter salto falso. Fica registrado, não corrigido.

## Requirements

### Backend (`backend/routers/painel.py`)

| ID | Requisito |
|----|-----------|
| PNL-01 | `GET /api/painel/hoje` exige `Depends(get_current_user)` e tem `@limiter.limit("30/minute")`. |
| PNL-02 | Cada seção roda dentro de `_secao`: sucesso → `{"dados", "motivo": null}`; erro → `{"dados": null, "motivo"}`. O `motivo` é o `detail` de `HTTPException` ou o texto fixo `MSG_GENERICA`. A exceção vai para `logger.exception`, nunca para a resposta. |
| PNL-03 | Seções em paralelo (`ThreadPoolExecutor`). Seções: `faixa_dolar`, `alertas`, `posicoes`, `analises`. |
| PNL-04 | `faixa_dolar`: spot, P5, P50, P95 em 21 dias úteis, data do dado (reusa `serie_fx`, `cambio.simular`, `cambio.bandas`). |
| PNL-05 | `alertas`: `dia_referencia`, `disparados` (`id, rule_id, mensagem, created_at`, de `alert_events` do usuário, desde o início do último dia útil) e `ativos` (inteiro: regras com `ativo = true` do usuário). |
| PNL-06 | `posicoes`: lista, uma por usina do usuário, com `usina_id`, `usina_nome`, `safra`, `status` (`dentro`/`abaixo`/`acima`/`sem_politica`/`sem_producao`), `pct_fixado`, `minimo_pct`, `maximo_pct`, `mtm_total_rs`, `aviso`, `motivo`. |
| PNL-07 | Preço (`SB=F`, `USDBRL=X`) é buscado **uma vez** para todas as usinas, e só se houver posição na safra. Se falhar: cada usina mantém `status` e `pct_fixado` (via `situacao`), com `mtm_total_rs = null` e `aviso` com o motivo. `motivo` por usina fica só para erro da própria usina. |
| PNL-08 | `analises`: as três mais recentes do usuário (colunas de `routers/analises.COLUNAS`). |
| PNL-09 | Segurança: toda consulta filtra pelo `user["id"]` do JWT. `user_usinas` filtra por `user_id`; `posicoes` e `politica_hedge` só pelos `usina_id` desse vínculo. O endpoint não recebe parâmetros de usina. |
| PNL-10 | `main.py` recebe só o import de `painel` e a inclusão na tupla. |
| PNL-11 | `tests/test_contrato_rotas.py` ganha a linha da rota. |

### Frontend

| ID | Requisito |
|----|-----------|
| PNL-12 | `/app/dashboard` vira "Hoje". No menu, só a linha da entrada Dashboard muda: label "Hoje", no topo. |
| PNL-13 | Ordem de urgência: `alertas`, `posicoes`, `mercado`, `faixa_dolar`, `focus`, `analises`, `noticias`. |
| PNL-14 | Cada cartão leva à ferramenta: alertas → `/app/alertas`; posições → `/app/posicoes`; mercado → `/app/mercado`; faixa do dólar → `/app/cambio`; Focus → `/app/focus`; análises → `/app/analises`; notícias → `/app/noticias`. |
| PNL-15 | Mercado: `PriceCard` com `getPrecos` (como hoje). A variação no dia e na semana sai de função pura em `lib/painel.ts` sobre as `rows`: semana = fechamento com data ≤ última data − 7 dias corridos. Mostrada no cartão. |
| PNL-16 | Focus: `FocusWidget` com `getFocus` (como hoje). |
| PNL-17 | Textos de posição em `lib/leitura.ts` (`leituraPosicaoPolitica`), com os cinco status (abaixo, acima, dentro, sem política, sem produção). Pontos em pt-BR, 1 casa decimal. |
| PNL-18 | Estados vazios: sem alertas → "Nenhum alerta disparou no último dia útil." e, se `ativos = 0`, o atalho "Criar alerta". |
| PNL-19 | Posições: sem usina (`dados = []`) → "Sua conta não está associada a nenhuma usina. Fale com o administrador." (sem atalho). Usina sem posições na safra → atalho "Cadastrar posições". |
| PNL-20 | `getPainelHoje(token)` em `lib/dados-servidor.ts`, com `timeoutMs = 15000` e sem cache. Seção com `dados: null` mostra o `motivo` no cartão. Falha do endpoint inteiro mostra `ErrorState` nos cartões de dados do usuário, não derruba a tela. |

## Acceptance criteria (WHEN/THEN)

- **AC-1 (PNL-02).** WHEN `faixa_dolar` levanta erro, THEN `faixa_dolar.dados = null` com o motivo, e as outras seções seguem com `motivo = null`.
- **AC-2 (PNL-07).** WHEN o preço está indisponível, THEN todas as usinas com posição trazem `status` e `pct_fixado`, `mtm_total_rs = null` e `aviso`.
- **AC-3 (PNL-13).** WHEN os cartões são ordenados por `ordenar`, THEN a ordem é `alertas, posicoes, mercado, faixa_dolar, focus, analises, noticias`.
- **AC-4 (PNL-17).** WHEN `status = abaixo`, `pct_fixado = 38` e `minimo_pct = 50`, THEN "Você está 12 pontos abaixo da política de hedge da safra 2026/27." Com `pct_fixado = 38,5` e mínimo 50, o texto diz "11,5 pontos".
- **AC-5 (PNL-18).** WHEN `ativos = 0`, THEN o cartão de alertas mostra "Criar alerta".
- **AC-6 (PNL-19).** WHEN `dados = []`, THEN o texto é o de "sem usina", sem atalho; WHEN há usina sem posições, THEN aparece "Cadastrar posições".
- **AC-7 (PNL-15).** WHEN as `rows` têm a última data D, THEN a variação semanal usa o fechamento com data ≤ D − 7 dias, e não o de ontem.

## Decisões

- **D-1 (revisada pelo advisor).** Focus, cotações e pregão saem do endpoint. `layout.tsx` já carrega `getPrecos`, `getFocus` e `getStatusMercado` com cache; repetir isso aqui custaria 4 chamadas ao BCB e buscas no Yahoo a cada abertura.
- **D-2.** Sem cache novo. Se a faixa do dólar ficar lenta, o cache vai para `routers/cambio`, e não para o painel.
- **D-3.** Usuário sem `user_usinas` recebe `dados = []`, não erro.
- **D-4.** Preço fora não zera o % fixado: `situacao` não depende de preço, e o aviso explica a falta do MTM.
