"""Application configuration via environment variables."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def get_default_database_url() -> str:
    """Use a writable location for SQLite in serverless environments."""
    if os.getenv("VERCEL"):
        return "sqlite:////tmp/market.db"
    return f"sqlite:///{BASE_DIR / 'market.db'}"


class Settings:
    # Server
    PORT: int = int(os.getenv("PORT", "8080"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", get_default_database_url())

    # Auth
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET",
        "change-me-in-production-use-a-real-256-bit-secret"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Rate limiting
    RATE_LIMIT_AUTH: str = os.getenv("RATE_LIMIT_AUTH", "5/minute")
    RATE_LIMIT_GLOBAL: str = os.getenv("RATE_LIMIT_GLOBAL", "100/minute")

    # CORS
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8080,http://127.0.0.1:8080"
    ).split(",")

    # KKM integration
    KKM_TIMEOUT_SECONDS: int = int(os.getenv("KKM_TIMEOUT_SECONDS", "30"))


settings = Settings()