"""Database engine and session management with SQLAlchemy."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db():
    """Create all tables on startup."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a session and closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()