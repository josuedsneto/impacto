"""Logging com request-id e handler global de erros inesperados (HARD-02, HARD-10)."""
import logging
import os
import re
import uuid
from contextvars import ContextVar

from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

MSG_ERRO_INESPERADO = "Erro inesperado. Se persistir, informe o código {rid}."

_RID_VALIDO = re.compile(r"[A-Za-z0-9-]{1,64}")

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

logger = logging.getLogger(__name__)


class _FiltroRequestId(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def configurar_logs() -> None:
    """Nível vem de LOG_LEVEL (padrão INFO). Idempotente: não duplica o handler."""
    raiz = logging.getLogger()
    if any(getattr(h, "_impacto", False) for h in raiz.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
    ))
    handler.addFilter(_FiltroRequestId())
    handler._impacto = True  # marca para não duplicar em reimportação
    raiz.addHandler(handler)
    raiz.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Põe um request-id em cada requisição e transforma exceção não tratada em 500 em JSON.

    Fica por dentro do CORS: assim a resposta de erro também recebe os cabeçalhos CORS
    e o navegador consegue mostrar a mensagem em português.
    """

    async def dispatch(self, request, call_next):
        rid = request.headers.get("x-request-id", "")
        if not _RID_VALIDO.fullmatch(rid):  # id do cliente só é usado se for seguro para log e cabeçalho
            rid = uuid.uuid4().hex[:12]
        token = request_id_var.set(rid)
        try:
            try:
                response = await call_next(request)
            except Exception:
                logger.exception("Erro não tratado em %s %s", request.method, request.url.path)
                response = JSONResponse(status_code=500, content={"detail": MSG_ERRO_INESPERADO.format(rid=rid)})
            response.headers["X-Request-ID"] = rid
            return response
        finally:
            request_id_var.reset(token)
