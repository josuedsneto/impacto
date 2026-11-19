from dotenv import load_dotenv
load_dotenv()

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

from auth import get_current_user, require_admin  # noqa: F401  (testes acessam main.get_current_user)
from limiter import limiter
from observabilidade import RequestIdMiddleware, configurar_logs
from routers import (
    admin, alertas, analises, atr_usinas, cambio, conta, hedge_cambial, jobs, mercado,
    opcoes, posicoes, regressao, risco, risco_conjunto, simulacoes,
)

configurar_logs()

# Documentação da API (Swagger, ReDoc e schema) só com ENABLE_DOCS=true.
_docs_on = os.getenv("ENABLE_DOCS", "").strip().lower() == "true"

app = FastAPI(
    title="Impacto API",
    version="2.0.0",
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
# Por dentro do CORS: o erro 500 também sai com cabeçalhos CORS (HARD-02, HARD-10)
app.add_middleware(RequestIdMiddleware)

# CORS — origins configured via env var; defaults to localhost for local dev
cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Rotas por domínio: cada router é dono dos seus paths (ver .specs/features/main-routers)
for modulo in (
    jobs, risco_conjunto, alertas, analises, posicoes, cambio, hedge_cambial,
    conta, mercado, regressao, simulacoes, opcoes, atr_usinas, admin, risco,
):
    app.include_router(modulo.router)
