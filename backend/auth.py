import os
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt  # PyJWT
from jwt.algorithms import ECAlgorithm

_bearer = HTTPBearer()

# Supabase uses ES256 (P-256), not RS256.
# Set SUPABASE_JWT_JWK to the JSON string of one key from:
#   https://<project>.supabase.co/auth/v1/.well-known/jwks.json
# Example: {"alg":"ES256","crv":"P-256","kty":"EC","use":"sig","x":"...","y":"..."}
_JWK_JSON = os.environ.get("SUPABASE_JWT_JWK", "")


def _load_public_key():
    if not _JWK_JSON:
        return None
    try:
        return ECAlgorithm.from_jwk(_JWK_JSON)
    except Exception as exc:
        raise RuntimeError(f"SUPABASE_JWT_JWK inválido: {exc}") from exc


_PUBLIC_KEY = _load_public_key()


def verify_jwt(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> dict:
    """
    Validate the Bearer JWT using Supabase's ES256 public key (P-256 JWK).
    Returns the decoded payload dict. Raises HTTP 401 on any failure.
    No network call is made — verification is fully local.
    """
    if not _PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_JWK not configured",
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            _PUBLIC_KEY,
            algorithms=["ES256"],
            options={"require": ["sub", "exp", "aud"]},
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
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
