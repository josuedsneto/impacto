# Validação: main-routers

Refatoração sem mudança de comportamento. O contrato HTTP é a prova principal.

## Requisitos

| ID | Requisito | Evidência |
|----|-----------|-----------|
| MR-01 | Contrato (método, path, parâmetros, dependências, status, limite de rate) igual ao de antes | `tests/test_contrato_rotas.py` passa sem alteração de valores esperados (67 rotas de `main.app`, exceto alertas/jobs). Commits `f731fc6` (foto) e `8983d9c` (dependências, antes de qualquer rota sair). |
| MR-02 | Um router por domínio, com `APIRouter` | `routers/{conta,opcoes,regressao,simulacoes,atr_usinas,admin,mercado,risco}.py`; `main.py` inclui por laço. |
| MR-03 | `main.py` com menos de 200 linhas, sem rota nem helper | `wc -l main.py` = 53. |
| MR-04 | Helpers e regra pura em módulos próprios | `validacao.py`, `constantes.py`, `pregao.py` (regra pura), `noticias.py`. |
| MR-05 | Patches migrados, nenhum teste apagado | Patches de `main.<nome>` trocados por módulo dono (`routers.*`, `constantes`, `pregao`, `requests`). Lista de testes inalterada em número: 256 antes + 1 novo de contrato. |
| MR-06 | Um domínio por commit, suíte verde em cada | Commits `1e58062` … `7e4efbb`; a suíte foi rodada em cada um. |
| MR-07 | Textos e respostas iguais | Testes de mensagens (`test_mensagens.py`, lista explícita) e a suíte de API. |

## Comandos e resultados (estado final, commit `7e4efbb`)

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q
257 passed in 33.41s

cd backend && .venv/Scripts/python.exe -m pytest tests/test_contrato_rotas.py -q
1 passed

cd backend && .venv/Scripts/python.exe test_calcs.py     # exit 0
cd backend && .venv/Scripts/python.exe test_mensagens.py # ok
```

Verificação extra: scan de nomes indefinidos em 13 módulos alterados, sem achados.

## Desvios da spec (e por quê)

- `fechamentos_cache.py` foi criado e depois removido: `fechamentos` só é usado por mercado (advisor).
- `noticias.py` foi criado (pedido da coordenadora): a busca do RSS vira `buscar_manchetes()`, para a tela e para o briefing de alertas.
- `jump-diffusion` foi para `simulacoes.py` (advisor).
- `modelos.py` não foi criado: nenhum modelo é usado por dois domínios.
- `main.py` reexporta `get_current_user` e `require_admin`.

## Fora desta entrega

- Frontend: nenhuma mudança de API, nada a validar.
- Merge com `bb/rodada-2-pend-ncias-pequenas-thr_sq4zvmmk66` e `bb/rodada-2-alertas-v2-...`: pedido pela coordenadora para depois da divisão. Pontos de conflito já conhecidos: `estado_pregao` (movido para `pregao.py` nos dois lados), `MCPriceRequest.num_simulacoes` (ge=100, agora em `routers/opcoes.py`), e o teste `test_heatmap_centrado_no_ultimo_fechamento` (patch em `routers.risco.get_prices`). Para a alertas-v2: o briefing deve usar `noticias.buscar_manchetes`, e o "dia útil anterior" pode usar os feriados de `pregao.py` se a branch de pendências tiver a lista.

## UAT (usuário)

1. Subir a API local (`uvicorn main:app --reload` em `backend/`) e abrir `/api/health`: deve responder `{"status": "ok"}`.
2. Entrar no app e abrir Mercado, Risco (breakeven), Simulações e Admin: as telas devem carregar como antes.
3. Confirmar que nada mudou de caminho: a lista de rotas está no teste `tests/test_contrato_rotas.py`.
