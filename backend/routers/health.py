import logging
from typing import Annotated
from fastapi import APIRouter, Depends
from auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/health")
async def health():
    return {"status": "ok"}


@router.get("/api/me")
async def me(user: Annotated[dict, Depends(get_current_user)]):
    """Returns current user info — verifies JWT is accepted for normal users."""
    return {"id": user["id"], "email": user["email"], "role": user["role"]}
