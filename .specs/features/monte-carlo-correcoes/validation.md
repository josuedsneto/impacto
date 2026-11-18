# Validação — monte-carlo-correcoes

## Evidências do backend

Comando: `cd backend && C:/Users/jdlmg/OneDrive/Documentos/Josue/impacto/backend/.venv/Scripts/python.exe -m pytest tests -q`
Resultado: **31 passed** (21 existentes + 10 novos em `tests/test_simulation.py`).

Comando: `python test_calcs.py` → `ok`
Comando: `python test_mensagens.py` → `ok`

| Requisito | Evidência |
|---|---|
| MC-01 P95 sem truncamento | `test_calcs.py`: pct_bound=0.05, vol 60%: P95 > 1,05×preço e `pct_passou_limite` > 0,5 |
| MC-02 `pct_passou_limite` | `test_calcs.py` (acima); `test_pct_bound_maior_que_um_nao_gera_nan` |
| MC-03 docstring | revisão de código (`backend/simulation.py`) |
| MC-04 copy da tela | `frontend/components/simulation/SimulationForm.tsx` e `SimulationMetrics.tsx`; check de frontend pendente |
| MC-05 memória por blocos | `simulation.py`: `dias_por_bloco = max(1, LIMITE_CELULAS // n)` |
| MC-06 equivalência entre blocos | `test_blocos_dao_mesma_serie_que_bloco_unico` (igualdade exata) |
| MC-07 validação | `test_ticker_invalido_na_simulacao_responde_400_sem_consultar_banco`, `test_ticker_invalido_no_params_responde_400_sem_gravar`, `test_preco_inicial_nao_positivo_responde_422` |
| MC-08 dados ruins/insuficientes | `test_close_none_e_nan_sao_descartados`, `test_historico_com_poucos_validos_levanta_dados_insuficientes`, `test_dados_insuficientes_responde_422_em_portugues` |
| MC-09 seed | `test_mesma_seed_mesmo_resultado`; `test_calcs.py` com `seed=1` e `seed=2` |
| MC-10 limite único e preço atual | `frontend/lib/simulacao.ts`; `SimulationForm.tsx` (efeito do último fechamento); check de frontend pendente |

## Checks do frontend: pendentes, coordenadora roda após integração

Nesta worktree o `npm ci` foi interrompido duas vezes e o `node_modules` parcial foi removido, conforme pedido. Não há resultado de `npm test`, `npm run lint` ou `npm run build` válido desta branch.

Observações de rodadas anteriores, feitas antes da instrução de parar:
- `npm test` rodou com 251 testes passando (13 arquivos). Foi antes da última correção em `SimulationForm.tsx` (data local e arredondamento do preço), então precisa ser rodado de novo.
- `npm run lint` acusou 1 erro em `frontend/components/ui/input.tsx` (`no-empty-object-type`). Esse arquivo não foi alterado nesta feature; é dívida anterior.
- `npm run build` falhou ao buscar as fontes do Google em `app/layout.tsx` (sem rede no ambiente). Não tem relação com este diff.

## Ordem de deploy

1. Aplicar `supabase/migrations/20261118000002_monte_carlo_correcoes.sql` **antes** do backend novo. O insert agora envia `pct_passou_limite`; sem a coluna o PostgREST recusa e toda simulação dá 500.

## UAT (passos para o usuário)

1. Abra **Simulação**, escolha `SB=F`. O campo "Preço de partida" deve vir com o último fechamento e a linha "Último fechamento: … em dd/mm/aaaa".
2. Troque para um ativo sem preço recente (ou desligue a rede): deve aparecer "Sem fechamento recente para este ativo." e o campo fica vazio.
3. Rode uma simulação com "Limite de referência" 5% e prazo 252 dias. Os percentis P5–P95 podem sair da faixa; a linha abaixo do resultado deve dizer "X% dos cenários saíram da faixa de ±5% em algum dia do prazo."
4. Baixe o CSV: as colunas "Limite de referência (%)" e "Cenários fora do limite (%)" aparecem.
5. Em **Opções → Monte Carlo**, o campo de cenários aceita até 100.000 (sem mudança).

## Decisões pendentes do usuário

- D1: o teto virou limite de referência (percentis sem corte). Confirmar.
- D2: dois limites de cenários (simulação 50.000; opções 100.000). Confirmar.
