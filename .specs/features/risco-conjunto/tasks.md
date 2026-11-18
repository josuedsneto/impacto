# Risco conjunto da receita — Tasks

**Design**: inline (feature Medium). Cholesky 2×2 em forma fechada, horizonte direto em T pregões, parte fixada em R$/t. Ver spec AS-01 a AS-09.

## Tasks

- T1 `backend/risco_conjunto.py`: `estimar`, `_choques`, `_receitas`, `_misturar`, `calcular`, `buscar_e_calcular` (RC-01 a RC-12).
- T2 `backend/routers/risco_conjunto.py` + `app.include_router` em `main.py` (RC-01, RC-13, RC-14).
- T3 `backend/tests/test_risco_conjunto.py` (RC-03, RC-05 a RC-09, RC-10 a RC-14).
- T4 `frontend/lib/leitura.ts` (`leituraRiscoConjunto`) e `frontend/app/app/risco-conjunto/page.tsx` (RC-15).
- T5 `NavLinks.tsx` e `regras-linguagem.test.ts` (RC-15, RC-16).
- T6 `validation.md`.

## Gate

`cd backend && pytest tests -q && python test_calcs.py && python test_mensagens.py`; `cd frontend && npm test && npx tsc --noEmit && npm run lint && npm run build`.
