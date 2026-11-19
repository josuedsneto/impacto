# Spec: main-routers (divisão do backend/main.py por domínio)

## Problem Statement

`backend/main.py` tem quase 2.000 linhas: dezenas de rotas, modelos Pydantic inline, helpers e regra de negócio dentro dos endpoints. Isso dificulta revisar, testar e mexer em uma frente sem tocar nas outras. As frentes novas já vivem em `backend/routers/`; esta tarefa termina a divisão para as rotas que ainda estão no `main.py`.

## Goals

- Todas as rotas que hoje estão no `main.py` passam a um router por domínio em `backend/routers/<dominio>.py`.
- `main.py` fica só com a criação do app, os middlewares, o CORS e os `include_router` (alvo: menos de 200 linhas).
- **Nenhum comportamento muda**: caminhos, métodos, corpos de requisição e resposta, códigos de status, mensagens e limites de rate continuam iguais.
- Regra de negócio pura sai do endpoint para módulo próprio, sem reescrever fórmulas.

## Out of Scope

- Mudanças de API, de cálculo, de banco ou de frontend.
- Os routers já existentes (`alertas`, `analises`, `cambio`, `hedge_cambial`, `jobs`, `posicoes`, `risco_conjunto`): não são tocados. `routers/alertas.py`, `routers/jobs.py` e `alertas.py` pertencem à thread alertas-v2.
- Trocar `supa_client` por cliente por requisição (a convenção continua: um cliente via `market_cache.supa_client`).
- Reescrever a validação de mensagens em português (só ajustar onde o arquivo lido mudou).

## Assumptions

- A3.1 Nenhum endpoint muda de nome de função de forma que quebre o contrato: o contrato usa método, path, nomes dos parâmetros, `status_code` e limite de rate, não o nome da função.
- A3.2 O slowapi indexa limites por `módulo.função`; a foto do contrato guarda a string do limite (ex.: `30 per 1 minute`), que não depende do módulo.
- A3.3 Os testes podem ser atualizados (regra do usuário), mas nenhum teste é apagado. Patches em `main.<nome>` migram para o módulo onde o nome é usado.
- A3.4 `from __future__ import annotations` não entra em router (quebra `Depends`).

## Decisões de desenho

| Arquivo | Conteúdo |
|---|---|
| `backend/validacao.py` | `validate_ticker`, `ALLOWED_TICKER_RE`, `_faixa`, `_num`, `_validar_periodo`, `_validar_paginacao`, `_lista_periodos`, `MAX_DIAS_PERIODO` |
| `backend/constantes.py` | `CONSTANTES_NEGOCIO`, `_valor_numerico`, `_ler_constantes` |
| `backend/noticias.py` | `buscar_manchetes()`: leitura do RSS de notícias, usada pela rota e pelo briefing de alertas |
| `backend/pregao.py` | `PREGAO_TZ`, `PREGAO_ABERTURA`, `PREGAO_FECHAMENTO`, `estado_pregao` (regra pura) |
| `routers/conta.py` | `/api/health`, `/api/me` |
| `routers/mercado.py` | `/api/focus`, `/api/market/*`, `/api/var`, `/api/arima/{ticker}`, `/api/stress`, `/api/news`, `/api/volatility`; `fechamentos` e `INICIO_ESTRESSE` (usados só aqui) |
| `routers/regressao.py` | `/api/regression/dolar/*`, `/api/regression/acucar/*`, `/api/regression/runs` |
| `routers/simulacoes.py` | `/api/simulations*`, `/api/params/{ticker}`, `/api/jump-diffusion` (simulação de preço) |
| `routers/opcoes.py` | `/api/options/payoff`, `bs-price`, `mc-price` |
| `routers/atr_usinas.py` | `/api/atr/*` (usinas do usuário, simular, histórico, compartilhar) |
| `routers/admin.py` | `/api/admin/suggestions*`, `/api/admin/market/backfill/{ticker}`, `/api/admin/config*`, `/api/admin/usinas*`, `/api/admin/usuarios` |
| `routers/risco.py` | `/api/breakeven*`, `/api/risco*`, `/api/cenarios*`, `/api/metas` |

- **Modelos Pydantic:** ficam no router que os usa. Nenhum modelo é usado por dois domínios, então **`modelos.py` não é criado** (o critério "compartilhado" não se aplica). Revisar se o advisor discordar.
- **Nome `atr_usinas.py`:** evita colisão de leitura com o módulo de cálculo `backend/atr.py`.
- **Rotas admin de Usinas e Usuários** vão para `admin.py` (são CRUD de admin), não para `atr_usinas.py`.
- **Backfill** (`POST /api/admin/market/backfill/{ticker}`) vai para `admin.py`, porque é ação de admin.

## Requisitos

- **MR-01:** A foto do contrato (método, path, nomes dos parâmetros, `status_code`, string do limite de rate) gerada de `main.app.routes` antes da divisão está em `tests/test_contrato_rotas.py`, e o teste passa sem alteração ao final.
- **MR-02:** Cada domínio listado acima tem `routers/<dominio>.py` com `router = APIRouter()`; o `main.py` só inclui os routers.
- **MR-03:** `main.py` tem menos de 200 linhas e não contém rota, modelo nem helper de negócio.
- **MR-04:** Helpers e regra pura ficam em módulos próprios (tabela acima).
- **MR-05:** Os testes que patcheavam `main.<nome>` apontam para o módulo onde o nome é usado; nenhum teste é apagado.
- **MR-06:** Um domínio por commit; `pytest tests -q`, `test_calcs.py` e `test_mensagens.py` passam em cada commit.
- **MR-07:** Os textos de erro e as respostas de sucesso não mudam (verificado pelo teste de contrato e pela suíte).

## User Stories

**US-1 Contrato preservado.** WHEN a divisão termina THEN a foto do contrato bate exatamente com as rotas de antes (MR-01).

**US-2 Dono claro.** WHEN um dev procura a rota de Risco ou de ATR THEN ela está em `routers/risco.py` ou `routers/atr_usinas.py`, e o `main.py` só mostra os includes.

**US-3 Teste que aponta certo.** WHEN um teste faz patch de `supa_client` numa rota de ATR THEN o patch é `routers.atr_usinas.supa_client`, e o teste continua falhando se a rota quebrar.

**US-4 Commits revisáveis.** WHEN olho o histórico THEN cada commit move um domínio e a suíte passou nele.

## Verificação

- `cd backend && <venv>/python.exe -m pytest tests -q`
- `cd backend && <venv>/python.exe test_calcs.py && <venv>/python.exe test_mensagens.py`
- Frontend: não há mudança; nenhum teste de frontend é necessário.

## Decisões após a revisão do advisor Opus

- `jump-diffusion` foi para `simulacoes.py` (é simulação de preço, não risco).
- `fechamentos_cache.py` foi removido: `fechamentos` só é usado pelas rotas de mercado.
- Notícias: a busca do RSS saiu da rota para `noticias.py` (`buscar_manchetes`), uma função única para a tela e para o briefing de alertas.
- Contrato (MR-01) ganhou as dependências de cada rota (`get_current_user` ou `require_admin`), para que trocar a permissão quebre o teste.
- `test_mensagens.py` e `test_regression_cache.py` leem uma lista explícita de arquivos, sem glob em `routers/` (pasta compartilhada com a alertas-v2).
- `main.py` reexporta `get_current_user` e `require_admin` (os testes e `dependency_overrides` usam esses objetos).
- `alertas` e `jobs` ficaram fora da foto do contrato e não foram tocados.
