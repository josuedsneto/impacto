# Exportar CSV — Validação

**Date**: 2026-10-05
**Spec**: `.specs/features/exportar-csv/spec.md`
**Diff range**: `3da0db5..HEAD` (branch `refactor/auditoria`)
**Verifier**: revisão independente feita pelo próprio agente (fallback sem sub-agente)

**Result**: PASS — critérios de formato cobertos com evidência, 14 telas com o botão e 9/9 mutantes mortos. Abrir o arquivo no Excel pt-BR fica para o UAT.

---

## Task Completion

T1–T9 concluídas. Correção dentro da feature: `5e531a9` (cabeçalhos de câmbio do mapa de Metas saíam com ponto decimal). Desvio registrado em `tasks.md`: em VaR, Volatilidade e ARIMA o botão fica na barra do resultado da aba, não no `PageHeader`.

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| EXP-01 AC1 | botão "Exportar CSV" nas telas com resultado | `frontend/lib/regras-exportar.test.ts:29` - `expect(exporta(tela)).toBe(true)` (14 telas) | ✅ |
| EXP-01 AC2 | desabilitado com "Gere um resultado para exportar." | `frontend/components/ui/botao-exportar.tsx:17` (código) | ⏳ UAT |
| EXP-01 AC3 | `<ferramenta>_<ativo>_<AAAA-MM-DD>.csv` | `frontend/lib/csv.test.ts:62` - `toBe("monte-carlo_SB-F_2026-10-05.csv")` | ✅ |
| EXP-02 AC4 | BOM, `;`, CRLF | `frontend/lib/csv.test.ts:13` e `:17` | ✅ |
| EXP-02 AC5 | vírgula decimal, sem milhar | `frontend/lib/csv.test.ts:30` - `toContain("\r\n1234567,891235\r\n")` | ✅ |
| EXP-02 AC6 | colunas em português com unidade | nomes de coluna nas 14 telas (ex.: "Volatilidade 30 dias (% a.a.)") | ⏳ UAT |
| EXP-03 AC7 | parâmetros antes da tabela | `frontend/lib/csv.test.ts:34` | ✅ |
| EXP-02 AC8 | `;`/aspas/quebra entre aspas, aspas duplicadas | `frontend/lib/csv.test.ts:39-40` | ✅ |

## Edge Cases

- [x] null/NaN → célula vazia — `frontend/lib/csv.test.ts:45`.
- [x] Texto iniciado por `=`/`@` não vira fórmula (proteção extra contra injeção) — `frontend/lib/csv.test.ts:50-51`.
- [x] Série longa: geração em uma passada (`Array.map` + `join`), sem DOM.

## Discrimination Sensor

| # | Mutação em `lib/csv.ts` | Killed? |
|---|---|---|
| 1 | sem BOM | ✅ |
| 2 | separador vírgula | ✅ |
| 3 | LF em vez de CRLF | ✅ |
| 4 | decimal com ponto | ✅ |
| 5 | sem aspas | ✅ |
| 6 | sem proteção de fórmula | ✅ |
| 7 | NaN vira texto | ✅ |
| 8 | nome de arquivo com acento | ✅ |
| 9 | tela ATR sem botão (regras-exportar) | ✅ |

**Result**: 9/9 killed. Árvore igual ao baseline após o sensor.

## Gate Check

- `npm test`: 252 passed. `tsc`: 0 erros. `npm run build`: ok.

## Requirement Traceability Update

EXP-01, EXP-03, EXP-04 → Verified. EXP-02 → Implementing (UAT: abrir no Excel).

## Summary

**Overall**: ✅ Pronto para UAT.

**UAT**:
1. Monte Carlo: simular e clicar em Exportar CSV; abrir no Excel pt-BR: colunas separadas, acentos certos e números somáveis (=SOMA funciona).
2. Antes de simular, o botão aparece desabilitado e, ao passar o mouse, diz "Gere um resultado para exportar.".
3. Breakeven do açúcar: abrir a aba Histórico e exportar.
