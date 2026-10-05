# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Teste de allowlist de redirecionamento deve incluir destino protocol-relative (//host) e caminho interno fora do prefixo, não só URL absoluta e null.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `frontend/auth` · harmful: 0
- features: cliente-api
- evidence: frontend/lib/api.ts:destinoSeguro (frontend/auth)
- last seen: 2026-10-05T14:28:03Z

### L-002 - Encadear gate e commit com && sobre saída filtrada por grep não para em erro de lint; usar o código de saída do eslint ou checar contagem de erros > 0 antes de commitar.
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `tooling` · harmful: 0
- features: fundacao-ui
- evidence: commit d5f072d (tooling)
- last seen: 2026-10-05T17:51:37Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
