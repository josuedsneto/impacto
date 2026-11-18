# Minhas análises — Validação

**Branch:** `bb/nova-frente-minhas-an-lises-pdf-thr_s8q7wzugz9` (base `refactor/auditoria`, tip `83723aa`)
**Commits:** `48965ae` (backend + migration + spec), `1c8a1d2` (frontend), `3335704` (correções da revisão do advisor). Não houve push, merge nem rebase.

## Requisitos e evidências

| Req | Descrição | Evidência | Status |
|---|---|---|---|
| ANA-01 | Tabela `analises` com RLS (4 políticas), CHECK de ferramenta e título, índice | `supabase/migrations/20261118000004_analises.sql` (revisão de código). Não aplicada em banco real aqui. | Implementado; falta aplicar e testar no Supabase (UAT) |
| ANA-02 | API: criar, listar (filtro, paginação ≤100), ler, renomear, excluir; limites 4 KB / 8 KB; dono | `pytest tests/test_analises.py` (13 testes) | Verificado (testes) |
| ANA-03 | Botão "Salvar análise" em VaR, Breakeven, Risco, Opções | `lib/regras-analises.test.ts` + `npm run build` | Verificado (varredura + build); uso real na UAT |
| ANA-04 | Tela Minhas análises: lista, filtro, renomear, excluir | build; UAT | Implementado; UAT |
| ANA-05 | Reabrir por `?reabrir=<id>` nas quatro ferramentas | `lib/analises.test.ts` (idReabertura); revisão do advisor corrigiu VaR | Implementado; UAT |
| ANA-06 | Comparar 2 a 3 da mesma ferramenta | `lib/analises.test.ts` (motivoNaoMarcar, podeComparar, montarComparacao) | Verificado (unitário); UAT |
| ANA-07 | Relatório por `window.print()` + `@media print` | build; UAT (Ctrl+P) | Implementado; UAT |
| ANA-08 | Entrada "Minhas análises" no menu | `lib/regras-analises.test.ts` | Verificado |

## Comandos e resultados

```
cd backend && .venv/Scripts/python.exe -m pytest tests -q
  34 passed (inclui 13 de test_analises.py)
cd backend && python test_calcs.py      -> exit 0
cd backend && python test_mensagens.py  -> exit 0
cd backend && python -c "import main"   -> ok (router incluído sem import circular)

cd frontend && npm test
  Test Files 15 passed (15) · Tests 275 passed (275)
cd frontend && npx tsc --noEmit         -> exit 0
cd frontend && npm run build            -> exit 0 (rotas /app/analises e demais geradas)
cd frontend && npm run lint             -> 1 erro, PRÉ-EXISTENTE: components/ui/input.tsx:4
                                           (interface vazia já existe em refactor/auditoria;
                                            fora do escopo desta feature, não foi alterado)
```

## Revisão do advisor Opus

- Spec (antes da implementação): aprovada com correções (Problem Statement, botão "Salvar simulação" do breakeven, RLS com UPDATE, dono com 404, limites medidos no backend). Todas aplicadas.
- Diff final: 3 defeitos reais, todos corrigidos em `3335704`:
  1. VaR: reabrir um ativo que não era a aba ativa mostrava erro. Agora a `VarPage` escolhe a aba.
  2. Risco: o salvamento usava as faixas editadas depois do cálculo. Agora grava um snapshot das premissas do cálculo.
  3. Datas: `created_at` era cortado em UTC (salva após 21h aparecia no dia seguinte). Agora usa dia local (`dataLocalDe`).
  Também: título com 120 caracteres e espaços nas pontas passa a ser aceito (tamanho medido depois do strip).

## Decisões registradas na spec

- ANA-D1: tabelas antigas (`simulations`, `regression_runs`, `breakeven_simulations`, `risco_simulations`, `cenarios_simulations`) não são migradas nem listadas em "Minhas análises".
- ANA-D2: comparação só entre análises da mesma ferramenta.
- Breakeven: o "Salvar simulação" antigo virou "Salvar análise"; o histórico antigo continua só leitura.
- Limiter: o router cria o próprio `Limiter` (importar do `main.py` causaria import circular).

## UAT (passos para o usuário)

Pré-requisito: aplicar `supabase/migrations/20261118000004_analises.sql` no Supabase antes de testar.

1. **Salvar:** em *Perda máxima (VaR)*, escolha 95%, clique em "Salvar análise", deixe o título sugerido e clique em "Salvar". Deve aparecer "Análise salva. Veja em Minhas análises."
2. Repita em *Breakeven do açúcar* (aba Manual), *Risco do EBITDA* (depois de "Simular") e *Opções* (depois de "Calcular" na Estratégia).
3. **Minhas análises** (menu Análise): as quatro aparecem, mais recentes primeiro. Teste o filtro por ferramenta.
4. **Renomear:** clique em "Renomear", troque o título e salve. Tente um título só com espaços: deve aparecer aviso e não salvar.
5. **Excluir:** clique em "Excluir", confirme. A linha some. Cancele uma vez e confira que nada foi apagado.
6. **Reabrir:** clique em "Reabrir" numa análise de VaR do dólar. Deve abrir na aba dólar com a confiança salva. Faça o mesmo com Breakeven (aba Manual preenchida), Risco (faixas preenchidas, sem calcular sozinho) e Opções (pernas preenchidas).
7. **Comparar:** marque 2 análises da mesma ferramenta, clique em "Comparar". Tabela com uma coluna por análise. Tente marcar uma de outra ferramenta: deve ser recusado. Tente marcar uma quarta: deve ser recusado.
8. **Imprimir:** marque uma análise (ou a comparação) e clique em "Imprimir / salvar PDF". Na pré-visualização só o relatório deve aparecer (sem menu nem botões). Confira data de referência, premissas, resultado e a frase de leitura.
9. **Dono:** com outro usuário de teste, confirme que a análise do primeiro não aparece e que o id dela retorna "não encontrada".
10. **Mobile (360px):** a tabela de análises rola na horizontal, sem quebrar a página.

## O que ficou de fora

- Migração ou listagem das tabelas antigas (ANA-D1).
- Biblioteca de PDF (desnecessária com `window.print()`).
- Salvar Monte Carlo, ARIMA, Volatilidade, Stress, Jump Diffusion e Fixações (não pedido).
- Lint geral com erro pré-existente em `components/ui/input.tsx`: corrigir em outra frente.
- `SBV24.csv` aparece modificado na worktree desde antes do início; não foi tocado nem commitado.
