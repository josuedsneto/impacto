"""Jobs disparados por agendamento externo (Vercel Cron), protegidos por segredo compartilhado."""
import hmac
import logging
import os
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

from market_cache import get_prices

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

# ponytail: espelho de frontend/lib/ativos.ts; se a lista mudar, mude nos dois lugares
TICKERS_AQUECIMENTO = ["SB=F", "SBK26.NYB", "USDBRL=X", "CL=F"]
INICIO_AQUECIMENTO = date(2007, 1, 1)  # mesma janela do Stress


def require_job_secret(x_job_secret: Optional[str] = Header(None)) -> None:
    """Falha fechada: sem JOBS_SECRET configurado nenhum job roda."""
    esperado = os.environ.get("JOBS_SECRET", "")
    if not esperado:
        raise HTTPException(status_code=503, detail="Job indisponível: JOBS_SECRET não configurado.")
    if not x_job_secret or not hmac.compare_digest(x_job_secret.encode(), esperado.encode()):
        raise HTTPException(status_code=401, detail="Segredo do job inválido.")


@router.post("/aquecer-cache", dependencies=[Depends(require_job_secret)])
def aquecer_cache():
    """Atualiza o cache de preços dos ativos do app, antes da abertura do pregão."""
    hoje = date.today()
    aquecidos = []
    for ticker in TICKERS_AQUECIMENTO:
        try:
            linhas = get_prices(ticker, INICIO_AQUECIMENTO, hoje)
        except Exception:
            # Falha do próprio banco (o Yahoo já é tratado dentro de get_prices): segue com os outros ativos
            logger.exception("Aquecimento falhou para %s", ticker)
            aquecidos.append({"ticker": ticker, "linhas": 0, "ultimo_dado": None, "erro": True})
            continue
        aquecidos.append({
            "ticker": ticker,
            "linhas": len(linhas),
            "ultimo_dado": linhas[-1]["date"] if linhas else None,
        })
    return {"aquecidos": aquecidos}
