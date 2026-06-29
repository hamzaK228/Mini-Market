"""Authentication router — register, login, refresh, logout."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import Owner, RefreshToken
from app.schemas import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest
from app.utils.auth import hash_password, verify_password, create_access_token, create_refresh_token

from app.middleware import get_current_owner

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    name = body.name.strip()
    password = body.password

    existing = db.query(Owner).filter(Owner.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email уже зарегистрирован")

    owner = Owner(
        email=email,
        name=name,
        password_hash=hash_password(password),
    )
    db.add(owner)
    db.flush()  # get owner.id without committing

    # Create default markets and products
    _populate_default_data(owner.id, db)

    # Issue tokens
    access_token = create_access_token(owner.id)
    refresh_token_str, expires = create_refresh_token()
    db.add(RefreshToken(owner_id=owner.id, token=refresh_token_str, expires_at=expires))

    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        owner={"id": owner.id, "name": owner.name, "email": owner.email},
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    password = body.password

    owner = db.query(Owner).filter(Owner.email == email).first()
    if not owner or not verify_password(password, owner.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный email или пароль")

    access_token = create_access_token(owner.id)
    refresh_token_str, expires = create_refresh_token()
    db.add(RefreshToken(owner_id=owner.id, token=refresh_token_str, expires_at=expires))
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        owner={"id": owner.id, "name": owner.name, "email": owner.email},
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    rt = db.query(RefreshToken).filter(
        RefreshToken.token == body.refresh_token,
        RefreshToken.is_revoked == 0,
        RefreshToken.expires_at > datetime.utcnow(),
    ).first()

    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный или просроченный refresh токен")

    # Revoke old refresh token
    rt.is_revoked = 1

    owner = db.query(Owner).filter(Owner.id == rt.owner_id).first()
    if not owner:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Владелец не найден")

    # Issue new tokens
    access_token = create_access_token(owner.id)
    new_refresh, expires = create_refresh_token()
    db.add(RefreshToken(owner_id=owner.id, token=new_refresh, expires_at=expires))
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        owner={"id": owner.id, "name": owner.name, "email": owner.email},
    )


@router.post("/logout")
def logout(owner: Owner = Depends(get_current_owner), db: Session = Depends(get_db)):
    # Revoke all refresh tokens
    db.query(RefreshToken).filter(
        RefreshToken.owner_id == owner.id,
        RefreshToken.is_revoked == 0,
    ).update({"is_revoked": 1})
    db.commit()
    return {"message": "Выход выполнен"}


# ─── Default seed data helpers ──────────────────────────────────────────────

import json

DEFAULT_MARKETS = [
    ('Магазин №1 "Киевская 120"', 'ул. Киевская, 120', '{"provider": "webkassa", "endpoint": "https://api.webkassa.kg/v1/sales-report", "token": "Bearer wk-token-9382103f8a", "deviceId": "KKM-BISHKEK-01"}'),
    ('Магазин №2 "Ахунбаева 45"', 'ул. Ахунбаева, 45', '{"provider": "1c", "endpoint": "https://api.1c.kg/v1/sales-report", "token": "Bearer 1c-token-829103fa7b", "deviceId": "KKM-BISHKEK-02"}'),
]

DEFAULT_PRODUCTS = [
    ("Coca-Cola 0.5L", "drinks", 42, 58, "Coca-Cola Bishkek"),
    ("Coca-Cola 1.0L", "drinks", 68, 90, "Coca-Cola Bishkek"),
    ("Fanta 0.5L", "drinks", 42, 58, "Coca-Cola Bishkek"),
    ("Sprite 0.5L", "drinks", 42, 58, "Coca-Cola Bishkek"),
    ("Choco Pie 6pcs", "sweets", 120, 160, "Orion"),
    ("Besurev", "snacks", 25, 40, "Local"),
    ("Lipton Yellow 25pk", "tea", 180, 250, "Lipton KR"),
    ("Lipton Green 20pk", "tea", 160, 220, "Lipton KR"),
    ("Magnum Classic", "ice cream", 120, 170, "Nestle KR"),
    ("Extreme 90ml", "ice cream", 95, 140, "Nestle KR"),
    ("Lays 90g", "snacks", 75, 100, "Local"),
    ("Cheetos 90g", "snacks", 75, 100, "Local"),
    ("Suzu 1L", "dairy", 55, 75, "Shoro/Local"),
    ("Kumys 0.5L", "dairy", 60, 85, "Shoro/Local"),
    ("Wisk 400ml", "household", 180, 250, "Local"),
    ("Pampers S per pc", "baby", 35, 50, "Local"),
]


def _populate_default_data(owner_id: int, db: Session):
    from app.models import Market, Product, Order

    m_ids = []
    for name, address, kkm in DEFAULT_MARKETS:
        m = Market(owner_id=owner_id, name=name, address=address, kkm_config=kkm)
        db.add(m)
        db.flush()
        m_ids.append(m.id)

    p_map = {}
    for p_name, cat, buy, sell, supp in DEFAULT_PRODUCTS:
        p = Product(owner_id=owner_id, name=p_name, category=cat, buy_price=buy, sell_price=sell, supplier=supp)
        db.add(p)
        db.flush()
        p_map[p_name] = p.id

    if len(m_ids) >= 2:
        items1 = [{"productId": p_map.get("Coca-Cola 0.5L", 0), "name": "Coca-Cola 0.5L", "qty": 48, "price": 42},
                   {"productId": p_map.get("Fanta 0.5L", 0), "name": "Fanta 0.5L", "qty": 24, "price": 42}]
        db.add(Order(market_id=m_ids[0], supplier="Coca-Cola Bishkek", contact_person="Алексей",
                     phone="+996 555 123 456", status="pending", items_json=json.dumps(items1, ensure_ascii=False)))

        items2 = [{"productId": p_map.get("Choco Pie 6pcs", 0), "name": "Choco Pie 6pcs", "qty": 30, "price": 120}]
        db.add(Order(market_id=m_ids[0], supplier="Orion", contact_person="Дмитрий",
                     phone="+996 777 987 654", status="pending", items_json=json.dumps(items2, ensure_ascii=False)))

        items3 = [{"productId": p_map.get("Magnum Classic", 0), "name": "Magnum Classic", "qty": 24, "price": 120},
                   {"productId": p_map.get("Extreme 90ml", 0), "name": "Extreme 90ml", "qty": 24, "price": 95}]
        db.add(Order(market_id=m_ids[1], supplier="Nestle KR", contact_person="Мария",
                     phone="+996 500 456 789", status="pending", items_json=json.dumps(items3, ensure_ascii=False)))

        items4 = [{"productId": p_map.get("Lipton Yellow 25pk", 0), "name": "Lipton Yellow 25pk", "qty": 15, "price": 180}]
        db.add(Order(market_id=m_ids[1], supplier="Lipton KR", contact_person="Анна",
                     phone="+996 701 112 233", status="pending", items_json=json.dumps(items4, ensure_ascii=False)))