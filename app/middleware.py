"""Middleware and dependencies for the FastAPI app."""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Owner
from app.utils.auth import decode_access_token

security = HTTPBearer(auto_error=False)


def get_current_owner(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Owner:
    """Dependency: extract and validate JWT, return the Owner."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Не авторизован",
        )
    token = credentials.credentials
    owner_id = decode_access_token(token)
    if owner_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный или просроченный токен",
        )
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Владелец не найден",
        )
    return owner