import os
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt  # PyJWT

_bearer = HTTPBearer()

# Load RS256 public key once at startup.
# Value must be the full PEM string (with -----BEGIN PUBLIC KEY----- header).
# Supabase exposes this at: https://<project>.supabase.co/auth/v1/jwks
# Copy the PEM and set it as a multiline env var or store in a file.
# Get from: https://<project-ref>.supabase.co/auth/v1/jwks then convert to PEM
_PUBLIC_KEY = os.environ.get("SUPABASE_JWT_PUBLIC_KEY", "")


def verify_jwt(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    Validate the Bearer JWT using Supabase's RS256 public key.
    Returns the decoded payload dict. Raises HTTP 401 on any failure.
    No network call is made — verification is fully local.
    """
    if not _PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_PUBLIC_KEY not configured",
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            _PUBLIC_KEY,
            algorithms=["RS256"],
            options={"require": ["sub", "exp", "aud"]},
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token inválido: {exc}")
    return payload


def get_current_user(payload: Annotated[dict, Depends(verify_jwt)]) -> dict:
    """
    Returns a minimal user dict extracted from the verified JWT payload:
    { "id": str, "email": str, "role": str }
    role comes from app_metadata.role (set by admin); defaults to "user".
    """
    app_metadata = payload.get("app_metadata") or {}
    return {
        "id": payload["sub"],
        "email": payload.get("email", ""),
        "role": app_metadata.get("role", "user"),
    }


def require_admin(
    user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Guard for admin-only routes. Raises HTTP 403 if role != 'admin'."""
    if user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return user
