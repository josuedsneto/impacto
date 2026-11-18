"""Endpoints de job chamados pelo cron da Vercel (frontend/app/api/cron). Protegidos por X-Job-Secret."""
import hmac
import os

from fastapi import APIRouter, Depends, Header, HTTPException

import alertas

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def require_job_secret(x_job_secret: str | None = Header(default=None)) -> None:
    """DEC-09: falha fechada. Sem JOBS_SECRET no servidor, nada roda (503)."""
    esperado = os.getenv("JOBS_SECRET")
    if not esperado:
        raise HTTPException(status_code=503, detail="Job não configurado no servidor.")
    if not x_job_secret or not hmac.compare_digest(x_job_secret.encode(), esperado.encode()):
        raise HTTPException(status_code=401, detail="Segredo do job inválido.")


@router.post("/alertas", dependencies=[Depends(require_job_secret)])
def job_alertas(tipos: str | None = None):
    """Avalia as regras ativas. `tipos` (ex.: preco_cruza,vol_acima) restringe; hoje não usado pelo cron diário."""
    return alertas.rodar_avaliacoes(tipos=[t for t in tipos.split(",") if t] if tipos else None)
