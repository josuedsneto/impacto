# Tarefas: posicoes-fixacoes v2 (rodada 3)

Spec: `spec.md`, seção "v2". Cada tarefa é um commit atômico.

| # | Tarefa | Requisitos | Status |
|---|---|---|---|
| V2-T1 | Migration `20261120000004_posicoes_tipo_opcao.sql`: coluna `tipo_opcao` nullable, CHECK call/put só em opção | POS-V2-10 | feito |
| V2-T2 | `backend/exposicao.py`: `FATOR`, `exposicao_aberta` (pura) | POS-V2-06, POS-V2-07 | feito |
| V2-T3 | `backend/mtm_opcoes.py`: `vol_historica`, `opcao_acucar` (Black-76), `opcao_dolar` (GK, convenção do hedge), fallback intrínseco | POS-V2-01 a 05 | feito |
| V2-T4 | `routers/posicoes.py`: `tipo_opcao` no modelo e na tabela; MTM por modelo no resumo; `GET /api/posicoes/exposicao` | POS-V2-01 a 06, 10 | feito |
| V2-T5 | Testes: `test_mtm_opcoes.py`, `test_exposicao.py`; contrato de rotas com a rota nova | POS-V2-01 a 07 | feito |
| V2-T6 | `lib/posicoes.ts`: tipo, detalhes do modelo, CSV de importação e exportação, `valoresParaRisco`, `valorParaHedge` | POS-V2-08, 09, 10 | feito |
| V2-T7 | Tela de posições: campo tipo da opção, detalhes do modelo na tabela | POS-V2-05, 10 | feito |
| V2-T8 | Componente `components/posicoes/SeletorCarteira.tsx`; botões nas telas de risco conjunto e hedge cambial | POS-V2-08, 09 | feito |
| V2-T9 | Testes do frontend e checagens (tsc, lint, build) | todos | em andamento |
| V2-T10 | `validation.md` com evidências e UAT | todos | pendente |

Fora desta lista: `routers/alertas.py`, `alertas.py`, `frontend/app/app/dashboard` (não tocados).
