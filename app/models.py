"""SQLAlchemy ORM models for Mini-Markets CRM."""
import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Owner(Base):
    __tablename__ = "owners"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    markets = relationship("Market", back_populates="owner", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="owner", cascade="all, delete-orphan")
    refresh_tokens = relationship("RefreshToken", back_populates="owner", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_revoked = Column(Integer, default=0)  # boolean

    owner = relationship("Owner", back_populates="refresh_tokens")


class Market(Base):
    __tablename__ = "markets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    address = Column(String(255), nullable=False)
    kkm_config = Column(Text, default="{}")  # JSON string
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("Owner", back_populates="markets")
    reconciliations = relationship("Reconciliation", back_populates="market", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="market", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("owners.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=False)
    buy_price = Column(Float, nullable=False)
    sell_price = Column(Float, nullable=False)
    supplier = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    owner = relationship("Owner", back_populates="products")


class Reconciliation(Base):
    __tablename__ = "reconciliations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    market_id = Column(Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(10), nullable=False)  # YYYY-MM-DD
    items_json = Column(Text, default="[]")  # JSON string
    total_expected = Column(Float, default=0)
    total_register = Column(Float, default=0)
    total_diff = Column(Float, default=0)
    status = Column(String(20), default="ok")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("market_id", "date", name="uq_market_date"),
    )

    market = relationship("Market", back_populates="reconciliations")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    market_id = Column(Integer, ForeignKey("markets.id", ondelete="CASCADE"), nullable=False)
    supplier = Column(String(255), nullable=False)
    contact_person = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    items_json = Column(Text, default="[]")  # JSON string
    comment = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    market = relationship("Market", back_populates="orders")