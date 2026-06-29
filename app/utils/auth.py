"""Authentication utilities — bcrypt hashing, JWT creation/verification."""
import secrets
import datetime
from typing import Optional

from passlib.context import CryptContext
from jose import jwt, JWTError

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password with bcrypt (cost factor 12)."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return pwd_context.verify(plain, hashed)


def create_access_token(owner_id: int) -> str:
    """Issue a short-lived JWT access token."""
    now = datetime.datetime.utcnow()
    payload = {
        "sub": str(owner_id),
        "iat": now,
        "exp": now + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> tuple[str, datetime.datetime]:
    """Generate a cryptographically random refresh token."""
    token = secrets.token_hex(32)
    expires = datetime.datetime.utcnow() + datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return token, expires


def decode_access_token(token: str) -> Optional[int]:
    """Decode and validate an access token. Returns owner_id or None."""
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "access":
            return None
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None