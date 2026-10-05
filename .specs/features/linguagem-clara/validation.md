# Linguagem clara — Validação

**Date**: 2026-10-05
**Spec**: `.specs/features/linguagem-clara/spec.md`
**Diff range**: `80cd76a..HEAD` (branch `refactor/auditoria`)
**Verifier**: revisão independente feita pelo próprio agente (fallback sem sub-agente; execução direta escolhida pelo usuário)

**Result**: PASS — todos os critérios verificáveis por código cobertos com evidência; 11/11 mutantes mortos após um reforço de teste. Aparência das frases e campos aguarda UAT.

---

## Task Completion

T1–T25 concluídas. Commits de correção dentro da feature:
- `aa0b3c1` regra de `type="number"` tinha um caractere de controle no regex e não casava.
- `b126338` erro de tipos que passou pelo gate (`pipefail`); gate corrigido.
- `cbf3669` (backend) breakeven de Cenários falhava para Moagem porque a tela envia 0 na variável analisada.
- T22 restaurou a lista `FERRAMENTAS`, que o `sed` de remoção de pendentes vinha esvaziando; as 16 telas passam.
- `TickerSelect` com nomes foi adiantado de T23 para T7.

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| LING-01 AC1–AC2 | rótulos sem variável de código / símbolo como texto principal | `frontend/lib/regras-linguagem.test.ts:63` - `expect(violacoes(arquivo)).toEqual([])` (regra "rótulo técnico") | ✅ |
| LING-02 AC3 | % digitado vira fração na API | `frontend/components/options/CamposOpcao.test.ts:6` - `toEqual({ ..., r: 0.105, sigma: 0.25 })` | ✅ |
| LING-02 AC4 | "10,5" → 10.5 | `frontend/lib/numero.test.ts:6` - `expect(lerNumero("10,5")).toBe(10.5)` | ✅ |
| LING-02 AC6 | "Use um valor entre <mín> e <máx> <unidade>." | `frontend/lib/numero.test.ts:32` - `toBe("Use um valor entre 1 e 100 %.")` | ✅ |
| LING-02 (forma) | nenhum `<input type="number">` | `frontend/lib/regras-linguagem.test.ts:63` (regra `input type="number"`) | ✅ |
| LING-03 AC1 | toda ferramenta mostra a frase | `frontend/lib/regras-linguagem.test.ts:63` (regra "sem frase de leitura", 16 telas) + `:67` | ✅ |
| LING-03 AC2 | frase do VaR | `frontend/lib/leitura.test.ts:16` - `toBe("Com 95% de confiança, a queda em 1 dia não deve passar de 0,45 ¢/lb (2,31%).")` | ✅ |
| LING-03 AC3 | frase do Monte Carlo | `frontend/lib/leitura.test.ts:25` - `toBe("Em 252 dias úteis, o preço deve ficar entre ...")` | ✅ |
| LING-03 AC4 | frase de Cenários | `frontend/lib/leitura-negocio.test.ts:15` - `toBe("O EBITDA zera com o açúcar NY em 14,87 ¢/lb. ...")` | ✅ |
| LING-04 AC5 | frases das demais ferramentas definidas no design | `frontend/lib/leitura.test.ts:31-76` e `frontend/lib/leitura-negocio.test.ts:24-67` | ✅ |
| LING-05 AC1–AC2 | nome do ativo; código se desconhecido | `frontend/lib/ativos.test.ts:6` - `toBe("Açúcar NY nº 11")`; `:12` - `toBe("PETR4.SA")` | ✅ |
| LING-06 AC1–AC2 | menu com nomes novos = título da página | `frontend/lib/regras-linguagem.test.ts:82` - `expect(pagina).toContain(\`titulo="${nome}"\`)` (19 links) | ✅ |
| LING-07 AC1 | glossário alfabético, até 3 frases | `frontend/lib/glossario.test.ts:7` e `:12` | ✅ |
| LING-07 AC2 | "Ver no glossário" no tooltip com termo | `frontend/components/ui/field-tooltip.tsx:30` (código) | ⏳ UAT |

## Edge Cases

- [x] Valor ausente → "Sem dados suficientes para este cálculo." — `frontend/lib/leitura.test.ts:80-84`.
- [x] Probabilidade < 1% → "menos de 1%" — `frontend/lib/leitura-negocio.test.ts:24`.

## Discrimination Sensor

Cópias em `frontend/.sensor/` e arquivos temporários; tudo apagado e `git status` igual ao baseline.

| # | Alvo | Mutação | Killed? |
|---|---|---|---|
| 1 | `numero.ts` | ponto de milhar não removido | ✅ |
| 2 | `numero.ts` | faixa ignora o máximo | ✅ |
| 3 | `numero.ts` | % sem arredondamento | ❌ sobreviveu → teste reforçado (0,07 e 0,29) → ✅ |
| 4 | `leitura.ts` | limiar de "em linha" | ✅ |
| 5 | `leitura.ts` | "menos de 1%" | ✅ |
| 6 | `leitura.ts` | sem aviso de prejuízo | ✅ |
| 7 | `leitura.ts` | empate do payoff sem interpolação | ✅ |
| 8 | `CamposOpcao.tsx` | juros sem converter % | ✅ |
| 9 | `glossario.ts` | fora de ordem | ✅ |
| 10 | tela nova | `<Input type="number">` | ✅ |
| 11 | `var/page.tsx` | sem `<Leitura>` | ✅ |

**Result**: 11/11 killed (após o reforço).

## Gate Check

- `npm test`: 228+ passed (antes da feature: 103). `tsc`: 0 erros. `npm run build`: ok.
- Backend: `test_calcs.py` e `test_mensagens.py` ok (agora também cobre o campo `message`).

## Requirement Traceability Update

LING-01..LING-06 → Verified. LING-07 → Implementing (UAT do link no tooltip).

## Summary

**Overall**: ✅ Pronto para UAT.

**UAT**:
1. Monte Carlo: digitar "19,5" no preço e "50" na variação; simular e ler a frase acima do resultado.
2. Opções › Black-Scholes: digitar juros "10,5"; o preço recalcula; passar o mouse no "i" do strike e clicar "Ver no glossário".
3. Breakeven da safra › Moagem: calcular e conferir a frase (antes desta feature, Moagem respondia "Sem breakeven").
4. Ler o menu e conferir se cada nome diz o que a ferramenta responde.
