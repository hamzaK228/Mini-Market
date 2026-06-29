"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ─── Auth ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=4, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    owner: dict


class RefreshRequest(BaseModel):
    refresh_token: str


class OwnerOut(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


# ─── Markets ────────────────────────────────────────────────────────────────

class KkmConfig(BaseModel):
    provider: Optional[str] = None
    endpoint: Optional[str] = None
    token: Optional[str] = None
    deviceId: Optional[str] = None


class MarketCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    address: str = Field(..., min_length=1, max_length=255)


class MarketUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    kkm_config: Optional[dict] = None


class MarketOut(BaseModel):
    id: int
    name: str
    address: str
    kkm_config: dict = {}
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Products ───────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=255)
    buy_price: float = Field(..., ge=0)
    sell_price: float = Field(..., ge=0)
    supplier: str = Field(default="", max_length=255)


class ProductOut(BaseModel):
    id: int
    name: str
    category: str
    buy_price: float
    sell_price: float
    supplier: str

    class Config:
        from_attributes = True


# ─── Orders ─────────────────────────────────────────────────────────────────

class OrderItem(BaseModel):
    productId: int
    name: str
    price: float
    qty: int


class OrderCreate(BaseModel):
    market_id: int
    supplier: str = Field(..., min_length=1)
    contact_person: str = Field(default="")
    phone: str = Field(default="")
    items: list[OrderItem] = []


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    comment: Optional[str] = None
    items: Optional[list[OrderItem]] = None


class OrderOut(BaseModel):
    id: int
    market_id: int
    supplier: str
    contact_person: str
    phone: str
    status: str
    items_json: list = []
    comment: str = ""
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Reconciliations ────────────────────────────────────────────────────────

class ReconItem(BaseModel):
    productId: int
    name: str
    actualQty: float = 0
    registerQty: float = 0


class ReconSave(BaseModel):
    market_id: int
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    items: list[ReconItem] = []
    total_expected: float = 0
    total_register: float = 0
    total_diff: float = 0
    status: str = "ok"


class ReconOut(BaseModel):
    id: int
    market_id: int
    date: str
    items_json: list = []
    total_expected: float
    total_register: float
    total_diff: float
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReconHistoryOut(BaseModel):
    id: int
    date: str
    total_expected: float
    total_register: float
    total_diff: float
    status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Generic API Response ───────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    error: str


class MessageResponse(BaseModel):
    message: str